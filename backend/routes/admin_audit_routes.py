from fastapi import APIRouter, HTTPException, Depends, Query
from database import get_app_db
from auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admin/audit", tags=["admin-audit"])

async def require_admin(current_user = Depends(get_current_user)):
    """Middleware to ensure user is admin"""
    app_db = get_app_db()
    user = await app_db.users.find_one({"email": current_user["email"]})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user

@router.get("/logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    action: str = Query(None),
    resource_type: str = Query(None),
    admin_email: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    current_user = Depends(require_admin)
):
    """Get audit logs with filters and pagination"""
    app_db = get_app_db()
    
    # Build query
    query = {}
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    if admin_email:
        query["admin_email"] = admin_email
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = start_date
        if end_date:
            query["timestamp"]["$lte"] = end_date
    
    # Get total count
    total = await app_db.audit_log.count_documents(query)
    
    # Get paginated logs
    skip = (page - 1) * limit
    logs = await app_db.audit_log.find(query).skip(skip).limit(limit).sort("timestamp", -1).to_list(length=limit)
    
    # Convert ObjectId to string
    for log in logs:
        log["_id"] = str(log["_id"])
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/stats")
async def get_audit_stats(
    current_user = Depends(require_admin)
):
    """Get audit log statistics"""
    app_db = get_app_db()
    
    # Count by action type
    action_counts = await app_db.audit_log.aggregate([
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(length=100)
    
    # Count by admin
    admin_counts = await app_db.audit_log.aggregate([
        {"$group": {"_id": "$admin_email", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(length=10)
    
    # Count by resource type
    resource_counts = await app_db.audit_log.aggregate([
        {"$group": {"_id": "$resource_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(length=100)
    
    return {
        "by_action": action_counts,
        "by_admin": admin_counts,
        "by_resource_type": resource_counts
    }
