import requests
import sys
from datetime import datetime

class mFirmeAPITester:
    def __init__(self, base_url="https://firma-credits-sync.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    json_data = response.json()
                    if isinstance(json_data, dict) and 'total_companies' in json_data:
                        print(f"   📊 Total companies: {json_data['total_companies']:,}")
                    elif isinstance(json_data, dict) and 'total' in json_data:
                        print(f"   📊 Results found: {json_data['total']:,}")
                    elif isinstance(json_data, dict) and 'suggestions' in json_data:
                        print(f"   📊 Suggestions: {len(json_data['suggestions'])}")
                    elif isinstance(json_data, dict) and 'denumire' in json_data:
                        print(f"   🏢 Company: {json_data['denumire']}")
                except:
                    pass
            else:
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'url': url,
                    'response': response.text[:200] if response.text else 'No response'
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response.json() if success and response.text else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout (30s)")
            self.failed_tests.append({
                'name': name,
                'expected': expected_status,
                'actual': 'TIMEOUT',
                'url': url,
                'response': 'Request timed out after 30 seconds'
            })
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'expected': expected_status,
                'actual': 'ERROR',
                'url': url,
                'response': str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        return success

    def test_stats_overview(self):
        """Test stats overview endpoint"""
        success, response = self.run_test(
            "Stats Overview",
            "GET",
            "api/stats/overview",
            200
        )
        if success:
            required_fields = ['total_companies', 'active_companies', 'counties', 'with_financials']
            for field in required_fields:
                if field not in response:
                    print(f"⚠️  Warning: Missing field '{field}' in stats response")
                    return False
            
            # Validate data makes sense
            if response.get('total_companies', 0) < 1000000:
                print(f"⚠️  Warning: Expected 1M+ companies, got {response.get('total_companies', 0):,}")
        return success

    def test_search_suggest(self):
        """Test search suggestions"""
        test_queries = ['transport', 'SRL', 'construct']
        
        for query in test_queries:
            success, response = self.run_test(
                f"Search Suggest - '{query}'",
                "GET",
                "api/search/suggest",
                200,
                params={'q': query}
            )
            if not success:
                return False
            
            if 'suggestions' not in response:
                print(f"⚠️  Warning: No 'suggestions' field in response for query '{query}'")
                return False
                
            suggestions = response['suggestions']
            if len(suggestions) == 0:
                print(f"⚠️  Warning: No suggestions returned for query '{query}'")
            else:
                # Check suggestion structure
                first_suggestion = suggestions[0]
                required_fields = ['type', 'label', 'cui', 'location', 'slug']
                for field in required_fields:
                    if field not in first_suggestion:
                        print(f"⚠️  Warning: Missing field '{field}' in suggestion")
                        return False
        
        return True

    def test_search_companies(self):
        """Test company search"""
        # Test basic search
        success, response = self.run_test(
            "Search Companies - Basic",
            "GET",
            "api/search",
            200,
            params={'q': 'transport', 'limit': 10}
        )
        if not success:
            return False
        
        required_fields = ['results', 'total', 'page', 'pages', 'limit']
        for field in required_fields:
            if field not in response:
                print(f"⚠️  Warning: Missing field '{field}' in search response")
                return False
        
        if len(response['results']) == 0:
            print("⚠️  Warning: No search results returned")
            return False
        
        # Test search with filters
        success, response = self.run_test(
            "Search Companies - With Filters",
            "GET",
            "api/search",
            200,
            params={'q': 'SRL', 'judet': 'BUCURESTI', 'limit': 5}
        )
        
        return success

    def test_get_judete(self):
        """Test get counties endpoint"""
        success, response = self.run_test(
            "Get Counties (Judete)",
            "GET",
            "api/geo/judete",
            200
        )
        if success:
            if 'judete' not in response:
                print("⚠️  Warning: No 'judete' field in response")
                return False
            
            judete = response['judete']
            if len(judete) < 40:  # Romania has 41 counties + Bucharest
                print(f"⚠️  Warning: Expected 40+ counties, got {len(judete)}")
                return False
            
            # Check structure of first county
            if judete and len(judete) > 0:
                first_judet = judete[0]
                if 'judet' not in first_judet or 'count' not in first_judet:
                    print("⚠️  Warning: Invalid county structure")
                    return False
        
        return success

    def test_get_localitati(self):
        """Test get localities endpoint"""
        # Test without filter
        success, response = self.run_test(
            "Get Localities - All",
            "GET",
            "api/geo/localitati",
            200
        )
        if not success:
            return False
        
        # Test with county filter
        success, response = self.run_test(
            "Get Localities - Filtered by County",
            "GET",
            "api/geo/localitati",
            200,
            params={'judet': 'BUCURESTI'}
        )
        
        return success

    def test_company_by_slug(self):
        """Test get company by slug - need to find a real company first"""
        # First, get a company from search
        success, search_response = self.run_test(
            "Search for Company Slug",
            "GET",
            "api/search",
            200,
            params={'q': 'SRL', 'limit': 1}
        )
        
        if not success or not search_response.get('results'):
            print("⚠️  Warning: Could not find company for slug test")
            return False
        
        company_slug = search_response['results'][0].get('slug')
        if not company_slug:
            print("⚠️  Warning: No slug found in search results")
            return False
        
        # Now test the company endpoint
        success, response = self.run_test(
            f"Get Company by Slug - {company_slug}",
            "GET",
            f"api/company/slug/{company_slug}",
            200
        )
        
        if success:
            required_fields = ['denumire', 'cui', 'judet', 'localitate']
            for field in required_fields:
                if field not in response:
                    print(f"⚠️  Warning: Missing field '{field}' in company response")
                    return False
            
            # Check if phone masking is working
            if 'anaf_telefon' in response and response['anaf_telefon']:
                phone = response['anaf_telefon']
                if '***' in phone:
                    print(f"✅ Phone masking working: {phone}")
                else:
                    print(f"⚠️  Phone not masked (might be premium): {phone}")
        
        return success

    def test_top_caen_codes(self):
        """Test top CAEN codes endpoint"""
        success, response = self.run_test(
            "Get Top CAEN Codes",
            "GET",
            "api/caen/top",
            200,
            params={'limit': 10}
        )
        
        if success:
            if 'caen_codes' not in response:
                print("⚠️  Warning: No 'caen_codes' field in response")
                return False
            
            caen_codes = response['caen_codes']
            if len(caen_codes) == 0:
                print("⚠️  Warning: No CAEN codes returned")
                return False
        
        return success

def main():
    print("🚀 Starting mFirme API Testing...")
    print("=" * 60)
    
    # Setup
    tester = mFirmeAPITester()
    
    # Run all tests
    test_methods = [
        tester.test_health_check,
        tester.test_stats_overview,
        tester.test_search_suggest,
        tester.test_search_companies,
        tester.test_get_judete,
        tester.test_get_localitati,
        tester.test_company_by_slug,
        tester.test_top_caen_codes,
    ]
    
    for test_method in test_methods:
        try:
            test_method()
        except Exception as e:
            print(f"❌ Test method {test_method.__name__} crashed: {str(e)}")
            tester.failed_tests.append({
                'name': test_method.__name__,
                'expected': 'SUCCESS',
                'actual': 'CRASH',
                'url': 'N/A',
                'response': str(e)
            })
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "No tests run")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS ({len(tester.failed_tests)}):")
        for i, failed in enumerate(tester.failed_tests, 1):
            print(f"{i}. {failed['name']}")
            print(f"   Expected: {failed['expected']}, Got: {failed['actual']}")
            print(f"   URL: {failed['url']}")
            print(f"   Response: {failed['response']}")
            print()
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())