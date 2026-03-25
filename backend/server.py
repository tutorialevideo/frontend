from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from contextlib import asynccontextmanager
from database import connect_to_databases, close_database_connections, get_companies_db
from utils import compute_company_profile, serialize_doc, normalize_cui, create_company_slug
from typing import Optional, List
import re
import os
from urllib.parse import unquote
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_databases()
    yield
    # Shutdown
    await close_database_connections()

app = FastAPI(title="mFirme API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "mFirme API is running"}

@app.get("/api/search/suggest")
async def search_suggest(q: str = Query(..., min_length=2)):
    """Autocomplete suggestions for search"""
    db = get_companies_db()
    
    # Create regex pattern for case-insensitive search
    pattern = re.compile(f"^{re.escape(q)}", re.IGNORECASE)
    cui_pattern = re.compile(f"^{re.escape(q)}")
    
    # Search by company name and CUI
    suggestions = []
    
    # Search by name
    name_results = await db.firme.find(
        {"denumire": {"$regex": pattern}},
        {"denumire": 1, "cui": 1, "judet": 1, "localitate": 1}
    ).limit(5).to_list(length=5)
    
    for result in name_results:
        suggestions.append({
            "type": "company",
            "label": result["denumire"],
            "cui": result.get("cui"),
            "location": f"{result.get('localitate', '')}, {result.get('judet', '')}",
            "slug": create_company_slug(result["denumire"], result.get("cui", ""))
        })
    
    # Search by CUI if query is numeric
    if q.isdigit() and len(suggestions) < 10:
        cui_results = await db.firme.find(
            {"cui": {"$regex": cui_pattern}},
            {"denumire": 1, "cui": 1, "judet": 1, "localitate": 1}
        ).limit(5).to_list(length=5)
        
        for result in cui_results:
            if result["cui"] not in [s.get("cui") for s in suggestions]:
                suggestions.append({
                    "type": "company",
                    "label": result["denumire"],
                    "cui": result.get("cui"),
                    "location": f"{result.get('localitate', '')}, {result.get('judet', '')}",
                    "slug": create_company_slug(result["denumire"], result.get("cui", ""))
                })
    
    return {"suggestions": suggestions[:10]}

@app.get("/api/search")
async def search_companies(
    q: Optional[str] = None,
    judet: Optional[str] = None,
    localitate: Optional[str] = None,
    caen: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Search companies with filters"""
    db = get_companies_db()
    
    # Build query
    query = {}
    
    if q:
        # Search by name or CUI
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
    total = await db.firme.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * limit
    results = await db.firme.find(query).skip(skip).limit(limit).to_list(length=limit)
    
    # Process results
    companies = []
    for result in results:
        profile = compute_company_profile(result, tier="public")
        companies.append({
            "slug": profile["slug"],
            "cui": result.get("cui"),
            "denumire": result.get("denumire"),
            "judet": result.get("judet"),
            "localitate": result.get("localitate"),
            "forma_juridica": result.get("forma_juridica"),
            "anaf_stare": result.get("anaf_stare"),
            "anaf_cod_caen": result.get("anaf_cod_caen"),
            "mf_cifra_afaceri": result.get("mf_cifra_afaceri"),
            "mf_numar_angajati": result.get("mf_numar_angajati"),
            "mf_an_bilant": result.get("mf_an_bilant"),
        })
    
    return {
        "results": companies,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "limit": limit
    }

@app.get("/api/company/cui/{cui}")
async def get_company_by_cui(cui: str):
    """Get company by CUI"""
    db = get_companies_db()
    
    normalized_cui = normalize_cui(cui)
    result = await db.firme.find_one({"cui": normalized_cui})
    
    if not result:
        raise HTTPException(status_code=404, detail="Company not found")
    
    profile = compute_company_profile(result, tier="public")
    return serialize_doc(profile)

@app.get("/api/company/slug/{slug}")
async def get_company_by_slug(slug: str):
    """Get company by slug"""
    db = get_companies_db()
    
    # Extract CUI from slug (last part after last dash)
    parts = slug.rsplit("-", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid slug format")
    
    cui = parts[1]
    normalized_cui = normalize_cui(cui)
    
    result = await db.firme.find_one({"cui": normalized_cui})
    
    if not result:
        raise HTTPException(status_code=404, detail="Company not found")
    
    profile = compute_company_profile(result, tier="public")
    return serialize_doc(profile)

@app.get("/api/geo/judete")
async def get_judete():
    """Get list of all counties (judete)"""
    db = get_companies_db()
    
    # Get distinct judete with company counts
    pipeline = [
        {"$group": {
            "_id": "$judet",
            "count": {"$sum": 1}
        }},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"_id": 1}},
        {"$project": {
            "judet": "$_id",
            "count": 1,
            "_id": 0
        }}
    ]
    
    judete = await db.firme.aggregate(pipeline).to_list(length=100)
    return {"judete": judete}

@app.get("/api/geo/localitati")
async def get_localitati(judet: Optional[str] = None):
    """Get list of localities, optionally filtered by county"""
    db = get_companies_db()
    
    match_stage = {}
    if judet:
        match_stage["judet"] = unquote(judet)
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {"localitate": {"$ne": None}}},
        {"$group": {
            "_id": {
                "localitate": "$localitate",
                "judet": "$judet"
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.localitate": 1}},
        {"$limit": 500},
        {"$project": {
            "localitate": "$_id.localitate",
            "judet": "$_id.judet",
            "count": 1,
            "_id": 0
        }}
    ]
    
    localitati = await db.firme.aggregate(pipeline).to_list(length=500)
    return {"localitati": localitati}

@app.get("/api/caen/top")
async def get_top_caen_codes(limit: int = Query(50, ge=1, le=200)):
    """Get top CAEN codes by company count"""
    db = get_companies_db()
    
    pipeline = [
        {"$match": {"anaf_cod_caen": {"$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$anaf_cod_caen",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": limit},
        {"$project": {
            "caen": "$_id",
            "count": 1,
            "_id": 0
        }}
    ]
    
    caen_codes = await db.firme.aggregate(pipeline).to_list(length=limit)
    return {"caen_codes": caen_codes}

@app.get("/api/stats/overview")
async def get_platform_stats():
    """Get platform overview statistics"""
    db = get_companies_db()
    
    # Get total companies
    total_companies = await db.firme.count_documents({})
    
    # Get active companies
    active_companies = await db.firme.count_documents({"anaf_inactiv": {"$ne": True}})
    
    # Get total counties
    judete_count = len(await db.firme.distinct("judet"))
    
    # Get companies with financial data
    with_financials = await db.firme.count_documents({"mf_cifra_afaceri": {"$gt": 0}})
    
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "counties": judete_count,
        "with_financials": with_financials
    }

@app.get("/api/seo/sitemap-index.xml")
async def sitemap_index():
    """Generate sitemap index"""
    xml = '''<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://mfirme.ro/sitemap-static.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://mfirme.ro/sitemap-judete.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://mfirme.ro/sitemap-companies-1.xml</loc>
  </sitemap>
</sitemapindex>'''
    return Response(content=xml, media_type="application/xml")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
