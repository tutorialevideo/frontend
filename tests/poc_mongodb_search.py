"""
POC: MongoDB Atlas Search - Connection Test and Search Index Setup
Tests the core search functionality before building the full app.
"""

import os
import time
from pymongo import MongoClient
from pymongo.errors import OperationFailure
import statistics

# MongoDB connection
MONGO_URL = "mongodb+srv://aaaaaaaaaaaaaaaaaaaaaaaa:4GURTj9ZKNfZNDqy@cluster0.ck0gbc.mongodb.net/justportal"

def test_connection():
    """Test MongoDB Atlas connection and read sample companies"""
    print("=" * 80)
    print("TEST 1: MongoDB Atlas Connection")
    print("=" * 80)
    
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client.get_database()
        
        # Test connection
        client.admin.command('ping')
        print("✓ Connected to MongoDB Atlas successfully")
        
        # Get collection stats
        stats = db.command("collstats", "firme")
        total_count = stats.get('count', 0)
        print(f"✓ Collection 'firme' exists with {total_count:,} companies")
        
        # Sample 5 companies
        print("\n--- Sample Companies ---")
        for i, company in enumerate(db.firme.find().limit(5), 1):
            print(f"\n{i}. {company.get('denumire', 'N/A')}")
            print(f"   CUI: {company.get('cui', 'N/A')}")
            print(f"   Județ: {company.get('judet', 'N/A')}")
            print(f"   Localitate: {company.get('localitate', 'N/A')}")
            print(f"   CAEN: {company.get('anaf_cod_caen', 'N/A')}")
            print(f"   Status: {company.get('anaf_stare', 'N/A')}")
        
        client.close()
        return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False


def print_search_index_definition():
    """Print the MongoDB Atlas Search index definition that needs to be created manually"""
    print("\n" + "=" * 80)
    print("ATLAS SEARCH INDEX DEFINITION")
    print("=" * 80)
    print("\nYou need to create a Search Index in MongoDB Atlas manually:")
    print("\n1. Go to MongoDB Atlas → Your Cluster → Search")
    print("2. Click 'Create Search Index'")
    print("3. Choose 'JSON Editor'")
    print("4. Database: justportal, Collection: firme")
    print("5. Index Name: companies_search")
    print("6. Paste this JSON definition:\n")
    
    index_definition = {
        "mappings": {
            "dynamic": False,
            "fields": {
                "denumire": [
                    {
                        "type": "string",
                        "analyzer": "lucene.romanian"
                    },
                    {
                        "type": "autocomplete",
                        "analyzer": "lucene.standard",
                        "tokenization": "edgeGram",
                        "minGrams": 2,
                        "maxGrams": 15,
                        "foldDiacritics": True
                    }
                ],
                "denumire_normalized": {
                    "type": "string",
                    "analyzer": "lucene.standard"
                },
                "cui": [
                    {
                        "type": "string",
                        "analyzer": "lucene.keyword"
                    },
                    {
                        "type": "autocomplete",
                        "tokenization": "edgeGram",
                        "minGrams": 2,
                        "maxGrams": 10
                    }
                ],
                "cod_inregistrare": {
                    "type": "string",
                    "analyzer": "lucene.keyword"
                },
                "judet": {
                    "type": "string",
                    "analyzer": "lucene.keyword"
                },
                "localitate": [
                    {
                        "type": "string",
                        "analyzer": "lucene.keyword"
                    },
                    {
                        "type": "autocomplete",
                        "tokenization": "edgeGram",
                        "minGrams": 2,
                        "maxGrams": 15,
                        "foldDiacritics": True
                    }
                ],
                "anaf_cod_caen": {
                    "type": "string",
                    "analyzer": "lucene.keyword"
                },
                "mf_cifra_afaceri": {
                    "type": "number"
                },
                "mf_profit_net": {
                    "type": "number"
                },
                "mf_numar_angajati": {
                    "type": "number"
                },
                "anaf_platitor_tva": {
                    "type": "boolean"
                },
                "anaf_inactiv": {
                    "type": "boolean"
                }
            }
        }
    }
    
    import json
    print(json.dumps(index_definition, indent=2))
    print("\n7. Click 'Create Search Index' and wait for it to build (may take 10-30 minutes)")
    print("\n" + "=" * 80)


def test_atlas_search(index_name="companies_search"):
    """Test MongoDB Atlas Search functionality"""
    print("\n" + "=" * 80)
    print("TEST 2: Atlas Search - Autocomplete & Fuzzy Search")
    print("=" * 80)
    
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client.get_database()
        collection = db.firme
        
        # Test queries
        test_queries = [
            ("trans", "Autocomplete: 'trans'"),
            ("festeu", "Typo tolerance: 'festeu' (should match 'FEŞTEU')"),
            ("21383588", "CUI search: '21383588'"),
            ("zalau", "Location: 'zalau'"),
        ]
        
        all_passed = True
        timings = []
        
        for query, description in test_queries:
            print(f"\n--- {description} ---")
            
            # Build Atlas Search pipeline
            pipeline = [
                {
                    "$search": {
                        "index": index_name,
                        "compound": {
                            "should": [
                                {
                                    "autocomplete": {
                                        "query": query,
                                        "path": "denumire",
                                        "fuzzy": {
                                            "maxEdits": 2,
                                            "prefixLength": 1
                                        }
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "query": query,
                                        "path": "cui"
                                    }
                                },
                                {
                                    "autocomplete": {
                                        "query": query,
                                        "path": "localitate",
                                        "fuzzy": {
                                            "maxEdits": 2
                                        }
                                    }
                                }
                            ],
                            "minimumShouldMatch": 1
                        }
                    }
                },
                {
                    "$limit": 10
                },
                {
                    "$project": {
                        "denumire": 1,
                        "cui": 1,
                        "judet": 1,
                        "localitate": 1,
                        "score": {"$meta": "searchScore"}
                    }
                }
            ]
            
            start_time = time.time()
            try:
                results = list(collection.aggregate(pipeline))
                elapsed = (time.time() - start_time) * 1000  # Convert to ms
                timings.append(elapsed)
                
                if results:
                    print(f"✓ Found {len(results)} results in {elapsed:.2f}ms")
                    for i, result in enumerate(results[:3], 1):
                        print(f"  {i}. {result.get('denumire', 'N/A')} (CUI: {result.get('cui', 'N/A')})")
                        print(f"     {result.get('localitate', 'N/A')}, {result.get('judet', 'N/A')} - Score: {result.get('score', 0):.2f}")
                else:
                    print(f"✗ No results found (took {elapsed:.2f}ms)")
                    print("   Note: Search index may not be created yet or still building")
                    all_passed = False
                    
            except OperationFailure as e:
                print(f"✗ Search failed: {e}")
                if "Search index not found" in str(e) or "Unknown $search" in str(e):
                    print("   → You need to create the Atlas Search index first (see instructions above)")
                all_passed = False
        
        # Performance statistics
        if timings:
            print("\n--- Performance Statistics ---")
            print(f"Average: {statistics.mean(timings):.2f}ms")
            print(f"Median: {statistics.median(timings):.2f}ms")
            if len(timings) > 1:
                print(f"P95: {sorted(timings)[int(len(timings) * 0.95)]:.2f}ms")
            
            if statistics.mean(timings) < 200:
                print("✓ Performance target met (<200ms average)")
            else:
                print("⚠ Performance target not met (>200ms average)")
        
        client.close()
        return all_passed
        
    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False


def test_filters():
    """Test search with filters (județ, localitate, CAEN)"""
    print("\n" + "=" * 80)
    print("TEST 3: Search with Filters")
    print("=" * 80)
    
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client.get_database()
        collection = db.firme
        
        # Test filter combinations
        print("\n--- Filter: Județ = Sălaj ---")
        pipeline = [
            {
                "$search": {
                    "index": "companies_search",
                    "compound": {
                        "must": [
                            {
                                "autocomplete": {
                                    "query": "trans",
                                    "path": "denumire"
                                }
                            }
                        ],
                        "filter": [
                            {
                                "text": {
                                    "query": "Sălaj",
                                    "path": "judet"
                                }
                            }
                        ]
                    }
                }
            },
            {"$limit": 5},
            {
                "$project": {
                    "denumire": 1,
                    "cui": 1,
                    "judet": 1,
                    "localitate": 1
                }
            }
        ]
        
        results = list(collection.aggregate(pipeline))
        if results:
            print(f"✓ Found {len(results)} companies with 'trans' in Sălaj")
            for result in results[:3]:
                print(f"  - {result.get('denumire')} ({result.get('localitate')}, {result.get('judet')})")
        else:
            print("⚠ No results (index may not be ready)")
        
        client.close()
        return True
        
    except OperationFailure as e:
        print(f"⚠ Filter test skipped: {e}")
        return False
    except Exception as e:
        print(f"✗ Filter test failed: {e}")
        return False


def main():
    """Run all POC tests"""
    print("\n" + "=" * 80)
    print("MongoDB Atlas Search POC - mFirme Platform")
    print("=" * 80)
    
    # Test 1: Connection
    if not test_connection():
        print("\n✗ POC FAILED: Cannot connect to MongoDB Atlas")
        return False
    
    # Print search index definition
    print_search_index_definition()
    
    print("\n" + "=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print("\n1. Create the Atlas Search index using the definition above")
    print("2. Wait for the index to build (check status in Atlas UI)")
    print("3. Run this script again to test search functionality")
    print("\nOnce the index is ready, re-run with:")
    print("  python /app/tests/poc_mongodb_search.py --test-search")
    
    # Check if we should test search
    import sys
    if "--test-search" in sys.argv:
        print("\n" + "=" * 80)
        print("TESTING SEARCH (you indicated index is ready)")
        print("=" * 80)
        
        search_ok = test_atlas_search()
        filter_ok = test_filters()
        
        if search_ok and filter_ok:
            print("\n" + "=" * 80)
            print("✓ POC PASSED: All tests successful!")
            print("=" * 80)
            print("\nCore search functionality is proven. Ready to build the app!")
            return True
        else:
            print("\n" + "=" * 80)
            print("⚠ POC INCOMPLETE: Some tests failed")
            print("=" * 80)
            return False
    
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
