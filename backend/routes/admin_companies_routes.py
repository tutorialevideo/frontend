from fastapi import APIRouter, HTTPException, Depends
from database import get_app_db, get_readonly_db
from auth import get_current_user
from models import (
    CompanySearchRequest, CompanyOverrideRequest, 
    FieldVisibilityRequest, SEOMetadata, AuditLogEntry
)
from datetime import datetime, timezone
from bson import ObjectId
import re

router = APIRouter(prefix="/api/admin/companies", tags=["admin-companies"])

async def require_admin(current_user = Depends(get_current_user)):
    """Middleware to ensure user is admin"""
    app_db = get_app_db()
    user = await app_db.users.find_one({"email": current_user["email"]})
    
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user

@router.post("/search")
async def search_companies(
    request: CompanySearchRequest,
    current_user = Depends(require_admin)
):
    """Search companies by CUI or name (admin only)"""
    readonly_db = get_readonly_db()
    
    query = request.query.strip()
    
    # If empty query, return first N companies
    if not query:
        cursor = readonly_db.firme.find({}).limit(request.limit)
    # Try to search by CUI first (exact match, faster)
    elif query.isdigit():
        cursor = readonly_db.firme.find(
            {"cui": query}
        ).limit(request.limit)
    else:
        # Search by company name (regex, slower but necessary)
        cursor = readonly_db.firme.find(
            {"denumire": {"$regex": f"^{query}", "$options": "i"}}  # Start with query for better performance
        ).limit(request.limit)
    
    # Convert to list efficiently
    companies = []
    async for company in cursor:
        company["_id"] = str(company["_id"])
        companies.append(company)
    
    return {"companies": companies, "count": len(companies)}

@router.get("/details/{cui}")
async def get_company_details(
    cui: str,
    current_user = Depends(require_admin)
):
    """Get complete company details with overrides and visibility settings"""
    readonly_db = get_readonly_db()
    app_db = get_app_db()
    
    # Get raw company data
    company = await readonly_db.firme.find_one({"cui": cui})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company["_id"] = str(company["_id"])
    
    # Get overrides
    overrides = await app_db.company_overrides.find({"cui": cui}).to_list(length=1000)
    for override in overrides:
        override["_id"] = str(override["_id"])
    
    # Get field visibility settings
    visibility = await app_db.field_visibility.find({"cui": cui}).to_list(length=1000)
    for vis in visibility:
        vis["_id"] = str(vis["_id"])
    
    # Get SEO metadata
    seo = await app_db.seo_metadata.find_one({"cui": cui})
    if seo:
        seo["_id"] = str(seo["_id"])
    
    return {
        "raw_data": company,
        "overrides": overrides,
        "field_visibility": visibility,
        "seo_metadata": seo
    }

@router.post("/override")
async def update_company_override(
    request: CompanyOverrideRequest,
    current_user = Depends(require_admin)
):
    """Update company data overrides (saves separately, doesn't modify raw data)"""
    app_db = get_app_db()
    
    # Verify company exists
    readonly_db = get_readonly_db()
    company = await readonly_db.firme.find_one({"cui": request.cui})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    timestamp = datetime.now(timezone.utc).isoformat()
    admin_email = current_user["email"]
    
    # Save each override
    for field_name, new_value in request.overrides.items():
        override_doc = {
            "cui": request.cui,
            "field_name": field_name,
            "override_value": new_value,
            "notes": request.notes,
            "updated_by": admin_email,
            "updated_at": timestamp
        }
        
        # Upsert override
        await app_db.company_overrides.update_one(
            {"cui": request.cui, "field_name": field_name},
            {"$set": override_doc},
            upsert=True
        )
        
        # Log audit trail
        audit_entry = {
            "action": "company_override",
            "resource_type": "company",
            "resource_id": request.cui,
            "admin_email": admin_email,
            "changes": {
                "field": field_name,
                "new_value": new_value
            },
            "timestamp": timestamp,
            "ip_address": None  # Can be added from request
        }
        await app_db.audit_log.insert_one(audit_entry)
    
    return {"success": True, "message": f"Updated {len(request.overrides)} fields"}

@router.post("/field-visibility")
async def set_field_visibility(
    request: FieldVisibilityRequest,
    current_user = Depends(require_admin)
):
    """Set field visibility (public, premium, or hidden)"""
    app_db = get_app_db()
    
    timestamp = datetime.now(timezone.utc).isoformat()
    admin_email = current_user["email"]
    
    visibility_doc = {
        "cui": request.cui,
        "field_name": request.field_name,
        "visibility": request.visibility,
        "updated_by": admin_email,
        "updated_at": timestamp
    }
    
    # Upsert visibility setting
    await app_db.field_visibility.update_one(
        {"cui": request.cui, "field_name": request.field_name},
        {"$set": visibility_doc},
        upsert=True
    )
    
    # Log audit trail
    audit_entry = {
        "action": "field_visibility_change",
        "resource_type": "company",
        "resource_id": request.cui,
        "admin_email": admin_email,
        "changes": {
            "field": request.field_name,
            "visibility": request.visibility
        },
        "timestamp": timestamp,
        "ip_address": None
    }
    await app_db.audit_log.insert_one(audit_entry)
    
    return {"success": True, "message": f"Field {request.field_name} set to {request.visibility}"}

@router.post("/seo/{cui}")
async def update_seo_metadata(
    cui: str,
    seo_data: SEOMetadata,
    current_user = Depends(require_admin)
):
    """Update SEO metadata for a company"""
    app_db = get_app_db()
    
    timestamp = datetime.now(timezone.utc).isoformat()
    admin_email = current_user["email"]
    
    seo_doc = {
        "cui": cui,
        "meta_title": seo_data.meta_title,
        "meta_description": seo_data.meta_description,
        "seo_text": seo_data.seo_text,
        "keywords": seo_data.keywords,
        "updated_by": admin_email,
        "updated_at": timestamp
    }
    
    # Upsert SEO metadata
    await app_db.seo_metadata.update_one(
        {"cui": cui},
        {"$set": seo_doc},
        upsert=True
    )
    
    # Log audit trail
    audit_entry = {
        "action": "seo_metadata_update",
        "resource_type": "company",
        "resource_id": cui,
        "admin_email": admin_email,
        "changes": seo_doc,
        "timestamp": timestamp,
        "ip_address": None
    }
    await app_db.audit_log.insert_one(audit_entry)
    
    return {"success": True, "message": "SEO metadata updated"}

@router.get("/computed-profile/{cui}")
async def get_computed_profile(
    cui: str,
    user_tier: str = "free"
):
    """Get computed company profile (raw data + overrides + field visibility)"""
    readonly_db = get_readonly_db()
    app_db = get_app_db()
    
    # Get raw data
    company = await readonly_db.firme.find_one({"cui": cui})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company["_id"] = str(company["_id"])
    
    # Get all overrides
    overrides = await app_db.company_overrides.find({"cui": cui}).to_list(length=1000)
    override_map = {o["field_name"]: o["override_value"] for o in overrides}
    
    # Get field visibility
    visibility_list = await app_db.field_visibility.find({"cui": cui}).to_list(length=1000)
    visibility_map = {v["field_name"]: v["visibility"] for v in visibility_list}
    
    # Merge data: apply overrides
    computed = company.copy()
    for field_name, override_value in override_map.items():
        computed[field_name] = override_value
    
    # Apply field visibility and masking
    for field_name, visibility in visibility_map.items():
        if visibility == "hidden":
            # Remove field entirely
            computed.pop(field_name, None)
        elif visibility == "premium" and user_tier == "free":
            # Mask premium fields for free users
            if field_name in computed:
                value = str(computed[field_name])
                if len(value) > 4:
                    computed[field_name] = value[:3] + "***"
                else:
                    computed[field_name] = "***"
    
    return computed
