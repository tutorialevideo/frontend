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