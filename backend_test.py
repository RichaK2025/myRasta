#!/usr/bin/env python3
"""
Raasta Backend API Test Suite
Tests all backend endpoints as specified in the review request.
"""

import requests
import time
import sys

# Base URL from .env NEXT_PUBLIC_BASE_URL
BASE_URL = "https://trusted-trails-1.preview.emergentagent.com/api"

# Store created route data
created_route = {}

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"  Details: {details}")
    return passed

def test_health_check():
    """Test 1: GET /api -> should return {ok:true, service:'raasta'}"""
    try:
        resp = requests.get(BASE_URL, timeout=10)
        data = resp.json()
        passed = (
            resp.status_code == 200 
            and data.get("ok") == True 
            and data.get("service") == "raasta"
        )
        return log_test(
            "Health Check (GET /api)",
            passed,
            f"Status: {resp.status_code}, Response: {data}"
        )
    except Exception as e:
        return log_test("Health Check (GET /api)", False, f"Error: {str(e)}")

def test_create_route():
    """Test 2: POST /api/routes -> create a route"""
    global created_route
    try:
        payload = {
            "name": "Test Coastal Loop",
            "description": "Beautiful coastal drive",
            "route_type": "Road Trip",
            "tags": ["Scenic", "Family Friendly"],
            "notes": "Beware of cyclists near km 5",
            "creator_name": "Test User",
            "user_id": "test-user-1",
            "points": [
                {"lat": 19.076, "lng": 72.877, "speed": 8},
                {"lat": 19.08, "lng": 72.88, "speed": 10},
                {"lat": 19.09, "lng": 72.90, "speed": 12}
            ],
            "distance_km": 3.5,
            "duration_sec": 900,
            "avg_speed_kmh": 14,
            "max_speed_kmh": 18,
            "start": {"lat": 19.076, "lng": 72.877},
            "end": {"lat": 19.09, "lng": 72.90}
        }
        
        resp = requests.post(f"{BASE_URL}/routes", json=payload, timeout=10)
        data = resp.json()
        
        # Verify response structure
        passed = (
            resp.status_code == 200
            and "id" in data
            and "share_code" in data
            and len(data["share_code"]) == 6
            and data.get("views") == 0
            and data.get("likes") == 0
            and data.get("rating_avg") == 0
            and data.get("rating_count") == 0
            and data.get("ai_summary") is None
            and "_id" not in data  # Should not leak MongoDB _id
        )
        
        if passed:
            created_route = data
            
        return log_test(
            "Create Route (POST /api/routes)",
            passed,
            f"Status: {resp.status_code}, ID: {data.get('id', 'N/A')}, Share Code: {data.get('share_code', 'N/A')}"
        )
    except Exception as e:
        return log_test("Create Route (POST /api/routes)", False, f"Error: {str(e)}")

def test_get_route_by_id():
    """Test 3: GET /api/routes/{id} -> should return the created route"""
    if not created_route.get("id"):
        return log_test("Get Route by ID", False, "No route ID available from create test")
    
    try:
        route_id = created_route["id"]
        resp = requests.get(f"{BASE_URL}/routes/{route_id}", timeout=10)
        data = resp.json()
        
        passed = (
            resp.status_code == 200
            and data.get("id") == route_id
            and "_id" not in data
            and data.get("name") == "Test Coastal Loop"
        )
        
        return log_test(
            "Get Route by ID (GET /api/routes/{id})",
            passed,
            f"Status: {resp.status_code}, Route Name: {data.get('name', 'N/A')}"
        )
    except Exception as e:
        return log_test("Get Route by ID", False, f"Error: {str(e)}")

def test_get_route_by_share_code():
    """Test 4: GET /api/routes/share/{share_code} -> should return route and increment views"""
    if not created_route.get("share_code"):
        return log_test("Get Route by Share Code", False, "No share code available")
    
    try:
        share_code = created_route["share_code"]
        route_id = created_route["id"]
        
        # Call share endpoint twice
        resp1 = requests.get(f"{BASE_URL}/routes/share/{share_code}", timeout=10)
        data1 = resp1.json()
        
        time.sleep(0.5)  # Small delay
        
        resp2 = requests.get(f"{BASE_URL}/routes/share/{share_code}", timeout=10)
        data2 = resp2.json()
        
        # Now get the route by ID to check views counter
        resp3 = requests.get(f"{BASE_URL}/routes/{route_id}", timeout=10)
        data3 = resp3.json()
        
        passed = (
            resp1.status_code == 200
            and resp2.status_code == 200
            and resp3.status_code == 200
            and data3.get("views") == 2  # Should be incremented twice
        )
        
        return log_test(
            "Get Route by Share Code (GET /api/routes/share/{code})",
            passed,
            f"Status: {resp1.status_code}, Views after 2 calls: {data3.get('views', 'N/A')}"
        )
    except Exception as e:
        return log_test("Get Route by Share Code", False, f"Error: {str(e)}")

def test_list_routes():
    """Test 5: GET /api/routes -> list routes"""
    try:
        resp = requests.get(f"{BASE_URL}/routes", timeout=10)
        data = resp.json()
        
        passed = (
            resp.status_code == 200
            and isinstance(data, list)
            and len(data) > 0
            and any(r.get("id") == created_route.get("id") for r in data)
        )
        
        return log_test(
            "List Routes (GET /api/routes)",
            passed,
            f"Status: {resp.status_code}, Routes count: {len(data)}"
        )
    except Exception as e:
        return log_test("List Routes", False, f"Error: {str(e)}")

def test_list_routes_by_user():
    """Test 6: GET /api/routes?user_id=test-user-1 -> filter by user"""
    try:
        resp = requests.get(f"{BASE_URL}/routes?user_id=test-user-1", timeout=10)
        data = resp.json()
        
        passed = (
            resp.status_code == 200
            and isinstance(data, list)
            and all(r.get("user_id") == "test-user-1" for r in data)
        )
        
        return log_test(
            "List Routes by User (GET /api/routes?user_id=test-user-1)",
            passed,
            f"Status: {resp.status_code}, User routes count: {len(data)}"
        )
    except Exception as e:
        return log_test("List Routes by User", False, f"Error: {str(e)}")

def test_list_routes_sort():
    """Test 7: GET /api/routes?sort=trending and sort=popular"""
    try:
        resp1 = requests.get(f"{BASE_URL}/routes?sort=trending", timeout=10)
        data1 = resp1.json()
        
        resp2 = requests.get(f"{BASE_URL}/routes?sort=popular", timeout=10)
        data2 = resp2.json()
        
        passed = (
            resp1.status_code == 200
            and resp2.status_code == 200
            and isinstance(data1, list)
            and isinstance(data2, list)
        )
        
        return log_test(
            "List Routes with Sort (trending/popular)",
            passed,
            f"Trending: {resp1.status_code}, Popular: {resp2.status_code}"
        )
    except Exception as e:
        return log_test("List Routes with Sort", False, f"Error: {str(e)}")

def test_ai_summarize():
    """Test 8: POST /api/routes/{id}/summarize -> AI summary via Emergent LLM"""
    if not created_route.get("id"):
        return log_test("AI Summarize", False, "No route ID available")
    
    try:
        route_id = created_route["id"]
        resp = requests.post(f"{BASE_URL}/routes/{route_id}/summarize", timeout=30)
        data = resp.json()
        
        # Verify response structure
        passed = (
            resp.status_code == 200
            and "summary" in data
            and "difficulty" in data
            and "fuel_note" in data
            and "vibe" in data
            and "generated_at" in data
            and isinstance(data["summary"], str)
            and len(data["summary"]) > 0
            and isinstance(data["difficulty"], int)
            and 1 <= data["difficulty"] <= 5
        )
        
        if passed:
            # Verify it's persisted
            time.sleep(0.5)
            resp2 = requests.get(f"{BASE_URL}/routes/{route_id}", timeout=10)
            data2 = resp2.json()
            passed = passed and data2.get("ai_summary") is not None
        
        return log_test(
            "AI Summarize (POST /api/routes/{id}/summarize)",
            passed,
            f"Status: {resp.status_code}, Summary length: {len(data.get('summary', ''))}, Difficulty: {data.get('difficulty', 'N/A')}"
        )
    except Exception as e:
        return log_test("AI Summarize", False, f"Error: {str(e)}")

def test_like_unlike():
    """Test 9: POST /api/routes/{id}/like -> like and unlike"""
    if not created_route.get("id"):
        return log_test("Like/Unlike", False, "No route ID available")
    
    try:
        route_id = created_route["id"]
        
        # Like
        resp1 = requests.post(f"{BASE_URL}/routes/{route_id}/like", json={}, timeout=10)
        data1 = resp1.json()
        
        # Unlike
        resp2 = requests.post(f"{BASE_URL}/routes/{route_id}/like", json={"unlike": True}, timeout=10)
        data2 = resp2.json()
        
        passed = (
            resp1.status_code == 200
            and resp2.status_code == 200
            and data1.get("likes") == 1
            and data2.get("likes") == 0
        )
        
        return log_test(
            "Like/Unlike (POST /api/routes/{id}/like)",
            passed,
            f"After like: {data1.get('likes', 'N/A')}, After unlike: {data2.get('likes', 'N/A')}"
        )
    except Exception as e:
        return log_test("Like/Unlike", False, f"Error: {str(e)}")

def test_rating():
    """Test 10: POST /api/routes/{id}/rate -> rating with upsert"""
    if not created_route.get("id"):
        return log_test("Rating", False, "No route ID available")
    
    try:
        route_id = created_route["id"]
        
        # First rating: user-1 gives 5 stars
        resp1 = requests.post(
            f"{BASE_URL}/routes/{route_id}/rate",
            json={"user_id": "test-user-1", "stars": 5},
            timeout=10
        )
        data1 = resp1.json()
        
        # Second rating: user-2 gives 3 stars
        resp2 = requests.post(
            f"{BASE_URL}/routes/{route_id}/rate",
            json={"user_id": "test-user-2", "stars": 3},
            timeout=10
        )
        data2 = resp2.json()
        
        # Third rating: user-2 updates to 4 stars (upsert)
        resp3 = requests.post(
            f"{BASE_URL}/routes/{route_id}/rate",
            json={"user_id": "test-user-2", "stars": 4},
            timeout=10
        )
        data3 = resp3.json()
        
        passed = (
            resp1.status_code == 200
            and resp2.status_code == 200
            and resp3.status_code == 200
            and data1.get("rating_avg") == 5.0
            and data1.get("rating_count") == 1
            and data2.get("rating_avg") == 4.0
            and data2.get("rating_count") == 2
            and data3.get("rating_avg") == 4.5
            and data3.get("rating_count") == 2  # Count stays 2 (upsert)
        )
        
        return log_test(
            "Rating (POST /api/routes/{id}/rate)",
            passed,
            f"After 5★: avg={data1.get('rating_avg')}, count={data1.get('rating_count')}; "
            f"After 3★: avg={data2.get('rating_avg')}, count={data2.get('rating_count')}; "
            f"After upsert 4★: avg={data3.get('rating_avg')}, count={data3.get('rating_count')}"
        )
    except Exception as e:
        return log_test("Rating", False, f"Error: {str(e)}")

def test_comments():
    """Test 11: POST /api/routes/{id}/comments -> add and list comments"""
    if not created_route.get("id"):
        return log_test("Comments", False, "No route ID available")
    
    try:
        route_id = created_route["id"]
        
        # Add valid comment
        resp1 = requests.post(
            f"{BASE_URL}/routes/{route_id}/comments",
            json={"user_id": "test-user-1", "author": "Alice", "text": "Loved it"},
            timeout=10
        )
        data1 = resp1.json()
        
        # Try empty comment (should fail)
        resp2 = requests.post(
            f"{BASE_URL}/routes/{route_id}/comments",
            json={"text": "   "},
            timeout=10
        )
        
        # List comments
        resp3 = requests.get(f"{BASE_URL}/routes/{route_id}/comments", timeout=10)
        data3 = resp3.json()
        
        passed = (
            resp1.status_code == 200
            and "id" in data1
            and data1.get("text") == "Loved it"
            and resp2.status_code == 400  # Empty comment should fail
            and resp3.status_code == 200
            and isinstance(data3, list)
            and len(data3) > 0
            and any(c.get("text") == "Loved it" for c in data3)
        )
        
        return log_test(
            "Comments (POST/GET /api/routes/{id}/comments)",
            passed,
            f"Add comment: {resp1.status_code}, Empty comment: {resp2.status_code}, List: {len(data3)} comments"
        )
    except Exception as e:
        return log_test("Comments", False, f"Error: {str(e)}")

def test_conditions():
    """Test 12: POST /api/routes/{id}/conditions -> add and list conditions"""
    if not created_route.get("id"):
        return log_test("Conditions", False, "No route ID available")
    
    try:
        route_id = created_route["id"]
        
        # Add condition
        resp1 = requests.post(
            f"{BASE_URL}/routes/{route_id}/conditions",
            json={
                "user_id": "test-user-1",
                "author": "Alice",
                "type": "pothole",
                "text": "Big pothole",
                "km_mark": 2
            },
            timeout=10
        )
        data1 = resp1.json()
        
        # List conditions
        resp2 = requests.get(f"{BASE_URL}/routes/{route_id}/conditions", timeout=10)
        data2 = resp2.json()
        
        passed = (
            resp1.status_code == 200
            and "id" in data1
            and data1.get("type") == "pothole"
            and resp2.status_code == 200
            and isinstance(data2, list)
            and len(data2) > 0
            and any(c.get("text") == "Big pothole" for c in data2)
        )
        
        return log_test(
            "Conditions (POST/GET /api/routes/{id}/conditions)",
            passed,
            f"Add condition: {resp1.status_code}, List: {len(data2)} conditions"
        )
    except Exception as e:
        return log_test("Conditions", False, f"Error: {str(e)}")

def test_delete_route():
    """Test 13: DELETE /api/routes/{id} -> delete route and cleanup"""
    if not created_route.get("id"):
        return log_test("Delete Route", False, "No route ID available")
    
    try:
        route_id = created_route["id"]
        
        # Delete route
        resp1 = requests.delete(f"{BASE_URL}/routes/{route_id}", timeout=10)
        data1 = resp1.json()
        
        # Try to get deleted route (should be 404)
        resp2 = requests.get(f"{BASE_URL}/routes/{route_id}", timeout=10)
        
        passed = (
            resp1.status_code == 200
            and data1.get("ok") == True
            and resp2.status_code == 404
        )
        
        return log_test(
            "Delete Route (DELETE /api/routes/{id})",
            passed,
            f"Delete: {resp1.status_code}, Get after delete: {resp2.status_code}"
        )
    except Exception as e:
        return log_test("Delete Route", False, f"Error: {str(e)}")

def test_not_found():
    """Test 14: GET /api/routes/share/NOTREAL -> 404"""
    try:
        resp = requests.get(f"{BASE_URL}/routes/share/NOTREAL", timeout=10)
        data = resp.json()
        
        passed = (
            resp.status_code == 404
            and "error" in data
        )
        
        return log_test(
            "Not Found (GET /api/routes/share/NOTREAL)",
            passed,
            f"Status: {resp.status_code}, Response: {data}"
        )
    except Exception as e:
        return log_test("Not Found", False, f"Error: {str(e)}")

def main():
    """Run all tests"""
    print("=" * 80)
    print("RAASTA BACKEND API TEST SUITE")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    results = []
    
    # Run tests in sequence
    results.append(test_health_check())
    results.append(test_create_route())
    results.append(test_get_route_by_id())
    results.append(test_get_route_by_share_code())
    results.append(test_list_routes())
    results.append(test_list_routes_by_user())
    results.append(test_list_routes_sort())
    results.append(test_ai_summarize())
    results.append(test_like_unlike())
    results.append(test_rating())
    results.append(test_comments())
    results.append(test_conditions())
    results.append(test_delete_route())
    results.append(test_not_found())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("\n⚠️  SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
