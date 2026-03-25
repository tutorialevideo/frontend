from motor.motor_asyncio import AsyncIOMotorClient
import os

# Companies database (read-only)
companies_client = None
companies_db = None

# App database (read-write for users, subscriptions, etc.)
app_client = None
app_db = None

async def connect_to_databases():
    global companies_client, companies_db, app_client, app_db
    
    # Connect to companies database
    mongo_url = os.getenv("MONGO_URL")
    companies_client = AsyncIOMotorClient(mongo_url)
    companies_db = companies_client["justportal"]
    
    # Connect to app database
    app_mongo_url = os.getenv("APP_MONGO_URL")
    app_client = AsyncIOMotorClient(app_mongo_url)
    app_db = app_client["mfirme_app"]
    
    # Note: Indexes already exist on the companies database
    # Read-only user cannot create indexes
    
    print("✓ Connected to MongoDB databases")

async def close_database_connections():
    if companies_client:
        companies_client.close()
    if app_client:
        app_client.close()
    print("✓ Closed MongoDB connections")

def get_companies_db():
    return companies_db

def get_readonly_db():
    """Alias for get_companies_db - readonly database with company data"""
    return companies_db

def get_app_db():
    return app_db