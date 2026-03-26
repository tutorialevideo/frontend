"""
MongoDB Sync Service
Sincronizează datele din MongoDB Atlas (cloud) în MongoDB Local
Folosește Change Streams pentru real-time sync
"""

import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne, InsertOne
from pymongo.errors import PyMongoError
import signal
import sys

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/logs/sync.log')
    ]
)
logger = logging.getLogger('sync-service')

# Configuration
MONGO_CLOUD_URL = os.getenv('MONGO_CLOUD_URL')
MONGO_LOCAL_URL = os.getenv('MONGO_LOCAL_URL', 'mongodb://localhost:27017/mfirme_local')
SYNC_COLLECTIONS = os.getenv('SYNC_COLLECTIONS', 'firme,bilanturi').split(',')
BATCH_SIZE = 5000
CLOUD_DB_NAME = 'justportal'

class SyncService:
    def __init__(self):
        self.cloud_client: Optional[AsyncIOMotorClient] = None
        self.local_client: Optional[AsyncIOMotorClient] = None
        self.cloud_db = None
        self.local_db = None
        self.is_running = False
        self.sync_status: Dict[str, Any] = {
            'status': 'idle',
            'last_sync': None,
            'collections': {},
            'errors': []
        }
        
    async def connect(self):
        """Connect to both MongoDB instances"""
        try:
            logger.info("Connecting to MongoDB Cloud...")
            self.cloud_client = AsyncIOMotorClient(MONGO_CLOUD_URL)
            self.cloud_db = self.cloud_client[CLOUD_DB_NAME]
            
            # Test cloud connection
            await self.cloud_db.command('ping')
            logger.info("✓ Connected to MongoDB Cloud")
            
            logger.info("Connecting to MongoDB Local...")
            self.local_client = AsyncIOMotorClient(MONGO_LOCAL_URL)
            self.local_db = self.local_client['mfirme_local']
            
            # Test local connection
            await self.local_db.command('ping')
            logger.info("✓ Connected to MongoDB Local")
            
            # Create sync_status collection
            await self.local_db.sync_status.create_index('collection', unique=True)
            
            return True
        except Exception as e:
            logger.error(f"Connection error: {e}")
            return False
    
    async def close(self):
        """Close database connections"""
        if self.cloud_client:
            self.cloud_client.close()
        if self.local_client:
            self.local_client.close()
        logger.info("Database connections closed")
    
    async def set_cloud_url(self, cloud_url: str) -> bool:
        """
        Set or update the Cloud MongoDB URL dynamically.
        Closes existing cloud connection and establishes a new one.
        """
        global MONGO_CLOUD_URL
        
        if not cloud_url:
            logger.error("Cloud URL is empty")
            return False
        
        logger.info("Updating Cloud MongoDB connection...")
        
        try:
            # Close existing cloud connection if any
            if self.cloud_client:
                try:
                    self.cloud_client.close()
                    logger.info("Closed existing cloud connection")
                except Exception as e:
                    logger.warning(f"Error closing old cloud connection: {e}")
            
            # Create new client with provided URL
            self.cloud_client = AsyncIOMotorClient(
                cloud_url,
                serverSelectionTimeoutMS=10000,  # 10 second timeout
                connectTimeoutMS=10000
            )
            self.cloud_db = self.cloud_client[CLOUD_DB_NAME]
            
            # Test the new connection
            await self.cloud_db.command('ping')
            
            # Update global config
            MONGO_CLOUD_URL = cloud_url
            
            logger.info("✓ Successfully connected to new Cloud MongoDB")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to new Cloud MongoDB: {e}")
            # Reset to None on failure
            self.cloud_client = None
            self.cloud_db = None
            raise Exception(f"Cloud connection failed: {str(e)}")
    
    async def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync status"""
        try:
            status_docs = await self.local_db.sync_status.find({}).to_list(length=100)
            collections_status = {doc['collection']: doc for doc in status_docs}
            
            return {
                'status': self.sync_status['status'],
                'is_running': self.is_running,
                'last_check': datetime.now(timezone.utc).isoformat(),
                'collections': collections_status,
                'errors': self.sync_status.get('errors', [])[-10:]  # Last 10 errors
            }
        except Exception as e:
            logger.error(f"Error getting sync status: {e}")
            return {'status': 'error', 'error': str(e)}
    
    async def full_sync_collection(self, collection_name: str) -> Dict[str, Any]:
        """Full sync a single collection from cloud to local"""
        logger.info(f"Starting full sync for collection: {collection_name}")
        
        start_time = datetime.now(timezone.utc)
        stats = {
            'collection': collection_name,
            'documents_synced': 0,
            'started_at': start_time.isoformat(),
            'status': 'in_progress'
        }
        
        try:
            # Update status
            await self.local_db.sync_status.update_one(
                {'collection': collection_name},
                {'$set': {
                    'status': 'syncing',
                    'started_at': start_time,
                    'progress': 0
                }},
                upsert=True
            )
            
            # Get total count from cloud
            total_count = await self.cloud_db[collection_name].count_documents({})
            logger.info(f"Collection {collection_name}: {total_count:,} documents to sync")
            
            # Clear local collection
            await self.local_db[collection_name].delete_many({})
            
            # Sync in batches
            synced = 0
            cursor = self.cloud_db[collection_name].find({}).batch_size(BATCH_SIZE)
            
            batch = []
            async for doc in cursor:
                batch.append(InsertOne(doc))
                
                if len(batch) >= BATCH_SIZE:
                    await self.local_db[collection_name].bulk_write(batch, ordered=False)
                    synced += len(batch)
                    progress = (synced / total_count) * 100 if total_count > 0 else 100
                    
                    # Update progress
                    await self.local_db.sync_status.update_one(
                        {'collection': collection_name},
                        {'$set': {'progress': progress, 'documents_synced': synced}}
                    )
                    
                    logger.info(f"  {collection_name}: {synced:,}/{total_count:,} ({progress:.1f}%)")
                    batch = []
            
            # Insert remaining documents
            if batch:
                await self.local_db[collection_name].bulk_write(batch, ordered=False)
                synced += len(batch)
            
            # Create indexes (mirror cloud indexes)
            await self._create_indexes(collection_name)
            
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()
            
            stats.update({
                'documents_synced': synced,
                'completed_at': end_time.isoformat(),
                'duration_seconds': duration,
                'status': 'completed'
            })
            
            # Update status
            await self.local_db.sync_status.update_one(
                {'collection': collection_name},
                {'$set': {
                    'status': 'synced',
                    'last_full_sync': end_time,
                    'documents_count': synced,
                    'progress': 100,
                    'duration_seconds': duration
                }}
            )
            
            logger.info(f"✓ Completed sync for {collection_name}: {synced:,} docs in {duration:.1f}s")
            return stats
            
        except Exception as e:
            logger.error(f"Error syncing {collection_name}: {e}")
            stats['status'] = 'error'
            stats['error'] = str(e)
            
            await self.local_db.sync_status.update_one(
                {'collection': collection_name},
                {'$set': {'status': 'error', 'error': str(e)}}
            )
            
            self.sync_status['errors'].append({
                'collection': collection_name,
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
            return stats
    
    async def _create_indexes(self, collection_name: str):
        """Create indexes for collection based on collection type"""
        try:
            if collection_name == 'firme':
                await self.local_db[collection_name].create_index('cui', unique=True)
                await self.local_db[collection_name].create_index('denumire')
                await self.local_db[collection_name].create_index('id')
                await self.local_db[collection_name].create_index([('denumire', 'text')])
                logger.info(f"  Created indexes for {collection_name}")
                
            elif collection_name == 'bilanturi':
                await self.local_db[collection_name].create_index('firma_id')
                await self.local_db[collection_name].create_index('an')
                await self.local_db[collection_name].create_index([('firma_id', 1), ('an', -1)])
                logger.info(f"  Created indexes for {collection_name}")
                
            elif collection_name == 'caen_codes':
                await self.local_db[collection_name].create_index('cod', unique=True)
                logger.info(f"  Created indexes for {collection_name}")
                
            elif collection_name == 'postal_codes':
                await self.local_db[collection_name].create_index([('judet', 1), ('localitate', 1)])
                await self.local_db[collection_name].create_index('codpostal')
                logger.info(f"  Created indexes for {collection_name}")
                
        except Exception as e:
            logger.warning(f"Error creating indexes for {collection_name}: {e}")
    
    async def full_sync_all(self) -> Dict[str, Any]:
        """Full sync all configured collections"""
        if self.is_running:
            return {'status': 'error', 'message': 'Sync already in progress'}
        
        self.is_running = True
        self.sync_status['status'] = 'running'
        
        logger.info(f"Starting full sync for collections: {SYNC_COLLECTIONS}")
        
        results = {}
        for collection in SYNC_COLLECTIONS:
            collection = collection.strip()
            if collection:
                results[collection] = await self.full_sync_collection(collection)
        
        self.is_running = False
        self.sync_status['status'] = 'idle'
        self.sync_status['last_sync'] = datetime.now(timezone.utc).isoformat()
        
        return {
            'status': 'completed',
            'collections': results,
            'completed_at': datetime.now(timezone.utc).isoformat()
        }
    
    async def watch_changes(self, collection_name: str):
        """Watch for changes in a cloud collection using Change Streams"""
        logger.info(f"Starting change stream watcher for: {collection_name}")
        
        try:
            pipeline = [
                {'$match': {'operationType': {'$in': ['insert', 'update', 'replace', 'delete']}}}
            ]
            
            async with self.cloud_db[collection_name].watch(pipeline) as stream:
                async for change in stream:
                    await self._process_change(collection_name, change)
                    
        except Exception as e:
            logger.error(f"Change stream error for {collection_name}: {e}")
            # Reconnect after delay
            await asyncio.sleep(5)
            asyncio.create_task(self.watch_changes(collection_name))
    
    async def _process_change(self, collection_name: str, change: Dict[str, Any]):
        """Process a single change event"""
        try:
            op_type = change.get('operationType')
            doc_key = change.get('documentKey', {})
            
            if op_type == 'insert':
                full_doc = change.get('fullDocument')
                if full_doc:
                    await self.local_db[collection_name].replace_one(
                        {'_id': full_doc['_id']},
                        full_doc,
                        upsert=True
                    )
                    logger.debug(f"Inserted document in {collection_name}")
                    
            elif op_type in ['update', 'replace']:
                full_doc = change.get('fullDocument')
                if full_doc:
                    await self.local_db[collection_name].replace_one(
                        {'_id': full_doc['_id']},
                        full_doc,
                        upsert=True
                    )
                    logger.debug(f"Updated document in {collection_name}")
                    
            elif op_type == 'delete':
                await self.local_db[collection_name].delete_one(doc_key)
                logger.debug(f"Deleted document from {collection_name}")
            
            # Update last change timestamp
            await self.local_db.sync_status.update_one(
                {'collection': collection_name},
                {'$set': {'last_change_sync': datetime.now(timezone.utc)}}
            )
            
        except Exception as e:
            logger.error(f"Error processing change for {collection_name}: {e}")
    
    async def start_change_watchers(self):
        """Start change stream watchers for all collections"""
        logger.info("Starting change stream watchers...")
        
        tasks = []
        for collection in SYNC_COLLECTIONS:
            collection = collection.strip()
            if collection:
                tasks.append(asyncio.create_task(self.watch_changes(collection)))
        
        return tasks


# Global sync service instance
sync_service = SyncService()


async def main():
    """Main entry point"""
    logger.info("=" * 50)
    logger.info("MongoDB Sync Service Starting...")
    logger.info(f"Collections to sync: {SYNC_COLLECTIONS}")
    logger.info("=" * 50)
    
    # Ensure logs directory exists
    os.makedirs('/app/logs', exist_ok=True)
    
    # Connect to databases
    if not await sync_service.connect():
        logger.error("Failed to connect to databases. Exiting.")
        sys.exit(1)
    
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Shutdown signal received...")
        asyncio.create_task(sync_service.close())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start change stream watchers (real-time sync)
    watchers = await sync_service.start_change_watchers()
    
    logger.info("Sync service is running. Waiting for changes...")
    logger.info("Note: Full sync must be triggered manually from admin panel")
    
    # Keep running
    try:
        await asyncio.gather(*watchers)
    except asyncio.CancelledError:
        logger.info("Watchers cancelled")
    finally:
        await sync_service.close()


if __name__ == '__main__':
    asyncio.run(main())
