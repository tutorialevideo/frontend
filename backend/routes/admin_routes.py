from fastapi import APIRouter, HTTPException, Depends
from database import get_app_db, get_companies_db
from auth import get_current_user
from bson import ObjectId
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/admin", tags=["admin"])

async def verify_admin(current_user = Depends(get_current_user)):
    """Verify user is admin"""
    db = get_app_db()
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

@router.get("/stats")
async def get_admin_stats(admin_user = Depends(verify_admin)):
    """Get admin dashboard statistics"""
    app_db = get_app_db()
    companies_db = get_companies_db()
    
    # User stats
    total_users = await app_db.users.count_documents({})
    free_users = await app_db.users.count_documents({"tier": "free"})
    plus_users = await app_db.users.count_documents({"tier": "plus"})
    premium_users = await app_db.users.count_documents({"tier": "premium"})
    
    # Registration stats (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_users = await app_db.users.count_documents({
        "created_at": {"$gte": thirty_days_ago}
    })
    
    # Favorites stats
    total_favorites = await app_db.favorites.count_documents({})
    
    # Payment stats
    total_transactions = await app_db.payment_transactions.count_documents({})
    paid_transactions = await app_db.payment_transactions.count_documents({
        "payment_status": "paid"
    })
    
    # Revenue calculation (from paid transactions)
    revenue_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await app_db.payment_transactions.aggregate(revenue_pipeline).to_list(length=1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Companies stats
    total_companies = await companies_db.firme.count_documents({})
    
    return {
        "users": {
            "total": total_users,
            "free": free_users,
            "plus": plus_users,
            "premium": premium_users,
            "new_last_30_days": new_users
        },
        "engagement": {
            "total_favorites": total_favorites,
            "avg_favorites_per_user": round(total_favorites / total_users, 2) if total_users > 0 else 0
        },
        "revenue": {
            "total_transactions": total_transactions,
            "paid_transactions": paid_transactions,
            "total_revenue_ron": round(total_revenue, 2)
        },
        "platform": {
            "total_companies": total_companies
        }
    }

@router.get("/users")
async def get_users(admin_user = Depends(verify_admin), skip: int = 0, limit: int = 50):
    """Get all users (paginated)"""
    app_db = get_app_db()
    
    users = await app_db.users.find().sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await app_db.users.count_documents({})
    
    users_data = []
    for user in users:
        users_data.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "tier": user.get("tier", "free"),
            "role": user.get("role", "user"),
            "created_at": user["created_at"].isoformat()
        })
    
    return {
        "users": users_data,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/transactions")
async def get_transactions(admin_user = Depends(verify_admin), skip: int = 0, limit: int = 50):
    """Get payment transactions"""
    app_db = get_app_db()
    
    transactions = await app_db.payment_transactions.find().sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await app_db.payment_transactions.count_documents({})
    
    trans_data = []
    for trans in transactions:
        trans_data.append({
            "id": str(trans["_id"]),
            "session_id": trans.get("session_id"),
            "amount": trans.get("amount"),
            "currency": trans.get("currency"),
            "plan_id": trans.get("plan_id"),
            "status": trans.get("status"),
            "payment_status": trans.get("payment_status"),
            "user_email": trans.get("metadata", {}).get("user_email"),
            "created_at": trans["created_at"].isoformat()
        })
    
    return {
        "transactions": trans_data,
        "total": total,
        "skip": skip,
        "limit": limit
    }