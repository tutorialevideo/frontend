"""
Public API v1 Routes
External API endpoints for premium users with API keys
"""

from fastapi import APIRouter, HTTPException, Header, Query, Request
from database import get_app_db, get_companies_db
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional, List
import hashlib
import time
import re
from urllib.parse import unquote

router = APIRouter(prefix="/api/v1", tags=["public-api"])

# API Plans with limits
API_PLANS = {
    "basic": {
        "requests_per_day": 100,
        "requests_per_month": 3000,
        "endpoints": ["search", "company"]
    },
    "pro": {
        "requests_per_day": 1000,
        "requests_per_month": 30000,
        "endpoints": ["search", "company", "financials", "bulk"]
    },
    "enterprise": {
        "requests_per_day": 10000,
        "requests_per_month": 300000,
        "endpoints": ["search", "company", "financials", "bulk", "webhooks", "geo", "caen"]
    }
}


def hash_api_key(key: str) -> str:
    """Hash API key for lookup"""
    return hashlib.sha256(key.encode()).hexdigest()


async def validate_api_key(authorization: str = Header(None), request: Request = None) -> dict:
    """Validate API key from Authorization header and check rate limits"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"error": "missing_api_key", "message": "API key required. Use: Authorization: Bearer mf_xxx"}
        )
    
    # Extract key from "Bearer mf_xxx"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_format", "message": "Use format: Authorization: Bearer YOUR_API_KEY"}
        )
    
    api_key = parts[1]
    
    if not api_key.startswith("mf_"):
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_key", "message": "Invalid API key format"}
        )
    
    db = get_app_db()
    key_hash = hash_api_key(api_key)
    
    # Find key
    key_doc = await db.api_keys.find_one({"key_hash": key_hash})
    
    if not key_doc:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_key", "message": "API key not found"}
        )
    
    if not key_doc.get("active", True):
        raise HTTPException(
            status_code=403,
            detail={"error": "key_disabled", "message": "API key is disabled"}
        )
    
    if key_doc.get("revoked"):
        raise HTTPException(
            status_code=403,
            detail={"error": "key_revoked", "message": "API key has been revoked"}
        )
    
    # Check and reset daily/monthly counters
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    this_month = now.strftime("%Y-%m")
    
    updates = {}
    
    if key_doc.get("last_reset_day") != today:
        updates["requests_today"] = 0
        updates["last_reset_day"] = today
        key_doc["requests_today"] = 0
    
    if key_doc.get("last_reset_month") != this_month:
        updates["requests_this_month"] = 0
        updates["last_reset_month"] = this_month
        key_doc["requests_this_month"] = 0
    
    # Get plan limits
    plan_id = key_doc.get("plan_id", "basic")
    plan = API_PLANS.get(plan_id, API_PLANS["basic"])
    
    # Check custom limits (admin can override)
    daily_limit = key_doc.get("custom_requests_per_day", plan["requests_per_day"])
    monthly_limit = key_doc.get("custom_requests_per_month", plan["requests_per_month"])
    
    # Check rate limits
    if key_doc.get("requests_today", 0) >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "daily_limit_exceeded",
                "message": f"Daily limit of {daily_limit} requests exceeded",
                "limit": daily_limit,
                "used": key_doc.get("requests_today", 0),
                "resets_at": f"{today}T23:59:59Z"
            }
        )
    
    if key_doc.get("requests_this_month", 0) >= monthly_limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "monthly_limit_exceeded",
                "message": f"Monthly limit of {monthly_limit} requests exceeded",
                "limit": monthly_limit,
                "used": key_doc.get("requests_this_month", 0)
            }
        )
    
    # Increment counters
    updates["requests_today"] = key_doc.get("requests_today", 0) + 1
    updates["requests_this_month"] = key_doc.get("requests_this_month", 0) + 1
    updates["requests_total"] = key_doc.get("requests_total", 0) + 1
    updates["last_used_at"] = now
    
    await db.api_keys.update_one(
        {"_id": key_doc["_id"]},
        {"$set": updates}
    )
    
    return {
        "key_id": key_doc["_id"],
        "user_id": key_doc.get("user_id"),
        "plan_id": plan_id,
        "plan": plan,
        "requests_remaining_today": daily_limit - updates["requests_today"],
        "requests_remaining_month": monthly_limit - updates["requests_this_month"]
    }


async def log_api_request(
    db, 
    key_info: dict, 
    endpoint: str, 
    method: str, 
    status_code: int, 
    response_time_ms: float,
    request_params: dict = None
):
    """Log API request for analytics"""
    await db.api_request_logs.insert_one({
        "key_id": key_info["key_id"],
        "user_id": key_info["user_id"],
        "endpoint": endpoint,
        "method": method,
        "status_code": status_code,
        "response_time_ms": response_time_ms,
        "request_params": request_params,
        "created_at": datetime.now(timezone.utc)
    })


def serialize_company(doc: dict) -> dict:
    """Serialize company document for API response"""
    if not doc:
        return None
    
    # Remove MongoDB _id
    result = {k: v for k, v in doc.items() if k != "_id"}
    
    # Convert any ObjectId fields to string
    for key, value in result.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
    
    return result


# ============ PUBLIC API ENDPOINTS ============

@router.get("/health")
async def api_health():
    """API health check (no auth required)"""
    return {
        "status": "ok",
        "version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/company/{cui}")
async def get_company(
    cui: str,
    authorization: str = Header(None),
    request: Request = None
):
    """
    Get company profile by CUI
    
    Returns all available data for a company including:
    - Basic info (denumire, adresa, forma juridica)
    - ANAF data (stare, cod CAEN, TVA status)
    - Financial data (cifra afaceri, profit, angajati)
    - Contact info (if available)
    """
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "company" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="Endpoint not available in your plan")
    
    # Normalize CUI
    normalized_cui = cui.strip().upper().replace("RO", "")
    
    # Find company
    company = await companies_db.firme.find_one(
        {"cui": normalized_cui},
        {"_id": 0}  # Exclude _id
    )
    
    response_time = (time.time() - start_time) * 1000
    
    if not company:
        await log_api_request(db, key_info, f"/company/{cui}", "GET", 404, response_time)
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Log request
    await log_api_request(db, key_info, f"/company/{cui}", "GET", 200, response_time, {"cui": cui})
    
    return {
        "success": True,
        "data": serialize_company(company),
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }


@router.get("/company/{cui}/financials")
async def get_company_financials(
    cui: str,
    authorization: str = Header(None),
    request: Request = None
):
    """
    Get multi-year financial data for a company
    
    Returns historical financial data including:
    - Cifra de afaceri (revenue)
    - Profit net
    - Numar angajati
    - Venituri/Cheltuieli totale
    """
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "financials" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="Financials endpoint requires Pro or Enterprise plan")
    
    # Normalize CUI
    normalized_cui = cui.strip().upper().replace("RO", "")
    
    # Find company
    company = await companies_db.firme.find_one({"cui": normalized_cui})
    
    if not company:
        response_time = (time.time() - start_time) * 1000
        await log_api_request(db, key_info, f"/company/{cui}/financials", "GET", 404, response_time)
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get firma_id for bilanturi lookup
    firma_id = company.get("id")
    
    financials = []
    if firma_id:
        bilanturi = await companies_db.bilanturi.find(
            {"firma_id": firma_id},
            {"_id": 0}
        ).sort("an", 1).to_list(length=50)
        
        for bilant in bilanturi:
            an = bilant.get("an")
            if not an or str(an).startswith("WEB_"):
                continue
            
            try:
                year_int = int(an) if isinstance(an, str) else an
            except (ValueError, TypeError):
                continue
            
            financials.append({
                "year": year_int,
                "cifra_afaceri": bilant.get("cifra_afaceri") or bilant.get("venituri_totale"),
                "profit_net": bilant.get("profit_net"),
                "numar_angajati": bilant.get("numar_angajati"),
                "venituri_totale": bilant.get("venituri_totale"),
                "cheltuieli_totale": bilant.get("cheltuieli_totale"),
                "capitaluri_proprii": bilant.get("capitaluri_proprii"),
                "datorii": bilant.get("datorii")
            })
    
    response_time = (time.time() - start_time) * 1000
    await log_api_request(db, key_info, f"/company/{cui}/financials", "GET", 200, response_time, {"cui": cui})
    
    return {
        "success": True,
        "data": {
            "cui": normalized_cui,
            "denumire": company.get("denumire"),
            "financials": financials
        },
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }


@router.get("/search")
async def search_companies(
    q: Optional[str] = None,
    judet: Optional[str] = None,
    localitate: Optional[str] = None,
    caen: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    authorization: str = Header(None),
    request: Request = None
):
    """
    Search companies with filters
    
    Query parameters:
    - q: Search query (company name or CUI)
    - judet: Filter by county
    - localitate: Filter by locality
    - caen: Filter by CAEN code
    - page: Page number (default: 1)
    - limit: Results per page (max: 100)
    """
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "search" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="Search endpoint not available in your plan")
    
    # Build query
    query = {}
    
    if q:
        if q.isdigit():
            query["cui"] = {"$regex": f"^{re.escape(q)}", "$options": "i"}
        else:
            query["denumire"] = {"$regex": re.escape(q), "$options": "i"}
    
    if judet:
        query["judet"] = unquote(judet)
    
    if localitate:
        query["localitate"] = {"$regex": f"^{re.escape(unquote(localitate))}", "$options": "i"}
    
    if caen:
        query["anaf_cod_caen"] = {"$regex": f"^{re.escape(caen)}"}
    
    # Get total count
    total = await companies_db.firme.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * limit
    results = await companies_db.firme.find(
        query,
        {
            "_id": 0,
            "cui": 1,
            "denumire": 1,
            "judet": 1,
            "localitate": 1,
            "forma_juridica": 1,
            "anaf_stare": 1,
            "anaf_cod_caen": 1,
            "mf_cifra_afaceri": 1,
            "mf_numar_angajati": 1,
            "mf_an_bilant": 1
        }
    ).skip(skip).limit(limit).to_list(length=limit)
    
    response_time = (time.time() - start_time) * 1000
    await log_api_request(db, key_info, "/search", "GET", 200, response_time, {
        "q": q, "judet": judet, "localitate": localitate, "caen": caen, "page": page, "limit": limit
    })
    
    return {
        "success": True,
        "data": {
            "results": [serialize_company(r) for r in results],
            "pagination": {
                "total": total,
                "page": page,
                "pages": (total + limit - 1) // limit,
                "limit": limit
            }
        },
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }


@router.post("/companies/bulk")
async def get_companies_bulk(
    cuis: List[str],
    authorization: str = Header(None),
    request: Request = None
):
    """
    Get multiple companies by CUI (bulk request)
    
    Body: List of CUIs (max 100)
    """
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "bulk" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="Bulk endpoint requires Pro or Enterprise plan")
    
    # Limit to 100 CUIs
    if len(cuis) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 CUIs per request")
    
    # Normalize CUIs
    normalized_cuis = [cui.strip().upper().replace("RO", "") for cui in cuis]
    
    # Find companies
    companies = await companies_db.firme.find(
        {"cui": {"$in": normalized_cuis}},
        {"_id": 0}
    ).to_list(length=100)
    
    response_time = (time.time() - start_time) * 1000
    await log_api_request(db, key_info, "/companies/bulk", "POST", 200, response_time, {"count": len(cuis)})
    
    # Create a map for easy lookup
    found_cuis = {c["cui"]: serialize_company(c) for c in companies}
    
    # Return in same order as requested, with None for not found
    results = []
    for cui in normalized_cuis:
        if cui in found_cuis:
            results.append({"cui": cui, "found": True, "data": found_cuis[cui]})
        else:
            results.append({"cui": cui, "found": False, "data": None})
    
    return {
        "success": True,
        "data": {
            "results": results,
            "found": len(companies),
            "not_found": len(cuis) - len(companies)
        },
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }


@router.get("/geo/judete")
async def get_judete(
    authorization: str = Header(None),
    request: Request = None
):
    """Get list of all counties with company counts"""
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "geo" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="Geo endpoint requires Enterprise plan")
    
    pipeline = [
        {"$group": {"_id": "$judet", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"_id": 1}},
        {"$project": {"judet": "$_id", "count": 1, "_id": 0}}
    ]
    
    judete = await companies_db.firme.aggregate(pipeline).to_list(length=100)
    
    response_time = (time.time() - start_time) * 1000
    await log_api_request(db, key_info, "/geo/judete", "GET", 200, response_time)
    
    return {
        "success": True,
        "data": judete,
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }


@router.get("/geo/localitati")
async def get_localitati(
    judet: str,
    limit: int = Query(100, ge=1, le=500),
    authorization: str = Header(None),
    request: Request = None
):
    """Get localities for a county with company counts"""
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "geo" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="Geo endpoint requires Enterprise plan")
    
    pipeline = [
        {"$match": {"judet": unquote(judet)}},
        {"$group": {"_id": "$localitate", "count": {"$sum": 1}}},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {"localitate": "$_id", "count": 1, "_id": 0}}
    ]
    
    localitati = await companies_db.firme.aggregate(pipeline).to_list(length=limit)
    
    response_time = (time.time() - start_time) * 1000
    await log_api_request(db, key_info, "/geo/localitati", "GET", 200, response_time, {"judet": judet})
    
    return {
        "success": True,
        "data": localitati,
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }


@router.get("/caen/{code}")
async def get_companies_by_caen(
    code: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    authorization: str = Header(None),
    request: Request = None
):
    """Get companies by CAEN code"""
    start_time = time.time()
    db = get_app_db()
    companies_db = get_companies_db()
    
    # Validate API key
    key_info = await validate_api_key(authorization, request)
    
    # Check endpoint access
    if "caen" not in key_info["plan"]["endpoints"]:
        raise HTTPException(status_code=403, detail="CAEN endpoint requires Enterprise plan")
    
    query = {"anaf_cod_caen": {"$regex": f"^{re.escape(code)}"}}
    
    total = await companies_db.firme.count_documents(query)
    
    skip = (page - 1) * limit
    results = await companies_db.firme.find(
        query,
        {"_id": 0, "cui": 1, "denumire": 1, "judet": 1, "localitate": 1, "anaf_cod_caen": 1, "mf_cifra_afaceri": 1}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    # Get CAEN description
    caen_info = await companies_db.caen_codes.find_one(
        {"cod": code[:4]},
        {"_id": 0}
    )
    
    response_time = (time.time() - start_time) * 1000
    await log_api_request(db, key_info, f"/caen/{code}", "GET", 200, response_time, {"page": page, "limit": limit})
    
    return {
        "success": True,
        "data": {
            "caen_code": code,
            "caen_info": caen_info,
            "results": [serialize_company(r) for r in results],
            "pagination": {
                "total": total,
                "page": page,
                "pages": (total + limit - 1) // limit,
                "limit": limit
            }
        },
        "meta": {
            "requests_remaining_today": key_info["requests_remaining_today"],
            "requests_remaining_month": key_info["requests_remaining_month"]
        }
    }
