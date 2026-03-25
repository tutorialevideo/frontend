from fastapi import APIRouter, HTTPException, Depends
from database import get_app_db, get_companies_db
from auth import get_current_user
from models import UserProfileUpdate, UserResponse, FavoriteResponse, SearchHistoryResponse
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/user", tags=["user"])

@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user = Depends(get_current_user)):
    """Get user profile"""
    db = get_app_db()
    
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        tier=user.get("tier", "free"),
        created_at=user["created_at"].isoformat()
    )

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user = Depends(get_current_user)
):
    """Update user profile"""
    db = get_app_db()
    
    update_data = {}
    if profile_data.name:
        update_data["name"] = profile_data.name
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        await db.users.update_one(
            {"_id": ObjectId(current_user["user_id"])},
            {"$set": update_data}
        )
    
    # Return updated user
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        tier=user.get("tier", "free"),
        created_at=user["created_at"].isoformat()
    )

@router.get("/favorites")
async def get_favorites(current_user = Depends(get_current_user)):
    """Get user's favorite companies"""
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Get favorites
    favorites = await db.favorites.find(
        {"user_id": ObjectId(current_user["user_id"])}
    ).sort("created_at", -1).to_list(length=100)
    
    # Get company details
    result = []
    for fav in favorites:
        company = await companies_db.firme.find_one({"cui": fav["company_cui"]})
        if company:
            result.append({
                "id": str(fav["_id"]),
                "company_id": fav["company_cui"],
                "company_name": company.get("denumire"),
                "company_cui": company.get("cui"),
                "company_judet": company.get("judet"),
                "company_localitate": company.get("localitate"),
                "created_at": fav["created_at"].isoformat()
            })
    
    return {"favorites": result}

@router.post("/favorites/{company_cui}")
async def add_favorite(
    company_cui: str,
    current_user = Depends(get_current_user)
):
    """Add company to favorites"""
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Check if company exists
    company = await companies_db.firme.find_one({"cui": company_cui})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if already favorited
    existing = await db.favorites.find_one({
        "user_id": ObjectId(current_user["user_id"]),
        "company_cui": company_cui
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Company already in favorites")
    
    # Add favorite
    favorite = {
        "user_id": ObjectId(current_user["user_id"]),
        "company_cui": company_cui,
        "company_name": company.get("denumire"),
        "created_at": datetime.utcnow()
    }
    
    result = await db.favorites.insert_one(favorite)
    
    return {
        "id": str(result.inserted_id),
        "message": "Company added to favorites"
    }

@router.delete("/favorites/{company_cui}")
async def remove_favorite(
    company_cui: str,
    current_user = Depends(get_current_user)
):
    """Remove company from favorites"""
    db = get_app_db()
    
    result = await db.favorites.delete_one({
        "user_id": ObjectId(current_user["user_id"]),
        "company_cui": company_cui
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"message": "Company removed from favorites"}

@router.get("/search-history")
async def get_search_history(current_user = Depends(get_current_user)):
    """Get user's search history"""
    db = get_app_db()
    
    history = await db.search_history.find(
        {"user_id": ObjectId(current_user["user_id"])}
    ).sort("created_at", -1).limit(50).to_list(length=50)
    
    return {
        "history": [
            {
                "query": h["query"],
                "created_at": h["created_at"].isoformat()
            }
            for h in history
        ]
    }

@router.post("/search-history")
async def add_search_history(
    query: str,
    current_user = Depends(get_current_user)
):
    """Add search query to history"""
    db = get_app_db()
    
    # Don't add duplicate consecutive searches
    last_search = await db.search_history.find_one(
        {"user_id": ObjectId(current_user["user_id"])},
        sort=[("created_at", -1)]
    )
    
    if last_search and last_search.get("query") == query:
        return {"message": "Search already in history"}
    
    # Add to history
    await db.search_history.insert_one({
        "user_id": ObjectId(current_user["user_id"]),
        "query": query,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Search added to history"}
