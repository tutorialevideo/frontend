from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# Auth Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    tier: str = "free"
    role: Optional[str] = "user"
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Subscription Models
class SubscriptionPlan(BaseModel):
    id: str
    name: str
    price: float
    currency: str = "RON"
    interval: str = "month"
    features: List[str]
    stripe_price_id: Optional[str] = None

class CheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str

class CheckoutResponse(BaseModel):
    url: str
    session_id: str

class SubscriptionStatus(BaseModel):
    plan: str
    status: str
    current_period_end: Optional[str] = None

# User Profile Models
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None

class FavoriteResponse(BaseModel):
    id: str
    company_id: str
    company_name: str
    company_cui: str
    created_at: str

class SearchHistoryResponse(BaseModel):
    query: str
    created_at: str

# Admin Models
class CompanyOverride(BaseModel):
    """Model for manual company data overrides"""
    cui: str
    field_name: str
    override_value: Optional[str] = None
    notes: Optional[str] = None
    updated_by: str  # admin email
    updated_at: str

class FieldVisibility(BaseModel):
    """Model for field-level visibility control"""
    cui: str
    field_name: str
    visibility: str = Field(..., pattern="^(public|premium|hidden)$")  # public, premium, or hidden
    updated_by: str
    updated_at: str

class SEOMetadata(BaseModel):
    """Model for custom SEO metadata per company"""
    cui: str
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    seo_text: Optional[str] = None
    keywords: Optional[List[str]] = None
    updated_by: str
    updated_at: str

class AuditLogEntry(BaseModel):
    """Model for audit trail"""
    action: str  # e.g., "company_override", "user_update", "field_visibility_change"
    resource_type: str  # e.g., "company", "user", "subscription"
    resource_id: str
    admin_email: str
    changes: dict
    timestamp: str
    ip_address: Optional[str] = None

# Admin Request/Response Models
class CompanySearchRequest(BaseModel):
    query: str  # CUI or company name
    limit: int = 50

class CompanyOverrideRequest(BaseModel):
    cui: str
    overrides: dict  # field_name: new_value
    notes: Optional[str] = None

class FieldVisibilityRequest(BaseModel):
    cui: str
    field_name: str
    visibility: str = Field(..., pattern="^(public|premium|hidden)$")

class UserUpdateRequest(BaseModel):
    user_id: str
    tier: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None

class AdminStatsResponse(BaseModel):
    """Detailed admin statistics"""
    users: dict
    engagement: dict
    revenue: dict
    platform: dict
    recent_activity: Optional[List[dict]] = None