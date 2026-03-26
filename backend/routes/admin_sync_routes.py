"""
Admin Sync Routes
Endpoints pentru controlul sincronizării MongoDB local/cloud
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
import httpx
import os
from auth import get_current_user
from database import get_app_db, get_local_db, is_using_local_db, check_local_db_health, force_use_local

router = APIRouter(prefix="/api/admin/sync", tags=["admin-sync"])

# Sync service URL (Docker internal)
SYNC_SERVICE_URL = os.getenv("SYNC_SERVICE_URL", "http://sync-service:8002")


class SyncRequest(BaseModel):
    cloud_url: Optional[str] = None


async def verify_admin(current_user = Depends(get_current_user)):
    """Verify user is admin"""
    app_db = get_app_db()
    user = await app_db.users.find_one({"email": current_user["email"]})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


@router.get("/status")
async def get_sync_status(admin_user = Depends(verify_admin)):
    """
    Get comprehensive sync status
    - Local DB availability
    - Collection counts (local vs cloud)
    - Last sync timestamps
    """
    # Get local DB health
    local_health = await check_local_db_health()
    
    # Try to get status from sync service
    sync_service_status = None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{SYNC_SERVICE_URL}/status")
            if response.status_code == 200:
                sync_service_status = response.json()
    except Exception as e:
        sync_service_status = {"error": str(e), "status": "unreachable"}
    
    # Get cloud counts for comparison
    from database import cloud_companies_db
    cloud_counts = {}
    if cloud_companies_db is not None:
        try:
            for col in ['firme', 'bilanturi']:
                cloud_counts[col] = await cloud_companies_db[col].estimated_document_count()
        except:
            pass
    
    return {
        "mode": "local" if is_using_local_db() else "cloud",
        "local_db": local_health,
        "cloud_counts": cloud_counts,
        "sync_service": sync_service_status
    }


@router.post("/trigger-full")
async def trigger_full_sync(
    request: Request,
    admin_user = Depends(verify_admin)
):
    """
    Trigger full sync of all collections from cloud to local
    This runs in background and may take several minutes for 1.2M+ records
    """
    # Parse request body for cloud_url
    cloud_url = None
    try:
        body = await request.json()
        cloud_url = body.get("cloud_url")
    except:
        pass
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Pass cloud_url to sync service
            payload = {}
            if cloud_url:
                payload["cloud_url"] = cloud_url
                
            response = await client.post(
                f"{SYNC_SERVICE_URL}/sync/full",
                json=payload
            )
            
            if response.status_code == 200:
                return {
                    "status": "started",
                    "message": "Full sync started. Check /api/admin/sync/status for progress."
                }
            elif response.status_code == 409:
                raise HTTPException(status_code=409, detail="Sync already in progress")
            else:
                raise HTTPException(status_code=500, detail=response.text)
                
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503, 
            detail=f"Sync service unavailable: {str(e)}"
        )


@router.post("/trigger-collection/{collection_name}")
async def trigger_collection_sync(
    collection_name: str,
    request: Request,
    admin_user = Depends(verify_admin)
):
    """Trigger sync for a specific collection"""
    allowed_collections = ['firme', 'bilanturi', 'caen_codes', 'postal_codes', 'localities']
    
    if collection_name not in allowed_collections:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid collection. Allowed: {allowed_collections}"
        )
    
    # Parse request body for cloud_url
    cloud_url = None
    try:
        body = await request.json()
        cloud_url = body.get("cloud_url")
    except:
        pass
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {}
            if cloud_url:
                payload["cloud_url"] = cloud_url
                
            response = await client.post(
                f"{SYNC_SERVICE_URL}/sync/collection/{collection_name}",
                json=payload
            )
            
            if response.status_code == 200:
                return {
                    "status": "started",
                    "message": f"Sync started for {collection_name}"
                }
            elif response.status_code == 409:
                raise HTTPException(status_code=409, detail="Sync already in progress")
            else:
                raise HTTPException(status_code=500, detail=response.text)
                
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Sync service unavailable: {str(e)}"
        )


@router.post("/switch-mode")
async def switch_database_mode(
    use_local: bool,
    admin_user = Depends(verify_admin)
):
    """
    Switch between local and cloud database for reads.
    Local DB must have data to be used.
    """
    result = await force_use_local(use_local)
    
    # Log the action
    app_db = get_app_db()
    if app_db is not None:
        from datetime import datetime, timezone
        await app_db.audit_logs.insert_one({
            "admin_id": admin_user["_id"],
            "admin_email": admin_user.get("email"),
            "action": "switch_database_mode",
            "details": {"use_local": use_local, "result": result},
            "created_at": datetime.now(timezone.utc)
        })
    
    return result


@router.get("/health")
async def check_sync_service_health(admin_user = Depends(verify_admin)):
    """Check if sync service is running"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{SYNC_SERVICE_URL}/health")
            return response.json()
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


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
                
                # Get collection stats
                coll_stats = await local_db.command('collStats', col)
                
                stats[col] = {
                    "count": count,
                    "size_mb": round(coll_stats.get('size', 0) / (1024 * 1024), 2),
                    "storage_size_mb": round(coll_stats.get('storageSize', 0) / (1024 * 1024), 2),
                    "indexes": coll_stats.get('nindexes', 0)
                }
            except Exception as e:
                stats[col] = {"error": str(e)}
        
        # Get database stats
        db_stats = await local_db.command('dbStats')
        
        return {
            "database": "mfirme_local",
            "collections": stats,
            "total_size_mb": round(db_stats.get('dataSize', 0) / (1024 * 1024), 2),
            "storage_size_mb": round(db_stats.get('storageSize', 0) / (1024 * 1024), 2),
            "index_size_mb": round(db_stats.get('indexSize', 0) / (1024 * 1024), 2)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
