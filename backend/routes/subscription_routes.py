from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_app_db
from auth import get_current_user
from models import (
    SubscriptionPlan, CheckoutRequest, CheckoutResponse,
    SubscriptionStatus
)
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse
)
import os
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# Define subscription plans
PLANS = {
    "free": SubscriptionPlan(
        id="free",
        name="Free",
        price=0.0,
        currency="RON",
        interval="month",
        features=[
            "Căutare firme",
            "Date de bază",
            "Telefon mascat (074***)",
            "Căutări limitate"
        ]
    ),
    "plus": SubscriptionPlan(
        id="plus",
        name="Plus",
        price=49.0,
        currency="RON",
        interval="month",
        features=[
            "Toate din Free",
            "Mai multe căutări",
            "Favorite",
            "Istoric căutări",
            "Unele date premium"
        ],
        stripe_price_id="price_plus_monthly"  # To be created in Stripe
    ),
    "premium": SubscriptionPlan(
        id="premium",
        name="Premium",
        price=99.0,
        currency="RON",
        interval="month",
        features=[
            "Toate din Plus",
            "Telefon complet",
            "Administrator complet",
            "Export date",
            "Acces API",
            "Căutări nelimitate"
        ],
        stripe_price_id="price_premium_monthly"  # To be created in Stripe
    )
}

@router.get("/plans")
async def get_plans():
    """Get all subscription plans"""
    return {"plans": list(PLANS.values())}

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    checkout_req: CheckoutRequest,
    current_user = Depends(get_current_user),
    request: Request = None
):
    """Create Stripe checkout session"""
    
    # Validate plan
    if checkout_req.plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan = PLANS[checkout_req.plan_id]
    
    if plan.price == 0:
        raise HTTPException(status_code=400, detail="Cannot checkout for free plan")
    
    # Initialize Stripe
    stripe_api_key = os.getenv("STRIPE_API_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Create webhook URL
    host_url = checkout_req.origin_url
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    # Create success and cancel URLs
    success_url = f"{checkout_req.origin_url}/account/subscription?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{checkout_req.origin_url}/account/subscription"
    
    # Create checkout session
    session_request = CheckoutSessionRequest(
        amount=plan.price,
        currency="ron",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user["user_id"],
            "user_email": current_user["email"],
            "plan_id": plan.id,
            "plan_name": plan.name
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(session_request)
    
    # Store payment transaction
    db = get_app_db()
    transaction = {
        "user_id": ObjectId(current_user["user_id"]),
        "session_id": session.session_id,
        "amount": plan.price,
        "currency": "ron",
        "plan_id": plan.id,
        "status": "pending",
        "payment_status": "pending",
        "metadata": session_request.metadata,
        "created_at": datetime.utcnow()
    }
    
    await db.payment_transactions.insert_one(transaction)
    
    return CheckoutResponse(url=session.url, session_id=session.session_id)

@router.get("/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Get checkout session status and update subscription if paid"""
    
    # Initialize Stripe
    stripe_api_key = os.getenv("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
    
    # Get status from Stripe
    status = await stripe_checkout.get_checkout_status(session_id)
    
    db = get_app_db()
    
    # Update transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Update transaction status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # If payment successful and not already processed, upgrade user
    if status.payment_status == "paid" and transaction.get("payment_status") != "paid":
        plan_id = transaction["metadata"]["plan_id"]
        
        # Update user tier
        await db.users.update_one(
            {"_id": transaction["user_id"]},
            {
                "$set": {
                    "tier": plan_id,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Create/update subscription record
        await db.subscriptions.update_one(
            {"user_id": transaction["user_id"]},
            {
                "$set": {
                    "plan_id": plan_id,
                    "status": "active",
                    "stripe_session_id": session_id,
                    "updated_at": datetime.utcnow()
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow()
                }
            },
            upsert=True
        )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount": status.amount_total / 100,  # Convert from cents
        "currency": status.currency
    }

@router.get("/my-subscription", response_model=SubscriptionStatus)
async def get_my_subscription(current_user = Depends(get_current_user)):
    """Get current user's subscription status"""
    db = get_app_db()
    
    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription = await db.subscriptions.find_one({"user_id": user["_id"]})
    
    return SubscriptionStatus(
        plan=user.get("tier", "free"),
        status=subscription.get("status", "inactive") if subscription else "inactive",
        current_period_end=subscription.get("current_period_end").isoformat() if subscription and subscription.get("current_period_end") else None
    )

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    
    stripe_api_key = os.getenv("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Handle webhook events
        if webhook_response.event_type == "checkout.session.completed":
            # Payment successful - already handled in get_checkout_status
            pass
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))