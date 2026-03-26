from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from contextlib import asynccontextmanager
from database import connect_to_databases, close_database_connections, get_companies_db
from utils import compute_company_profile, serialize_doc, normalize_cui, create_company_slug
from auth import get_current_user_optional
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

# Include routers
from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.subscription_routes import router as subscription_router
from routes.admin_routes import router as admin_router
from routes.admin_companies_routes import router as admin_companies_router
from routes.admin_users_routes import router as admin_users_router
from routes.admin_audit_routes import router as admin_audit_router
from routes.postal_routes import router as postal_router
from routes.credits_routes import router as credits_router
from routes.admin_sync_routes import router as admin_sync_router
from routes.api_keys_routes import router as api_keys_router
from routes.public_api_routes import router as public_api_router

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(subscription_router)
app.include_router(admin_router)
app.include_router(admin_companies_router)
app.include_router(admin_users_router)
app.include_router(admin_audit_router)
app.include_router(postal_router)
app.include_router(credits_router)
app.include_router(admin_sync_router)
app.include_router(api_keys_router)
app.include_router(public_api_router)

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
async def get_company_by_cui(cui: str, current_user = Depends(get_current_user_optional)):
    """Get company by CUI"""
    db = get_companies_db()
    from database import get_app_db
    app_db = get_app_db()
    
    normalized_cui = normalize_cui(cui)
    result = await db.firme.find_one({"cui": normalized_cui})
    
    if not result:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Determine user tier
    tier = current_user["tier"] if current_user else "public"
    
    profile = compute_company_profile(result, tier=tier)
    
    # Try to find postal code for the company
    if app_db is not None and profile.get('judet') and profile.get('localitate'):
        postal_code = await find_postal_code_for_company(
            app_db, 
            profile.get('judet'), 
            profile.get('localitate')
        )
        if postal_code:
            profile['cod_postal'] = postal_code
    
    # Try to find CAEN description for the company
    if app_db is not None and profile.get('anaf_cod_caen'):
        caen_info = await find_caen_description(app_db, profile.get('anaf_cod_caen'))
        if caen_info:
            profile['caen_denumire'] = caen_info.get('denumire')
            profile['caen_sectiune'] = caen_info.get('sectiune')
            profile['caen_sectiune_denumire'] = caen_info.get('sectiune_denumire')
    
    return serialize_doc(profile)

@app.get("/api/company/slug/{slug}")
async def get_company_by_slug(slug: str, current_user = Depends(get_current_user_optional)):
    """Get company by slug"""
    db = get_companies_db()
    from database import get_app_db
    app_db = get_app_db()
    
    # Extract CUI from slug (last part after last dash)
    parts = slug.rsplit("-", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid slug format")
    
    cui = parts[1]
    normalized_cui = normalize_cui(cui)
    
    result = await db.firme.find_one({"cui": normalized_cui})
    
    if not result:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Determine user tier
    tier = current_user["tier"] if current_user else "public"
    
    profile = compute_company_profile(result, tier=tier)
    
    # Try to find postal code for the company
    if app_db is not None and profile.get('judet') and profile.get('localitate'):
        postal_code = await find_postal_code_for_company(
            app_db, 
            profile.get('judet'), 
            profile.get('localitate')
        )
        if postal_code:
            profile['cod_postal'] = postal_code
    
    # Try to find CAEN description for the company
    if app_db is not None and profile.get('anaf_cod_caen'):
        caen_info = await find_caen_description(app_db, profile.get('anaf_cod_caen'))
        if caen_info:
            profile['caen_denumire'] = caen_info.get('denumire')
            profile['caen_sectiune'] = caen_info.get('sectiune')
            profile['caen_sectiune_denumire'] = caen_info.get('sectiune_denumire')
    
    return serialize_doc(profile)


async def find_postal_code_for_company(app_db, judet: str, localitate: str) -> str:
    """Find postal code for a company based on judet and localitate"""
    if not judet or not localitate:
        return None
    
    # Normalize text function
    def normalize_text(text, is_bucuresti=False):
        if not text:
            return ""
        replacements = {
            'ş': 's', 'Ş': 'S', 'ș': 's', 'Ș': 'S',
            'ţ': 't', 'Ţ': 'T', 'ț': 't', 'Ț': 'T',
            'ă': 'a', 'Ă': 'A', 'â': 'a', 'Â': 'A',
            'î': 'i', 'Î': 'I'
        }
        result = text
        for old, new in replacements.items():
            result = result.replace(old, new)
        result = re.sub(r'\([^)]*\)', '', result).strip()
        
        upper_result = result.upper()
        
        # Special handling for București sectors
        # Convert "BUCURESTI SECTORUL 1" to "SECTOR1"
        if is_bucuresti:
            import re as regex
            sector_match = regex.search(r'SECTOR(?:UL)?\s*(\d)', upper_result)
            if sector_match:
                return f"SECTOR{sector_match.group(1)}"
        
        # Remove common prefixes
        prefixes = ['MUNICIPIUL ', 'MUN. ', 'MUN ', 'ORASUL ', 'ORAS ', 
                    'COMUNA ', 'COM. ', 'COM ', 'SATUL ', 'SAT ', 'SECTOR ']
        for prefix in prefixes:
            if upper_result.startswith(prefix):
                upper_result = upper_result[len(prefix):].strip()
                break
        return upper_result
    
    judet_norm = normalize_text(judet)
    
    # Check if București
    is_bucuresti = 'BUCUREST' in judet_norm or 'BUCUREST' in localitate.upper()
    localitate_norm = normalize_text(localitate, is_bucuresti=is_bucuresti)
    
    try:
        locality_match = await app_db.localities.find_one({
            "judet_normalized": judet_norm,
            "localitate_normalized": localitate_norm
        })
        
        if locality_match:
            return locality_match.get('primary_postal_code')
    except Exception as e:
        print(f"Error finding postal code: {e}")
    
    return None


async def find_caen_description(app_db, caen_code: str) -> dict:
    """Find CAEN code description from caen_codes collection"""
    if not caen_code:
        return None
    
    # Normalize CAEN code (remove spaces, get first 4 digits)
    caen_normalized = str(caen_code).strip().replace(' ', '')[:4]
    
    # First try local companies DB (mfirme_local) where CAEN codes are stored
    companies_db = get_companies_db()
    if companies_db is not None:
        try:
            caen_record = await companies_db.caen_codes.find_one(
                {"cod": caen_normalized},
                {"_id": 0, "denumire": 1, "sectiune": 1, "sectiune_denumire": 1}
            )
            if caen_record:
                return caen_record
        except Exception as e:
            print(f"Error finding CAEN in local DB: {e}")
    
    # Fallback to app_db if provided
    if app_db is not None:
        try:
            caen_record = await app_db.caen_codes.find_one(
                {"cod": caen_normalized},
                {"_id": 0, "denumire": 1, "sectiune": 1, "sectiune_denumire": 1}
            )
            return caen_record
        except Exception as e:
            print(f"Error finding CAEN in app DB: {e}")
    
    return None


@app.get("/api/company/{cui}/financials")
async def get_company_financials(cui: str):
    """Get multi-year financial data for a company from real bilanturi collection"""
    db = get_companies_db()
    normalized_cui = normalize_cui(cui)
    company = await db.firme.find_one({"cui": normalized_cui})
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get firma numeric ID to find bilanturi
    firma_numeric_id = company.get('id')
    
    if not firma_numeric_id:
        # Fallback to empty data if no ID
        return {"years": [], "data": [], "note": "No financial data available"}
    
    # Get real bilanturi data from bilanturi collection
    bilanturi_cursor = db.bilanturi.find({"firma_id": firma_numeric_id}).sort("an", 1)
    bilanturi = await bilanturi_cursor.to_list(length=100)
    
    if not bilanturi:
        return {"years": [], "data": [], "note": "No bilanturi found"}
    
    # Build data array from real bilanturi
    data = []
    years = []
    
    for bilant in bilanturi:
        an = bilant.get('an')
        
        # Skip invalid years
        if not an or str(an).startswith('WEB_'):
            continue
        
        try:
            year_int = int(an) if isinstance(an, str) else an
        except (ValueError, TypeError):
            continue
        
        years.append(year_int)
        
        # Extract financial data - use real values from bilanturi
        # Use venituri_totale as fallback for cifra_afaceri if not available
        cifra_afaceri = bilant.get('cifra_afaceri') or bilant.get('venituri_totale')
        
        data.append({
            'year': year_int,
            'cifra_afaceri': cifra_afaceri,
            'profit_net': bilant.get('profit_net'),
            'numar_angajati': bilant.get('numar_angajati'),
            'venituri_totale': bilant.get('venituri_totale'),
            'cheltuieli_totale': bilant.get('cheltuieli_totale'),
            'capitaluri_proprii': bilant.get('capitaluri_proprii'),
            'datorii': bilant.get('datorii'),
        })
    
    return {
        "years": years,
        "data": data,
        "source": "real",  # Indicate these are real data
        "note": "Real financial data from Ministerul Finanțelor bilanțuri"
    }

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
    """Get list of localities, optionally filtered by county, sorted by company count"""
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
        {"$sort": {"count": -1}},  # Sort by company count descending
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
