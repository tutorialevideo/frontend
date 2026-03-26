"""
API Keys Management Tests
Tests for API key generation, management, and public API v1 endpoints
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://romanian-firms.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mfirme.ro"
ADMIN_PASSWORD = "Admin123!"
EXISTING_API_KEY = "mf_3A0wGUhINV3iLbESzFt2-Xjvwfj7pFbqcMqvFOv3I30"
TEST_CUI = "34256110"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def authenticated_client(api_client, admin_token):
    """Session with admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


# ============ API Plans Tests ============

class TestApiPlans:
    """Tests for API plans endpoint"""
    
    def test_get_api_plans(self, api_client):
        """Test getting available API plans"""
        response = api_client.get(f"{BASE_URL}/api/api-keys/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert "plans" in data
        plans = data["plans"]
        
        # Verify all 3 plans exist
        assert len(plans) == 3
        plan_ids = [p["id"] for p in plans]
        assert "basic" in plan_ids
        assert "pro" in plan_ids
        assert "enterprise" in plan_ids
        
    def test_basic_plan_limits(self, api_client):
        """Verify Basic plan has correct limits"""
        response = api_client.get(f"{BASE_URL}/api/api-keys/plans")
        data = response.json()
        
        basic_plan = next(p for p in data["plans"] if p["id"] == "basic")
        assert basic_plan["requests_per_day"] == 100
        assert basic_plan["requests_per_month"] == 3000
        assert "search" in basic_plan["endpoints"]
        assert "company" in basic_plan["endpoints"]
        
    def test_pro_plan_limits(self, api_client):
        """Verify Pro plan has correct limits"""
        response = api_client.get(f"{BASE_URL}/api/api-keys/plans")
        data = response.json()
        
        pro_plan = next(p for p in data["plans"] if p["id"] == "pro")
        assert pro_plan["requests_per_day"] == 1000
        assert pro_plan["requests_per_month"] == 30000
        assert "financials" in pro_plan["endpoints"]
        assert "bulk" in pro_plan["endpoints"]
        
    def test_enterprise_plan_limits(self, api_client):
        """Verify Enterprise plan has correct limits"""
        response = api_client.get(f"{BASE_URL}/api/api-keys/plans")
        data = response.json()
        
        enterprise_plan = next(p for p in data["plans"] if p["id"] == "enterprise")
        assert enterprise_plan["requests_per_day"] == 10000
        assert enterprise_plan["requests_per_month"] == 300000
        assert "geo" in enterprise_plan["endpoints"]
        assert "caen" in enterprise_plan["endpoints"]


# ============ Public API v1 Tests ============

class TestPublicApiV1:
    """Tests for public API v1 endpoints"""
    
    def test_health_no_auth(self, api_client):
        """Test /api/v1/health without authentication"""
        response = api_client.get(f"{BASE_URL}/api/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "1.0"
        assert "timestamp" in data
        
    def test_company_without_auth_fails(self, api_client):
        """Test /api/v1/company requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        assert response.status_code == 401
        
        data = response.json()
        assert data["detail"]["error"] == "missing_api_key"
        
    def test_company_with_invalid_key_fails(self, api_client):
        """Test /api/v1/company with invalid API key"""
        api_client.headers.update({"Authorization": "Bearer mf_invalid_key"})
        response = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        assert response.status_code == 401
        
        data = response.json()
        assert data["detail"]["error"] == "invalid_key"
        
    def test_company_with_valid_key(self, api_client):
        """Test /api/v1/company with valid API key"""
        api_client.headers.update({"Authorization": f"Bearer {EXISTING_API_KEY}"})
        response = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert data["data"]["cui"] == TEST_CUI
        assert "meta" in data
        assert "requests_remaining_today" in data["meta"]
        
    def test_search_with_valid_key(self, api_client):
        """Test /api/v1/search with valid API key"""
        api_client.headers.update({"Authorization": f"Bearer {EXISTING_API_KEY}"})
        response = api_client.get(f"{BASE_URL}/api/v1/search?q=transport&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "results" in data["data"]
        assert "pagination" in data["data"]
        assert len(data["data"]["results"]) <= 5
        
    def test_financials_with_pro_key(self, api_client):
        """Test /api/v1/company/{cui}/financials with Pro plan key"""
        api_client.headers.update({"Authorization": f"Bearer {EXISTING_API_KEY}"})
        response = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}/financials")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "financials" in data["data"]
        
    def test_company_not_found(self, api_client):
        """Test /api/v1/company with non-existent CUI"""
        api_client.headers.update({"Authorization": f"Bearer {EXISTING_API_KEY}"})
        response = api_client.get(f"{BASE_URL}/api/v1/company/99999999999")
        assert response.status_code == 404


# ============ API Key Management Tests ============

class TestApiKeyManagement:
    """Tests for API key CRUD operations"""
    
    def test_get_my_keys_requires_auth(self, api_client):
        """Test /api/api-keys/my-keys requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/api-keys/my-keys")
        # Returns 403 Forbidden when no auth token provided
        assert response.status_code in [401, 403]
        
    def test_get_my_keys_authenticated(self, authenticated_client):
        """Test getting user's API keys"""
        response = authenticated_client.get(f"{BASE_URL}/api/api-keys/my-keys")
        assert response.status_code == 200
        
        data = response.json()
        assert "keys" in data
        assert isinstance(data["keys"], list)
        
    def test_create_api_key(self, authenticated_client):
        """Test creating a new API key"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/api-keys/create",
            json={"name": "TEST_pytest_key", "plan_id": "basic"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "api_key" in data  # Raw key shown only once
        assert data["api_key"].startswith("mf_")
        assert "key_id" in data
        assert "key_preview" in data
        
        # Store key_id for cleanup
        TestApiKeyManagement.created_key_id = data["key_id"]
        TestApiKeyManagement.created_api_key = data["api_key"]
        
    def test_create_key_invalid_plan(self, authenticated_client):
        """Test creating key with invalid plan fails"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/api-keys/create",
            json={"name": "TEST_invalid_plan", "plan_id": "invalid_plan"}
        )
        assert response.status_code == 400
        
    def test_update_api_key(self, authenticated_client):
        """Test updating API key name"""
        if not hasattr(TestApiKeyManagement, 'created_key_id'):
            pytest.skip("No key created to update")
            
        response = authenticated_client.put(
            f"{BASE_URL}/api/api-keys/{TestApiKeyManagement.created_key_id}",
            json={"name": "TEST_updated_name"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
    def test_toggle_api_key_active(self, authenticated_client):
        """Test toggling API key active status"""
        if not hasattr(TestApiKeyManagement, 'created_key_id'):
            pytest.skip("No key created to toggle")
            
        # Deactivate
        response = authenticated_client.put(
            f"{BASE_URL}/api/api-keys/{TestApiKeyManagement.created_key_id}",
            json={"active": False}
        )
        assert response.status_code == 200
        
        # Verify deactivated key cannot be used
        test_client = requests.Session()
        test_client.headers.update({
            "Authorization": f"Bearer {TestApiKeyManagement.created_api_key}"
        })
        api_response = test_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        assert api_response.status_code == 403
        
        # Reactivate
        response = authenticated_client.put(
            f"{BASE_URL}/api/api-keys/{TestApiKeyManagement.created_key_id}",
            json={"active": True}
        )
        assert response.status_code == 200
        
    def test_get_api_key_usage(self, authenticated_client):
        """Test getting API key usage stats"""
        if not hasattr(TestApiKeyManagement, 'created_key_id'):
            pytest.skip("No key created to check usage")
            
        response = authenticated_client.get(
            f"{BASE_URL}/api/api-keys/{TestApiKeyManagement.created_key_id}/usage"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "usage" in data
        assert "today" in data["usage"]
        assert "this_month" in data["usage"]
        
    def test_regenerate_api_key(self, authenticated_client):
        """Test regenerating API key"""
        if not hasattr(TestApiKeyManagement, 'created_key_id'):
            pytest.skip("No key created to regenerate")
            
        old_key = TestApiKeyManagement.created_api_key
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/api-keys/{TestApiKeyManagement.created_key_id}/regenerate"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "api_key" in data
        assert data["api_key"] != old_key  # New key is different
        
        # Old key should no longer work
        test_client = requests.Session()
        test_client.headers.update({"Authorization": f"Bearer {old_key}"})
        api_response = test_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        assert api_response.status_code == 401
        
    def test_delete_api_key(self, authenticated_client):
        """Test deleting (revoking) API key"""
        if not hasattr(TestApiKeyManagement, 'created_key_id'):
            pytest.skip("No key created to delete")
            
        response = authenticated_client.delete(
            f"{BASE_URL}/api/api-keys/{TestApiKeyManagement.created_key_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True


# ============ Admin API Keys Tests ============

class TestAdminApiKeys:
    """Tests for admin API key management"""
    
    def test_admin_get_all_keys(self, authenticated_client):
        """Test admin getting all API keys"""
        response = authenticated_client.get(f"{BASE_URL}/api/api-keys/admin/all")
        assert response.status_code == 200
        
        data = response.json()
        assert "keys" in data
        assert "stats" in data
        assert "total_keys" in data["stats"]
        assert "active_keys" in data["stats"]
        assert "total_requests_today" in data["stats"]
        
    def test_admin_toggle_key(self, authenticated_client):
        """Test admin toggling API key status"""
        # First get a key to toggle
        response = authenticated_client.get(f"{BASE_URL}/api/api-keys/admin/all")
        data = response.json()
        
        if not data["keys"]:
            pytest.skip("No keys to toggle")
            
        key_id = data["keys"][0]["id"]
        original_status = data["keys"][0]["active"]
        
        # Toggle
        toggle_response = authenticated_client.put(
            f"{BASE_URL}/api/api-keys/admin/{key_id}/toggle"
        )
        assert toggle_response.status_code == 200
        
        toggle_data = toggle_response.json()
        assert toggle_data["success"] == True
        assert toggle_data["active"] != original_status
        
        # Toggle back
        authenticated_client.put(f"{BASE_URL}/api/api-keys/admin/{key_id}/toggle")


# ============ Rate Limiting Tests ============

class TestRateLimiting:
    """Tests for API rate limiting"""
    
    def test_rate_limit_headers(self, api_client):
        """Test that rate limit info is returned in response"""
        api_client.headers.update({"Authorization": f"Bearer {EXISTING_API_KEY}"})
        response = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        
        data = response.json()
        assert "meta" in data
        assert "requests_remaining_today" in data["meta"]
        assert "requests_remaining_month" in data["meta"]
        
    def test_request_counter_increments(self, api_client):
        """Test that request counter increments"""
        api_client.headers.update({"Authorization": f"Bearer {EXISTING_API_KEY}"})
        
        # First request
        response1 = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        remaining1 = response1.json()["meta"]["requests_remaining_today"]
        
        # Second request
        response2 = api_client.get(f"{BASE_URL}/api/v1/company/{TEST_CUI}")
        remaining2 = response2.json()["meta"]["requests_remaining_today"]
        
        # Counter should have decremented
        assert remaining2 == remaining1 - 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
