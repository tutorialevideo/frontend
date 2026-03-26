"""
Sync Service API
Expune endpoint-uri pentru controlul sincronizării din Admin panel
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from sync_service import sync_service
import uvicorn

app = FastAPI(title="mFirme Sync Service API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SyncRequest(BaseModel):
    cloud_url: Optional[str] = None


@app.on_event("startup")
async def startup():
    """Initialize sync service on startup"""
    await sync_service.connect()


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    await sync_service.close()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "sync-service"}


@app.get("/status")
async def get_sync_status():
    """Get current sync status for all collections"""
    return await sync_service.get_sync_status()


@app.post("/sync/full")
async def trigger_full_sync(background_tasks: BackgroundTasks, request: Request = None):
    """Trigger full sync of all collections (runs in background)"""
    if sync_service.is_running:
        raise HTTPException(status_code=409, detail="Sync already in progress")
    
    # Get cloud_url from request if provided
    cloud_url = None
    try:
        body = await request.json()
        cloud_url = body.get("cloud_url")
    except:
        pass
    
    # Update cloud URL if provided
    if cloud_url:
        await sync_service.set_cloud_url(cloud_url)
    
    background_tasks.add_task(sync_service.full_sync_all)
    
    return {
        "status": "started",
        "message": "Full sync started in background",
        "collections": sync_service.sync_status.get('collections', {})
    }


@app.post("/sync/collection/{collection_name}")
async def trigger_collection_sync(
    collection_name: str, 
    background_tasks: BackgroundTasks,
    request: Request = None
):
    """Trigger sync for a specific collection"""
    if sync_service.is_running:
        raise HTTPException(status_code=409, detail="Sync already in progress")
    
    # Get cloud_url from request if provided
    cloud_url = None
    try:
        body = await request.json()
        cloud_url = body.get("cloud_url")
    except:
        pass
    
    # Update cloud URL if provided
    if cloud_url:
        await sync_service.set_cloud_url(cloud_url)
    
    background_tasks.add_task(sync_service.full_sync_collection, collection_name)
    
    return {
        "status": "started",
        "message": f"Sync started for collection: {collection_name}"
    }


@app.post("/config/cloud-url")
async def set_cloud_url(request: SyncRequest):
    """Set the cloud MongoDB URL"""
    if not request.cloud_url:
        raise HTTPException(status_code=400, detail="cloud_url is required")
    
    await sync_service.set_cloud_url(request.cloud_url)
    return {"status": "ok", "message": "Cloud URL updated"}


@app.get("/stats")
async def get_local_stats():
    """Get statistics about local database"""
    try:
        stats = {}
        for collection in ['firme', 'bilanturi', 'caen_codes', 'postal_codes', 'localities']:
            try:
                count = await sync_service.local_db[collection].count_documents({})
                stats[collection] = count
            except:
                stats[collection] = 0
        
        return {
            "local_database": "mfirme_local",
            "collections": stats,
            "total_documents": sum(stats.values())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
