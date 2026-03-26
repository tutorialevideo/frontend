"""
API Keys Management Routes
Handles API key generation, management, and usage tracking for premium users
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from database import get_app_db
from auth import get_current_user
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, List
import secrets
import hashlib

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])

# API Plans Configuration
API_PLANS = {
    "basic": {
        "id": "basic",
        "name": "Basic API",
        "price": 29.99,
        "currency": "RON",
        "interval": "month",
        "requests_per_day": 100,
        "requests_per_month": 3000,
        "features": ["Căutare firme", "Profil firmă", "Date de bază"],
        "endpoints": ["search", "company"]
    },
    "pro": {
        "id": "pro",
        "name": "Pro API",
        "price": 99.99,
        "currency": "RON",
        "interval": "month",
        "requests_per_day": 1000,
        "requests_per_month": 30000,
        "features": ["Toate din Basic", "Date financiare", "Bulk requests (100)", "Export JSON"],
        "endpoints": ["search", "company", "financials", "bulk"]
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise API",
        "price": 299.99,
        "currency": "RON",
        "interval": "month",
        "requests_per_day": 10000,
        "requests_per_month": 300000,
        "features": ["Toate din Pro", "Webhooks", "Acces prioritar", "Suport dedicat"],
        "endpoints": ["search", "company", "financials", "bulk", "webhooks", "geo", "caen"]
    }
}


class CreateApiKeyRequest(BaseModel):
    name: str
    plan_id: str


class UpdateApiKeyRequest(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None


def generate_api_key() -> str:
    """Generate a secure API key"""
    return f"mf_{secrets.token_urlsafe(32)}"


def hash_api_key(key: str) -> str:
    """Hash API key for storage"""
    return hashlib.sha256(key.encode()).hexdigest()


async def get_api_key_by_key(db, api_key: str) -> Optional[dict]:
    """Find API key record by raw key"""
    key_hash = hash_api_key(api_key)
    return await db.api_keys.find_one({"key_hash": key_hash})


@router.get("/plans")
async def get_api_plans():
    """Get available API plans"""
    return {"plans": list(API_PLANS.values())}


@router.get("/my-keys")
async def get_my_api_keys(current_user = Depends(get_current_user)):
    """Get all API keys for current user"""
    db = get_app_db()
    
    keys = await db.api_keys.find(
        {"user_id": ObjectId(current_user["user_id"])},
        {"key_hash": 0}  # Don't return hash
    ).sort("created_at", -1).to_list(length=100)
    
    result = []
    for key in keys:
        plan = API_PLANS.get(key.get("plan_id"), API_PLANS["basic"])
        result.append({
            "id": str(key["_id"]),
            "name": key.get("name"),
            "key_preview": key.get("key_preview"),  # First 8 chars + "..."
            "plan_id": key.get("plan_id"),
            "plan_name": plan["name"],
            "active": key.get("active", True),
            "requests_today": key.get("requests_today", 0),
            "requests_this_month": key.get("requests_this_month", 0),
            "requests_per_day": plan["requests_per_day"],
            "requests_per_month": plan["requests_per_month"],
            "last_used_at": key.get("last_used_at").isoformat() if key.get("last_used_at") else None,
            "created_at": key.get("created_at").isoformat() if key.get("created_at") else None,
            "expires_at": key.get("expires_at").isoformat() if key.get("expires_at") else None
        })
    
    return {"keys": result}


@router.post("/create")
async def create_api_key(request: CreateApiKeyRequest, current_user = Depends(get_current_user)):
    """Create a new API key"""
    db = get_app_db()
    
    # Validate plan
    if request.plan_id not in API_PLANS:
        raise HTTPException(status_code=400, detail="Invalid API plan")
    
    plan = API_PLANS[request.plan_id]
    
    # Check if user already has active subscription for this plan
    existing_subscription = await db.api_subscriptions.find_one({
        "user_id": ObjectId(current_user["user_id"]),
        "plan_id": request.plan_id,
        "status": "active"
    })
    
    # For now, allow creating keys even without subscription (will be enforced later with Stripe)
    # In production, uncomment the check below
    # if not existing_subscription:
    #     raise HTTPException(status_code=402, detail="Active subscription required for this plan")
    
    # Generate key
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)
    key_preview = raw_key[:12] + "..." + raw_key[-4:]
    
    # Create key record
    now = datetime.now(timezone.utc)
    key_doc = {
        "user_id": ObjectId(current_user["user_id"]),
        "user_email": current_user["email"],
        "name": request.name,
        "key_hash": key_hash,
        "key_preview": key_preview,
        "plan_id": request.plan_id,
        "active": True,
        "requests_today": 0,
        "requests_this_month": 0,
        "requests_total": 0,
        "last_reset_day": now.strftime("%Y-%m-%d"),
        "last_reset_month": now.strftime("%Y-%m"),
        "created_at": now,
        "last_used_at": None,
        "expires_at": None  # Set when subscription expires
    }
    
    result = await db.api_keys.insert_one(key_doc)
    
    # Return the raw key ONLY on creation (user must save it)
    return {
        "success": True,
        "key_id": str(result.inserted_id),
        "api_key": raw_key,  # Only shown once!
        "key_preview": key_preview,
        "plan": plan,
        "message": "Salvează această cheie! Nu o vei mai putea vedea din nou."
    }


@router.put("/{key_id}")
async def update_api_key(
    key_id: str,
    request: UpdateApiKeyRequest,
    current_user = Depends(get_current_user)
):
    """Update API key (name, active status)"""
    db = get_app_db()
    
    # Find key
    key = await db.api_keys.find_one({
        "_id": ObjectId(key_id),
        "user_id": ObjectId(current_user["user_id"])
    })
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Build update
    update = {}
    if request.name is not None:
        update["name"] = request.name
    if request.active is not None:
        update["active"] = request.active
    
    if update:
        update["updated_at"] = datetime.now(timezone.utc)
        await db.api_keys.update_one(
            {"_id": ObjectId(key_id)},
            {"$set": update}
        )
    
    return {"success": True, "message": "API key updated"}


@router.delete("/{key_id}")
async def delete_api_key(key_id: str, current_user = Depends(get_current_user)):
    """Delete (revoke) an API key"""
    db = get_app_db()
    
    # Find key
    key = await db.api_keys.find_one({
        "_id": ObjectId(key_id),
        "user_id": ObjectId(current_user["user_id"])
    })
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Soft delete (mark as revoked)
    await db.api_keys.update_one(
        {"_id": ObjectId(key_id)},
        {
            "$set": {
                "active": False,
                "revoked": True,
                "revoked_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"success": True, "message": "API key revoked"}


@router.post("/{key_id}/regenerate")
async def regenerate_api_key(key_id: str, current_user = Depends(get_current_user)):
    """Regenerate an API key (creates new key, invalidates old)"""
    db = get_app_db()
    
    # Find key
    key = await db.api_keys.find_one({
        "_id": ObjectId(key_id),
        "user_id": ObjectId(current_user["user_id"])
    })
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Generate new key
    raw_key = generate_api_key()
    key_hash = hash_api_key(raw_key)
    key_preview = raw_key[:12] + "..." + raw_key[-4:]
    
    # Update
    await db.api_keys.update_one(
        {"_id": ObjectId(key_id)},
        {
            "$set": {
                "key_hash": key_hash,
                "key_preview": key_preview,
                "regenerated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "api_key": raw_key,
        "key_preview": key_preview,
        "message": "Cheie regenerată! Salvează noua cheie."
    }


@router.get("/{key_id}/usage")
async def get_api_key_usage(key_id: str, current_user = Depends(get_current_user)):
    """Get detailed usage stats for an API key"""
    db = get_app_db()
    
    # Find key
    key = await db.api_keys.find_one({
        "_id": ObjectId(key_id),
        "user_id": ObjectId(current_user["user_id"])
    })
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    plan = API_PLANS.get(key.get("plan_id"), API_PLANS["basic"])
    
    # Get recent requests from logs
    recent_requests = await db.api_request_logs.find(
        {"key_id": ObjectId(key_id)}
    ).sort("created_at", -1).limit(50).to_list(length=50)
    
    return {
        "key_id": key_id,
        "name": key.get("name"),
        "plan": plan,
        "usage": {
            "today": key.get("requests_today", 0),
            "this_month": key.get("requests_this_month", 0),
            "total": key.get("requests_total", 0),
            "limit_day": plan["requests_per_day"],
            "limit_month": plan["requests_per_month"]
        },
        "recent_requests": [
            {
                "endpoint": r.get("endpoint"),
                "method": r.get("method"),
                "status_code": r.get("status_code"),
                "response_time_ms": r.get("response_time_ms"),
                "created_at": r.get("created_at").isoformat() if r.get("created_at") else None
            }
            for r in recent_requests
        ]
    }


# ============ ADMIN ROUTES ============

@router.get("/admin/all")
async def admin_get_all_api_keys(current_user = Depends(get_current_user)):
    """Admin: Get all API keys"""
    db = get_app_db()
    
    # Check admin role
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    keys = await db.api_keys.find(
        {},
        {"key_hash": 0}
    ).sort("created_at", -1).to_list(length=1000)
    
    result = []
    for key in keys:
        plan = API_PLANS.get(key.get("plan_id"), API_PLANS["basic"])
        result.append({
            "id": str(key["_id"]),
            "user_id": str(key.get("user_id")),
            "user_email": key.get("user_email"),
            "name": key.get("name"),
            "key_preview": key.get("key_preview"),
            "plan_id": key.get("plan_id"),
            "plan_name": plan["name"],
            "active": key.get("active", True),
            "revoked": key.get("revoked", False),
            "requests_today": key.get("requests_today", 0),
            "requests_this_month": key.get("requests_this_month", 0),
            "requests_total": key.get("requests_total", 0),
            "last_used_at": key.get("last_used_at").isoformat() if key.get("last_used_at") else None,
            "created_at": key.get("created_at").isoformat() if key.get("created_at") else None
        })
    
    # Get stats
    total_keys = len(result)
    active_keys = sum(1 for k in result if k["active"] and not k.get("revoked"))
    total_requests_today = sum(k["requests_today"] for k in result)
    
    return {
        "keys": result,
        "stats": {
            "total_keys": total_keys,
            "active_keys": active_keys,
            "total_requests_today": total_requests_today
        }
    }


@router.put("/admin/{key_id}/toggle")
async def admin_toggle_api_key(key_id: str, current_user = Depends(get_current_user)):
    """Admin: Toggle API key active status"""
    db = get_app_db()
    
    # Check admin role
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    key = await db.api_keys.find_one({"_id": ObjectId(key_id)})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    new_status = not key.get("active", True)
    
    await db.api_keys.update_one(
        {"_id": ObjectId(key_id)},
        {"$set": {"active": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "active": new_status}


@router.put("/admin/{key_id}/adjust-limits")
async def admin_adjust_limits(
    key_id: str,
    requests_per_day: Optional[int] = None,
    requests_per_month: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    """Admin: Manually adjust rate limits for a key"""
    db = get_app_db()
    
    # Check admin role
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    key = await db.api_keys.find_one({"_id": ObjectId(key_id)})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    update = {"updated_at": datetime.now(timezone.utc)}
    if requests_per_day is not None:
        update["custom_requests_per_day"] = requests_per_day
    if requests_per_month is not None:
        update["custom_requests_per_month"] = requests_per_month
    
    await db.api_keys.update_one(
        {"_id": ObjectId(key_id)},
        {"$set": update}
    )
    
    return {"success": True, "message": "Limits adjusted"}
