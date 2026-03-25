from slugify import slugify
import re
from datetime import datetime

def create_company_slug(denumire: str, cui: str) -> str:
    """Create URL-friendly slug from company name and CUI"""
    name_slug = slugify(denumire, max_length=50)
    return f"{name_slug}-{cui}"

def normalize_cui(cui: str) -> str:
    """Normalize CUI by removing spaces and non-numeric characters"""
    if not cui:
        return ""
    return re.sub(r'[^0-9]', '', str(cui))

def mask_phone(phone: str, tier: str = "public") -> str:
    """Mask phone number based on user tier"""
    if not phone or tier == "premium":
        return phone
    
    phone = str(phone).strip()
    if len(phone) >= 7:
        # Show first 3 digits, mask the rest
        return f"{phone[:3]}***{phone[-1:] if len(phone) > 7 else ''}"
    return "***"

def mask_name(name: str, tier: str = "public") -> str:
    """Mask personal names based on user tier"""
    if not name or tier == "premium":
        return name
    
    parts = name.split()
    if len(parts) == 0:
        return "***"
    
    # Show first name fully, mask last name(s)
    masked = [parts[0]]
    for part in parts[1:]:
        if len(part) > 0:
            masked.append(f"{part[0]}***")
    
    return " ".join(masked)

def format_currency(amount, currency="RON") -> str:
    """Format currency amounts"""
    if amount is None:
        return "N/A"
    try:
        amount = float(amount)
        return f"{amount:,.0f} {currency}"
    except:
        return "N/A"

def compute_company_profile(raw_data: dict, tier: str = "public", manual_overrides: dict = None) -> dict:
    """Compute final company profile by combining raw data with overrides and applying tier masking"""
    
    # Start with raw data
    profile = raw_data.copy()
    
    # Apply manual overrides if any (for future admin edits)
    if manual_overrides:
        profile.update(manual_overrides)
    
    # Apply tier-based masking
    if tier != "premium":
        if profile.get("anaf_telefon"):
            profile["anaf_telefon"] = mask_phone(profile["anaf_telefon"], tier)
    
    # Generate slug
    profile["slug"] = create_company_slug(
        profile.get("denumire", ""),
        profile.get("cui", "")
    )
    
    # Normalize CUI
    if profile.get("cui"):
        profile["cui_normalized"] = normalize_cui(profile["cui"])
    
    return profile

def serialize_doc(doc):
    """Serialize MongoDB document for JSON response"""
    if doc is None:
        return None
    
    # Convert ObjectId to string
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    
    # Convert datetime objects
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    return doc