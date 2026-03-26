"""
Admin Sync Routes
Endpoints pentru controlul sincronizării MongoDB local/cloud
Sync direct în backend (fără sync-service separat)
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncio
import os
from datetime import datetime, timezone
from auth import get_current_user
from database import get_app_db, get_local_db, get_cloud_db, check_local_db_health
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import InsertOne
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/sync", tags=["admin-sync"])

# Sync state (in-memory for this instance)
sync_state = {
    "is_running": False,
    "current_collection": None,
    "progress": 0,
    "total": 0,
    "synced": 0,
    "status": "idle",
    "last_sync": None,
    "errors": [],
    "collections_status": {}
}

BATCH_SIZE = 5000


class SyncRequest(BaseModel):
    cloud_url: Optional[str] = None


async def verify_admin(current_user = Depends(get_current_user)):
    """Verify user is admin"""
    app_db = get_app_db()
    user = await app_db.users.find_one({"email": current_user["email"]})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


async def sync_collection(cloud_db, local_db, collection_name: str) -> Dict[str, Any]:
    """Sync a single collection from cloud to local"""
    global sync_state
    
    start_time = datetime.now(timezone.utc)
    sync_state["current_collection"] = collection_name
    sync_state["status"] = f"syncing_{collection_name}"
    
    try:
        # Get total count
        total_count = await cloud_db[collection_name].count_documents({})
        sync_state["total"] = total_count
        sync_state["synced"] = 0
        sync_state["progress"] = 0
        
        logger.info(f"Starting sync for {collection_name}: {total_count:,} documents")
        
        # Clear local collection
        await local_db[collection_name].delete_many({})
        
        # Sync in batches
        synced = 0
        cursor = cloud_db[collection_name].find({}).batch_size(BATCH_SIZE)
        
        batch = []
        async for doc in cursor:
            batch.append(InsertOne(doc))
            
            if len(batch) >= BATCH_SIZE:
                await local_db[collection_name].bulk_write(batch, ordered=False)
                synced += len(batch)
                sync_state["synced"] = synced
                sync_state["progress"] = int((synced / total_count) * 100) if total_count > 0 else 100
                
                logger.info(f"  {collection_name}: {synced:,}/{total_count:,} ({sync_state['progress']}%)")
                batch = []
        
        # Insert remaining
        if batch:
            await local_db[collection_name].bulk_write(batch, ordered=False)
            synced += len(batch)
            sync_state["synced"] = synced
        
        # Create indexes
        await create_indexes(local_db, collection_name)
        
        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()
        
        # Update collection status
        sync_state["collections_status"][collection_name] = {
            "status": "synced",
            "documents": synced,
            "last_sync": end_time.isoformat(),
            "duration_seconds": duration
        }
        
        # Save sync status to local DB
        await local_db.sync_status.update_one(
            {"collection": collection_name},
            {"$set": {
                "status": "synced",
                "documents_count": synced,
                "last_full_sync": end_time,
                "duration_seconds": duration
            }},
            upsert=True
        )
        
        logger.info(f"✓ Completed sync for {collection_name}: {synced:,} docs in {duration:.1f}s")
        
        return {
            "collection": collection_name,
            "documents": synced,
            "duration_seconds": duration,
            "status": "completed"
        }
        
    except Exception as e:
        logger.error(f"Error syncing {collection_name}: {e}")
        sync_state["errors"].append({
            "collection": collection_name,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        sync_state["collections_status"][collection_name] = {
            "status": "error",
            "error": str(e)
        }
        return {
            "collection": collection_name,
            "status": "error",
            "error": str(e)
        }


async def create_indexes(local_db, collection_name: str):
    """Create indexes for collection"""
    try:
        if collection_name == 'firme':
            await local_db[collection_name].create_index('cui', unique=True)
            await local_db[collection_name].create_index('denumire')
            await local_db[collection_name].create_index('id')
            await local_db[collection_name].create_index([('denumire', 'text')])
            logger.info(f"  Created indexes for {collection_name}")
            
        elif collection_name == 'bilanturi':
            await local_db[collection_name].create_index('firma_id')
            await local_db[collection_name].create_index('an')
            await local_db[collection_name].create_index([('firma_id', 1), ('an', -1)])
            logger.info(f"  Created indexes for {collection_name}")
            
        elif collection_name == 'caen_codes':
            await local_db[collection_name].create_index('cod', unique=True)
            logger.info(f"  Created indexes for {collection_name}")
            
    except Exception as e:
        logger.warning(f"Error creating indexes for {collection_name}: {e}")


async def run_full_sync(cloud_db, local_db, collections: list):
    """Run full sync for all collections"""
    global sync_state
    
    sync_state["is_running"] = True
    sync_state["status"] = "running"
    sync_state["errors"] = []
    
    results = {}
    
    for collection in collections:
        if not sync_state["is_running"]:
            break
        results[collection] = await sync_collection(cloud_db, local_db, collection)
    
    sync_state["is_running"] = False
    sync_state["status"] = "idle"
    sync_state["current_collection"] = None
    sync_state["last_sync"] = datetime.now(timezone.utc).isoformat()
    
    return results


@router.get("/status")
async def get_sync_status(admin_user = Depends(verify_admin)):
    """Get comprehensive sync status"""
    import time
    
    local_health = await check_local_db_health()
    
    # Measure local DB latency
    local_latency = None
    local_db = get_local_db()
    if local_db is not None:
        try:
            start = time.perf_counter()
            await local_db.command('ping')
            local_latency = round((time.perf_counter() - start) * 1000, 2)  # ms
        except:
            pass
    
    # Measure query speed (count query)
    query_speed = None
    if local_db is not None:
        try:
            start = time.perf_counter()
            await local_db.firme.find_one({})
            query_speed = round((time.perf_counter() - start) * 1000, 2)  # ms
        except:
            pass
    
    cloud_db = get_cloud_db()
    cloud_counts = {}
    cloud_connected = False
    cloud_latency = None
    
    if cloud_db is not None:
        try:
            # Measure cloud latency
            start = time.perf_counter()
            await cloud_db.command('ping')
            cloud_latency = round((time.perf_counter() - start) * 1000, 2)  # ms
            
            for col in ['firme', 'bilanturi']:
                cloud_counts[col] = await cloud_db[col].estimated_document_count()
            cloud_connected = True
        except Exception as e:
            cloud_counts["error"] = str(e)
    
    return {
        "mode": "local",
        "local_db": local_health,
        "local_performance": {
            "ping_ms": local_latency,
            "query_ms": query_speed,
            "status": "fast" if local_latency and local_latency < 5 else "normal" if local_latency else "unknown"
        },
        "cloud_counts": cloud_counts,
        "cloud_connected": cloud_connected,
        "cloud_latency_ms": cloud_latency,
        "sync_state": {
            "is_running": sync_state["is_running"],
            "status": sync_state["status"],
            "current_collection": sync_state["current_collection"],
            "progress": sync_state["progress"],
            "synced": sync_state["synced"],
            "total": sync_state["total"],
            "last_sync": sync_state["last_sync"],
            "collections_status": sync_state["collections_status"],
            "errors": sync_state["errors"][-5:]  # Last 5 errors
        }
    }


@router.post("/direct-sync")
async def trigger_direct_sync(
    background_tasks: BackgroundTasks,
    collection: Optional[str] = None,
    admin_user = Depends(verify_admin)
):
    """
    Trigger direct sync from cloud to local (no sync-service needed)
    - If collection is specified, sync only that collection
    - Otherwise sync all: firme, bilanturi
    """
    global sync_state
    
    if sync_state["is_running"]:
        raise HTTPException(status_code=409, detail="Sync already in progress")
    
    cloud_db = get_cloud_db()
    local_db = get_local_db()
    
    if cloud_db is None:
        raise HTTPException(status_code=400, detail="Cloud database not connected. Check CLOUD_MONGO_URL in .env")
    
    if local_db is None:
        raise HTTPException(status_code=400, detail="Local database not connected")
    
    # Define collections to sync
    if collection:
        allowed = ['firme', 'bilanturi', 'caen_codes']
        if collection not in allowed:
            raise HTTPException(status_code=400, detail=f"Invalid collection. Allowed: {allowed}")
        collections = [collection]
    else:
        collections = ['firme', 'bilanturi']
    
    # Start sync in background
    background_tasks.add_task(run_full_sync, cloud_db, local_db, collections)
    
    return {
        "status": "started",
        "message": f"Sync started for: {', '.join(collections)}",
        "collections": collections,
        "tip": "Check /api/admin/sync/status for progress"
    }


@router.post("/stop-sync")
async def stop_sync(admin_user = Depends(verify_admin)):
    """Stop ongoing sync"""
    global sync_state
    
    if not sync_state["is_running"]:
        return {"status": "not_running", "message": "No sync in progress"}
    
    sync_state["is_running"] = False
    sync_state["status"] = "stopping"
    
    return {"status": "stopping", "message": "Sync will stop after current batch"}


@router.get("/health")
async def check_connections(admin_user = Depends(verify_admin)):
    """Check database connections"""
    results = {}
    
    # Check local
    local_db = get_local_db()
    if local_db is not None:
        try:
            await local_db.command('ping')
            results["local"] = {"status": "connected"}
        except Exception as e:
            results["local"] = {"status": "error", "error": str(e)}
    else:
        results["local"] = {"status": "not_configured"}
    
    # Check cloud
    cloud_db = get_cloud_db()
    if cloud_db is not None:
        try:
            await cloud_db.command('ping')
            results["cloud"] = {"status": "connected"}
        except Exception as e:
            results["cloud"] = {"status": "error", "error": str(e)}
    else:
        results["cloud"] = {"status": "not_configured"}
    
    return results


@router.get("/local-stats")
async def get_local_db_stats(admin_user = Depends(verify_admin)):
    """Get detailed statistics about local database"""
    local_db = get_local_db()
    
    if local_db is None:
        return {"available": False, "message": "Local DB not configured"}
    
    try:
        stats = {}
        collections = ['firme', 'bilanturi', 'caen_codes', 'postal_codes', 'localities', 'sync_status']
        
        for col in collections:
            try:
                count = await local_db[col].count_documents({})
                stats[col] = {"count": count}
            except Exception as e:
                stats[col] = {"error": str(e)}
        
        return {
            "database": "mfirme_local",
            "collections": stats,
            "total_documents": sum(s.get("count", 0) for s in stats.values() if isinstance(s.get("count"), int))
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Keep old endpoints for backwards compatibility
@router.post("/trigger-full")
async def trigger_full_sync_legacy(
    background_tasks: BackgroundTasks,
    request: Request,
    admin_user = Depends(verify_admin)
):
    """Legacy endpoint - redirects to direct-sync"""
    return await trigger_direct_sync(background_tasks, None, admin_user)


@router.post("/trigger-collection/{collection_name}")
async def trigger_collection_sync_legacy(
    collection_name: str,
    background_tasks: BackgroundTasks,
    admin_user = Depends(verify_admin)
):
    """Legacy endpoint - redirects to direct-sync"""
    return await trigger_direct_sync(background_tasks, collection_name, admin_user)
