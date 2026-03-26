# mFirme Platform - Product Requirements Document

## Original Problem Statement
Construiește o platformă completă pentru afișarea firmelor românești (mFirme), bazată pe date publice agregate (1.2 milioane firme). Platforma necesită 3 zone distincte: 
- Site public (optimizat SEO, căutare rapidă)
- Zonă User (autentificare, planuri gratuite/premium, favorite)
- Zonă Admin

Trebuie inclus un sistem de abonamente cu limitări de date și plăți. Baza de date a firmelor actualizată automat nu trebuie suprascrisă de editările manuale din admin.

## Core Requirements
- Afișare firme românești cu date publice din Ministerul Finanțelor
- Dual database architecture: read-only (`justportal`) + read-write (`mfirme_app`)
- Grafice financiare multi-anuale cu date reale din colecția `bilanturi`
- Admin panel pentru overrides manuale (non-destructive)
- Sistem de coduri poștale pentru match automat cu localitățile firmelor

## Tech Stack
- **Backend**: FastAPI, PyMongo, Motor (async MongoDB)
- **Frontend**: React, Tailwind CSS, Recharts
- **Database**: MongoDB (dual DB setup)
- **Authentication**: JWT

## What's Been Implemented

### Session 1 (Previous) - Core MVP
- ✅ Basic search and company profile pages
- ✅ User authentication system
- ✅ Favorites functionality
- ✅ Admin login and basic dashboard

### Session 2 - Financial Charts + Postal Codes
**Date: March 2026**

#### Completed Features:
1. **Financial Chart with Dual Lines** (P0)
   - Displays Cifra de afaceri (Turnover) AND Profit net simultaneously on same graph
   - 3 KPI cards showing latest year data with growth percentages
   - Year-by-year data table
   - Real data from `bilanturi` collection (not approximated)

2. **Romanian Postal Codes Integration** (NEW)
   - Imported 55,123 postal codes from GitHub source
   - Created 13,856 unique localities mapping
   - Auto-matching of postal codes to company locations
   - Special handling for București sectors (SECTORUL 1 → SECTOR1)
   - API endpoints: `/api/postal/search`, `/api/postal/localities`, `/api/postal/match/company/{cui}`
   - Postal code displayed in company header and address section

3. **Bug Fixes from Previous Session**
   - Fixed Auth bug ("body stream already read")
   - Fixed Admin login redirection
   - Fixed React Helmet crash on SearchPage

### Session 3 - CAEN Codes Integration
**Date: March 2026**

#### Completed Features:
1. **CAEN Rev.2 Codes Integration** (P0) ✅
   - Imported 615 CAEN codes from ONRC website
   - Created `caen_codes` collection with: cod, denumire, sectiune (A-U), sectiune_denumire
   - Auto-lookup of CAEN description in company API endpoints
   - Display on CompanyPage: code, full description, section badge
   - 21 economic sections mapped (Agricultură, Industrie, Comerț, IT etc.)

### Session 4 (Current) - Credits System
**Date: March 2026**

#### Completed Features:
1. **Credits + Daily Free Views System** (P0) ✅
   - User credits system: 10 bonus credits at registration
   - 5 free company views per day (reset at midnight)
   - Previously viewed companies are always free
   - Credit packages: 50 (9.99 RON), 200 (29.99 RON), 500 (59.99 RON)
   - Badge în header showing available credits + free views

2. **Admin Toggle for Credits System** ✅
   - Admin can enable/disable credits system with one click
   - When disabled, all company views are unlimited
   - Admin statistics: users with credits, credits in circulation, total views

3. **New Collections Created:**
   - `user_credits`: tracks balances, daily views, viewed companies
   - `app_settings`: stores system-wide settings like credits_system_enabled
   - `credit_transactions`: logs all credit purchases

4. **New API Endpoints:**
   - `GET /api/credits/status` - User credits balance
   - `POST /api/credits/check-access` - Check if user can view company
   - `POST /api/credits/consume` - Consume credit for company view
   - `GET /api/credits/packages` - Available credit packages
   - `POST /api/admin/settings/credits-system/toggle` - Toggle credits on/off
   - `GET /api/admin/credits/stats` - Credits system statistics

5. **New Frontend Components:**
   - `CreditsContext.js` - Global credits state management
   - `NoCreditsModal.js` - Modal when credits depleted
   - `CreditsPage.js` - Page to purchase credits
   - Updated `Header.js` with credits badge
   - Updated `AdminDashboardPage.js` with toggle button

### Session 5 (Current) - Hybrid Database Architecture
**Date: March 2026**

#### Completed Features:
1. **Local MongoDB for Fast Reads** ✅
   - Docker Compose configuration for MongoDB local + sync service
   - 64GB RAM optimized setup (32GB WiredTiger cache)
   - Fallback automat la cloud dacă local DB este down

2. **Sync Service** ✅
   - Real-time sync via MongoDB Change Streams
   - Manual full sync triggered din Admin panel
   - Support pentru colecții: firme, bilanturi, caen_codes, postal_codes, localities
   - Progress tracking și logging
   - **NEW: Dynamic Cloud URL injection** - Admin can set Cloud MongoDB URL from UI

3. **Admin Sync Dashboard** ✅
   - Pagină dedicată `/admin/sync` cu AdminLayout (sidebar vizibil)
   - Toggle între modul LOCAL și CLOUD
   - **NEW: Input câmp pentru Cloud MongoDB URL** (password field cu show/hide toggle)
   - Buton "Sync Complet" pentru sincronizare manuală
   - Statistici per colecție (documente, dimensiune, indexuri)
   - Status sync service în timp real

4. **New Files Created:**
   - `/app/docker-compose.production.yml` - Production Docker config
   - `/app/sync-service/` - Sync service complet (Python)
   - `/app/backend/routes/admin_sync_routes.py` - API endpoints sync
   - `/app/frontend/src/pages/AdminSyncPage.js` - Admin UI

5. **Architecture:**
```
Docker Compose Production:
├── mongodb-local (port 27017, 32GB cache)
├── sync-service (Change Streams + manual sync)
├── backend (FastAPI, dual DB support)
├── frontend (React/Nginx)
└── redis (cache, 2GB)
```

## Database Schema

### justportal (Read-Only)
- `firme` - Company master data (time-series collection)
- `bilanturi` - Financial data (firma_id → firme.id)

### mfirme_app (Read-Write)
- `users` - User accounts
- `company_overrides` - Admin manual edits
- `audit_logs` - Admin action tracking
- `postal_codes` - 55,123 Romanian postal codes
- `localities` - 13,856 aggregated locality records
- `caen_codes` - 615 CAEN Rev.2 codes with descriptions
- `user_credits` - User credit balances and viewed companies
- `app_settings` - System-wide settings
- `credit_transactions` - Credit purchase logs

### mfirme_local (NEW - Local MongoDB for fast reads)
- `firme` - Synced from cloud (1.2M companies)
- `bilanturi` - Synced from cloud (financial data)
- `caen_codes` - Synced from cloud
- `postal_codes` - Synced from cloud
- `localities` - Synced from cloud
- `sync_status` - Tracks last sync per collection

## Key API Endpoints

### Public
- `GET /api/search` - Search companies
- `GET /api/company/cui/{cui}` - Get company by CUI (includes auto postal code)
- `GET /api/company/slug/{slug}` - Get company by slug (includes auto postal code)
- `GET /api/company/{cui}/financials` - Get multi-year financial data

### Postal Codes
- `GET /api/postal/stats` - Statistics (55,123 codes, 13,856 localities, 42 counties)
- `GET /api/postal/search` - Search by code, locality, county
- `GET /api/postal/localities` - Get localities list
- `GET /api/postal/match/company/{cui}` - Find postal code for company

### Admin
- `POST /api/admin/companies/search` - Admin company search
- `PUT /api/admin/companies/{cui}/override` - Save manual override
- `POST /api/admin/settings/credits-system/toggle` - Toggle credits on/off

### Admin Sync (NEW)
- `GET /api/admin/sync/status` - Sync status (local vs cloud)
- `POST /api/admin/sync/trigger-full` - Start full sync (background)
- `POST /api/admin/sync/trigger-collection/{name}` - Sync single collection
- `POST /api/admin/sync/switch-mode` - Switch local/cloud mode
- `GET /api/admin/sync/local-stats` - Local DB statistics

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ Financial chart with dual lines
- ✅ Postal codes integration
- ✅ CAEN codes integration with descriptions
- ✅ Credits system with daily free views
- ✅ Admin toggle for credits system

### P1 (High Priority)
- [ ] Integrate Stripe checkout for credit purchases (currently simulated)
- [ ] Complete Stripe payment flow verification for subscriptions
- [ ] API key management for premium users
- [ ] Admin subscription management
- [ ] Test hybrid DB in production environment with real data

### P2 (Medium Priority)
- [ ] Advanced search engine migration (Elasticsearch)
- [ ] Bulk SEO metadata editing
- [ ] Export functionality

### P3 (Future/Nice to Have)
- [ ] Company comparison tool
- [ ] Industry analytics dashboard
- [ ] Mobile app

## File Structure
```
/app
├── docker-compose.production.yml (NEW - production Docker config)
├── sync-service/ (NEW)
│   ├── sync_service.py (Change Streams + full sync)
│   ├── api.py (FastAPI endpoints for sync control)
│   ├── Dockerfile
│   └── requirements.txt
├── backend/
│   ├── server.py (main FastAPI app)
│   ├── database.py (UPDATED - dual DB support with fallback)
│   ├── routes/
│   │   ├── admin_sync_routes.py (NEW)
│   │   ├── credits_routes.py
│   │   ├── postal_routes.py
│   │   ├── admin_routes.py
│   │   └── ...
│   └── scripts/
│       ├── import_postal_codes.py
│       └── import_caen_codes.py
└── frontend/
    └── src/
        ├── contexts/
        │   ├── AuthContext.js
        │   └── CreditsContext.js
        ├── components/
        │   ├── AdminLayout.js (UPDATED - sync link)
        │   ├── FinancialChart.js
        │   ├── Header.js
        │   └── NoCreditsModal.js
        └── pages/
            ├── AdminSyncPage.js (NEW)
            ├── CompanyPage.js
            ├── CreditsPage.js
            └── AdminDashboardPage.js
```

## Notes for Next Developer
1. Financial data mapping: `firme.id` → `bilanturi.firma_id`
2. Always use `venituri_totale` as fallback for `cifra_afaceri`
3. Postal code normalization handles: diacritics, "MUNICIPIUL/SECTOR" prefixes, București sectors
4. Never write to `justportal` - use `company_overrides` for admin edits
5. User speaks Romanian - keep UI text in Romanian
6. CAEN lookup: strip to 4 digits and query `caen_codes.cod`
7. PyMongo warning: Never use `if db:` - use `if db is not None:` to avoid NotImplementedError
8. **Sync Service**: The `set_cloud_url` method in `/app/sync-service/sync_service.py` allows dynamic Cloud MongoDB URL updates from Admin UI
9. **Environment**: In preview environment, MongoDB local is used via `mongodb://localhost:27017/`. For production Docker, use `mongodb://mongodb-local:27017/`
