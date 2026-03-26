from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging

logger = logging.getLogger(__name__)

# Main database (MongoDB Local - primary for all reads)
companies_client = None
companies_db = None

# App database (users, subscriptions, settings - also local)
app_client = None
app_db = None

# Cloud database (MongoDB Atlas - ONLY for sync source)
cloud_companies_client = None
cloud_companies_db = None


async def connect_to_databases():
    global companies_client, companies_db
    global app_client, app_db
    global cloud_companies_client, cloud_companies_db
    
    # Connect to main local MongoDB (firme, bilanturi - primary data source)
    mongo_url = os.getenv("MONGO_URL")
    if mongo_url:
        try:
            companies_client = AsyncIOMotorClient(mongo_url)
            companies_db = companies_client["mfirme_local"]
            await companies_db.command('ping')
            
            firme_count = await companies_db.firme.count_documents({})
            print(f"✓ Connected to MongoDB Local - mfirme_local ({firme_count:,} firme)")
        except Exception as e:
            print(f"✗ Failed to connect to local MongoDB: {e}")
    
    # Connect to app database (users, settings - same local instance)
    app_mongo_url = os.getenv("APP_MONGO_URL")
    if app_mongo_url:
        try:
            app_client = AsyncIOMotorClient(app_mongo_url)
            app_db = app_client["mfirme_app"]
            await app_db.command('ping')
            print("✓ Connected to MongoDB Local - mfirme_app (users, settings)")
        except Exception as e:
            print(f"✗ Failed to connect to app DB: {e}")
    
    # Connect to Cloud MongoDB (ONLY for sync - not for regular reads)
    cloud_mongo_url = os.getenv("CLOUD_MONGO_URL")
    if cloud_mongo_url:
        try:
            cloud_companies_client = AsyncIOMotorClient(cloud_mongo_url)
            cloud_companies_db = cloud_companies_client["justportal"]
            await cloud_companies_db.command('ping')
            print("✓ Connected to MongoDB Cloud (sync source only)")
        except Exception as e:
            print(f"⚠ Cloud MongoDB not available for sync: {e}")
    
    print("Database mode: LOCAL (Cloud used only for sync)")


async def close_database_connections():
    global companies_client, app_client, cloud_companies_client
    
    if companies_client:
        companies_client.close()
    if app_client:
        app_client.close()
    if cloud_companies_client:
        cloud_companies_client.close()
    
    print("✓ Closed all MongoDB connections")


def get_companies_db():
    """Get the main companies database (always local)"""
    return companies_db


def get_readonly_db():
    """Alias for get_companies_db"""
    return companies_db


def get_app_db():
    """Get the app database (users, settings, etc.)"""
    return app_db


def get_local_db():
    """Get local database directly (same as companies_db)"""
    return companies_db


def get_cloud_db():
    """Get cloud database (ONLY for sync operations)"""
    return cloud_companies_db


def is_using_local_db() -> bool:
    """Always returns True - we always use local"""
    return True


async def check_local_db_health() -> dict:
    """Check local database health and data status"""
    if companies_db is None:
        return {
            "available": False,
            "reason": "Local DB not configured"
        }
    
    try:
        await companies_db.command('ping')
        
        # Get collection counts
        collections = {}
        for col in ['firme', 'bilanturi', 'caen_codes', 'postal_codes', 'localities']:
            try:
                count = await companies_db[col].count_documents({})
                collections[col] = count
            except:
                collections[col] = 0
        
        # Get sync status
        sync_status = {}
        try:
            status_docs = await companies_db.sync_status.find({}).to_list(length=100)
            for doc in status_docs:
                sync_status[doc['collection']] = {
                    'status': doc.get('status'),
                    'last_sync': doc.get('last_full_sync'),
                    'documents': doc.get('documents_count', 0)
                }
        except:
            pass
        
        return {
            "available": True,
            "collections": collections,
            "sync_status": sync_status,
            "total_documents": sum(collections.values())
        }
        
    except Exception as e:
        return {
            "available": False,
            "reason": str(e)
        }


async def force_use_local(use_local: bool):
    """Deprecated - we always use local now"""
    return {"status": "ok", "message": "Always using local database"}