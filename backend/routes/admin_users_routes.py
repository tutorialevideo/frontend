from fastapi import APIRouter, HTTPException, Depends, Query
from database import get_app_db
from auth import get_current_user
from models import UserUpdateRequest, AuditLogEntry
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/api/admin/users-management", tags=["admin-users"])

async def require_admin(current_user = Depends(get_current_user)):
    """Middleware to ensure user is admin"""
    app_db = get_app_db()
    user = await app_db.users.find_one({"email": current_user["email"]})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user

@router.get("/list")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str = Query(None),
    tier: str = Query(None),
    role: str = Query(None),
    current_user = Depends(require_admin)
):
    """List all users with pagination and filters"""
    app_db = get_app_db()
    
    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    if tier:
        query["tier"] = tier
    if role:
        query["role"] = role
    
    # Get total count
    total = await app_db.users.count_documents(query)
    
    # Get paginated users
    skip = (page - 1) * limit
    users = await app_db.users.find(query).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
    
    # Remove sensitive data
    for user in users:
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/details/{user_id}")
async def get_user_details(
    user_id: str,
    current_user = Depends(require_admin)
):
    """Get detailed user information"""
    app_db = get_app_db()
    
    user = await app_db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    
    # Get user's subscription
    subscription = await app_db.subscriptions.find_one({"user_id": user["_id"]})
    if subscription:
        subscription["_id"] = str(subscription["_id"])
    
    # Get user's payment transactions
    transactions = await app_db.payment_transactions.find(
        {"user_id": ObjectId(user_id)}
    ).sort("created_at", -1).limit(10).to_list(length=10)
    
    for trans in transactions:
        trans["_id"] = str(trans["_id"])
        trans["user_id"] = str(trans["user_id"])
    
    # Get favorites count
    favorites_count = await app_db.favorites.count_documents({"user_id": ObjectId(user_id)})
    
    return {
        "user": user,
        "subscription": subscription,
        "recent_transactions": transactions,
        "favorites_count": favorites_count
    }

@router.put("/update")
async def update_user(
    request: UserUpdateRequest,
    current_user = Depends(require_admin)
):
    """Update user tier, role, or active status"""
    app_db = get_app_db()
    
    user = await app_db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update dict
    update_data = {"updated_at": datetime.now(timezone.utc)}
    changes = {}
    
    if request.tier is not None:
        update_data["tier"] = request.tier
        changes["tier"] = {"from": user.get("tier"), "to": request.tier}
    
    if request.role is not None:
        update_data["role"] = request.role
        changes["role"] = {"from": user.get("role"), "to": request.role}
    
    if request.active is not None:
        update_data["active"] = request.active
        changes["active"] = {"from": user.get("active", True), "to": request.active}
    
    # Update user
    await app_db.users.update_one(
        {"_id": ObjectId(request.user_id)},
        {"$set": update_data}
    )
    
    # Log audit trail
    timestamp = datetime.now(timezone.utc).isoformat()
    audit_entry = {
        "action": "user_update",
        "resource_type": "user",
        "resource_id": request.user_id,
        "admin_email": current_user["email"],
        "changes": changes,
        "timestamp": timestamp,
        "ip_address": None
    }
    await app_db.audit_log.insert_one(audit_entry)
    
    return {"success": True, "message": "User updated successfully"}

@router.delete("/delete/{user_id}")
async def delete_user(
    user_id: str,
    current_user = Depends(require_admin)
):
    """Delete user account (soft delete - mark as inactive)"""
    app_db = get_app_db()
    
    user = await app_db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Soft delete - mark as inactive
    await app_db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "active": False,
            "deleted_at": datetime.now(timezone.utc),
            "deleted_by": current_user["email"]
        }}
    )
    
    # Log audit trail
    timestamp = datetime.now(timezone.utc).isoformat()
    audit_entry = {
        "action": "user_delete",
        "resource_type": "user",
        "resource_id": user_id,
        "admin_email": current_user["email"],
        "changes": {"deleted": True, "email": user["email"]},
        "timestamp": timestamp,
        "ip_address": None
    }
    await app_db.audit_log.insert_one(audit_entry)
    
    return {"success": True, "message": "User deleted successfully"}

@router.post("/restore/{user_id}")
async def restore_user(
    user_id: str,
    current_user = Depends(require_admin)
):
    """Restore a deleted user"""
    app_db = get_app_db()
    
    user = await app_db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Restore user
    await app_db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"active": True},
            "$unset": {"deleted_at": "", "deleted_by": ""}
        }
    )
    
    # Log audit trail
    timestamp = datetime.now(timezone.utc).isoformat()
    audit_entry = {
        "action": "user_restore",
        "resource_type": "user",
        "resource_id": user_id,
        "admin_email": current_user["email"],
        "changes": {"restored": True},
        "timestamp": timestamp,
        "ip_address": None
    }
    await app_db.audit_log.insert_one(audit_entry)
    
    return {"success": True, "message": "User restored successfully"}
