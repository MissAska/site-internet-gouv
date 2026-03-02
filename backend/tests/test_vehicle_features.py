"""
Test Vehicle Catalog and Vehicle Orders endpoints for GTA RP Eyefind
Tests: Vehicle seeding, CRUD operations, Order creation with reduction validation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://business-admin-suite.preview.emergentagent.com').rstrip('/')

# ========== FIXTURES ==========

@pytest.fixture(scope="session")
def admin_token():
    """Get admin token (l.bennett@eyefinds.gouvernement.info)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "l.bennett@eyefinds.gouvernement.info",
        "password": "password"
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    return response.json()["access_token"]

@pytest.fixture(scope="session")
def patron_token():
    """Get patron token (patron.test@lsc.rp)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "patron.test@lsc.rp",
        "password": "password"
    })
    if response.status_code != 200:
        pytest.skip(f"Patron login failed: {response.status_code} - {response.text}")
    return response.json()["access_token"]

@pytest.fixture
def admin_client(admin_token):
    """Admin authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session

@pytest.fixture
def patron_client(patron_token):
    """Patron authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {patron_token}",
        "Content-Type": "application/json"
    })
    return session

@pytest.fixture
def unauthenticated_client():
    """Unauthenticated session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ========== VEHICLE CATALOG TESTS ==========

class TestVehicleCatalog:
    """Vehicle Catalog CRUD tests"""

    def test_seed_vehicles_already_seeded(self, admin_client):
        """POST /api/vehicles/seed - should indicate already seeded"""
        response = admin_client.post(f"{BASE_URL}/api/vehicles/seed")
        assert response.status_code == 200
        data = response.json()
        # Should indicate already seeded or return count
        assert "message" in data
        print(f"Seed response: {data['message']}")

    def test_get_all_vehicles(self, unauthenticated_client):
        """GET /api/vehicles - returns all vehicles (no auth required)"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        vehicles = response.json()
        assert isinstance(vehicles, list)
        assert len(vehicles) > 0, "Expected at least 1 vehicle in catalog"
        # Verify structure
        first = vehicles[0]
        assert "id" in first
        assert "name" in first
        assert "category" in first
        assert "price" in first
        print(f"Found {len(vehicles)} vehicles in catalog")

    def test_get_vehicle_categories(self, unauthenticated_client):
        """GET /api/vehicles/categories - returns 4 categories"""
        response = unauthenticated_client.get(f"{BASE_URL}/api/vehicles/categories")
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        expected_categories = ["Commercial", "Compacts", "Coupes", "Drift"]
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        print(f"Categories: {categories}")

    def test_create_vehicle_patron(self, patron_client):
        """POST /api/vehicles - patron can create a vehicle"""
        vehicle_data = {
            "name": "TEST_Vehicle_Create",
            "category": "Test Category",
            "price": 99999
        }
        response = patron_client.post(f"{BASE_URL}/api/vehicles", json=vehicle_data)
        assert response.status_code == 200
        vehicle = response.json()
        assert vehicle["name"] == vehicle_data["name"]
        assert vehicle["category"] == vehicle_data["category"]
        assert vehicle["price"] == vehicle_data["price"]
        assert "id" in vehicle
        # Cleanup
        delete_resp = patron_client.delete(f"{BASE_URL}/api/vehicles/{vehicle['id']}")
        assert delete_resp.status_code == 200
        print(f"Created and cleaned up vehicle: {vehicle['name']}")

    def test_update_vehicle_price(self, patron_client):
        """PUT /api/vehicles/{id} - update vehicle price"""
        # Create a test vehicle first
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicles", json={
            "name": "TEST_Vehicle_Update",
            "category": "Test",
            "price": 10000
        })
        assert create_resp.status_code == 200
        vehicle = create_resp.json()
        vehicle_id = vehicle["id"]

        # Update price
        new_price = 25000
        update_resp = patron_client.put(f"{BASE_URL}/api/vehicles/{vehicle_id}", json={
            "price": new_price
        })
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["price"] == new_price

        # Verify persistence with GET
        get_resp = patron_client.get(f"{BASE_URL}/api/vehicles")
        assert get_resp.status_code == 200
        vehicles = get_resp.json()
        found = next((v for v in vehicles if v["id"] == vehicle_id), None)
        assert found is not None
        assert found["price"] == new_price

        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}")
        print(f"Updated vehicle price from 10000 to {new_price}")

    def test_delete_vehicle(self, patron_client):
        """DELETE /api/vehicles/{id} - delete vehicle"""
        # Create a test vehicle
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicles", json={
            "name": "TEST_Vehicle_Delete",
            "category": "Test",
            "price": 5000
        })
        assert create_resp.status_code == 200
        vehicle_id = create_resp.json()["id"]

        # Delete it
        delete_resp = patron_client.delete(f"{BASE_URL}/api/vehicles/{vehicle_id}")
        assert delete_resp.status_code == 200

        # Verify deleted (should not appear in list)
        get_resp = patron_client.get(f"{BASE_URL}/api/vehicles")
        vehicles = get_resp.json()
        found = next((v for v in vehicles if v["id"] == vehicle_id), None)
        assert found is None, "Vehicle should be deleted"
        print("Successfully deleted test vehicle")


# ========== VEHICLE ORDERS TESTS ==========

class TestVehicleOrders:
    """Vehicle Orders CRUD tests"""

    @pytest.fixture(autouse=True)
    def setup_vehicle(self, patron_client):
        """Get a vehicle ID to use in tests"""
        response = patron_client.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        vehicles = response.json()
        assert len(vehicles) > 0, "Need at least one vehicle in catalog"
        self.test_vehicle = vehicles[0]
        print(f"Using vehicle: {self.test_vehicle['name']} ({self.test_vehicle['id']})")

    def test_create_order_valid(self, patron_client):
        """POST /api/vehicle-orders - create order with valid data"""
        order_data = {
            "client_name": "TEST_Client_Order",
            "client_phone": "555-1234",
            "client_enterprise": "Test Corp",
            "vehicle_id": self.test_vehicle["id"],
            "reduction_percent": 10.0,
            "reduction_exceptional": 500,
            "commentary": "Test order"
        }
        response = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json=order_data)
        assert response.status_code == 200
        order = response.json()
        assert order["client_name"] == order_data["client_name"]
        assert order["vehicle_id"] == self.test_vehicle["id"]
        assert order["reduction_percent"] == 10.0
        assert order["advancement"] == "en_attente"
        # Verify price calculation
        expected_price = self.test_vehicle["price"] - (self.test_vehicle["price"] * 0.10) - 500
        assert order["final_price"] == max(0, expected_price)
        
        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order['id']}")
        print(f"Created order for {order_data['client_name']} - Price: {order['final_price']}")

    def test_create_order_reduction_max_30_percent(self, patron_client):
        """POST /api/vehicle-orders with reduction >30% should fail with 400"""
        order_data = {
            "client_name": "TEST_Client_HighReduction",
            "client_phone": "555-9999",
            "vehicle_id": self.test_vehicle["id"],
            "reduction_percent": 35.0,  # > 30% should fail
            "reduction_exceptional": 0,
            "commentary": ""
        }
        response = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json=order_data)
        assert response.status_code == 400, f"Expected 400 for >30% reduction, got {response.status_code}"
        assert "30" in response.text.lower() or "réduction" in response.text.lower()
        print("Correctly rejected order with >30% reduction")

    def test_create_order_exactly_30_percent(self, patron_client):
        """POST /api/vehicle-orders with exactly 30% reduction should succeed"""
        order_data = {
            "client_name": "TEST_Client_Max30",
            "vehicle_id": self.test_vehicle["id"],
            "reduction_percent": 30.0,  # Exactly 30% should work
        }
        response = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json=order_data)
        assert response.status_code == 200
        order = response.json()
        assert order["reduction_percent"] == 30.0
        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order['id']}")
        print("Accepted order with exactly 30% reduction")

    def test_get_orders_for_business(self, patron_client):
        """GET /api/vehicle-orders - returns orders for user's business"""
        # Create a test order
        order_data = {
            "client_name": "TEST_Client_GetOrders",
            "vehicle_id": self.test_vehicle["id"],
            "reduction_percent": 5.0
        }
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json=order_data)
        assert create_resp.status_code == 200
        order_id = create_resp.json()["id"]

        # Get orders
        response = patron_client.get(f"{BASE_URL}/api/vehicle-orders")
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        # Should find our order
        found = next((o for o in orders if o["id"] == order_id), None)
        assert found is not None, "Should find created order in list"
        assert found["client_name"] == order_data["client_name"]

        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order_id}")
        print(f"Found {len(orders)} orders for business")

    def test_update_order_advancement_fabrication(self, patron_client):
        """PUT /api/vehicle-orders/{id}/advancement?advancement=fabrication"""
        # Create order
        order_data = {
            "client_name": "TEST_Client_Advancement",
            "vehicle_id": self.test_vehicle["id"],
            "reduction_percent": 0
        }
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json=order_data)
        assert create_resp.status_code == 200
        order = create_resp.json()
        assert order["advancement"] == "en_attente"

        # Update to fabrication
        update_resp = patron_client.put(
            f"{BASE_URL}/api/vehicle-orders/{order['id']}/advancement?advancement=fabrication"
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["advancement"] == "fabrication"

        # Update to receptionne
        update_resp2 = patron_client.put(
            f"{BASE_URL}/api/vehicle-orders/{order['id']}/advancement?advancement=receptionne"
        )
        assert update_resp2.status_code == 200
        assert update_resp2.json()["advancement"] == "receptionne"

        # Update to livre
        update_resp3 = patron_client.put(
            f"{BASE_URL}/api/vehicle-orders/{order['id']}/advancement?advancement=livre"
        )
        assert update_resp3.status_code == 200
        assert update_resp3.json()["advancement"] == "livre"

        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order['id']}")
        print("Successfully tested all advancement statuses: en_attente → fabrication → receptionne → livre")

    def test_update_order_advancement_with_dna_comment(self, patron_client):
        """PUT /api/vehicle-orders/{id}/advancement with dna_comment"""
        # Create order
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "TEST_Client_DNA",
            "vehicle_id": self.test_vehicle["id"],
            "reduction_percent": 0
        })
        assert create_resp.status_code == 200
        order = create_resp.json()

        # Update with DNA comment
        dna_comment = "Véhicule en préparation - peinture spéciale"
        update_resp = patron_client.put(
            f"{BASE_URL}/api/vehicle-orders/{order['id']}/advancement?advancement=fabrication&dna_comment={dna_comment}"
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["dna_comment"] == dna_comment
        assert updated["advancement"] == "fabrication"

        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order['id']}")
        print(f"DNA comment saved: {dna_comment}")

    def test_toggle_client_called(self, patron_client):
        """PUT /api/vehicle-orders/{id}/call - toggle client called"""
        # Create order
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "TEST_Client_Call",
            "vehicle_id": self.test_vehicle["id"],
            "client_phone": "555-CALL"
        })
        assert create_resp.status_code == 200
        order = create_resp.json()
        assert order["client_called"] == False

        # Toggle to True
        toggle_resp = patron_client.put(f"{BASE_URL}/api/vehicle-orders/{order['id']}/call")
        assert toggle_resp.status_code == 200
        assert toggle_resp.json()["client_called"] == True

        # Toggle back to False
        toggle_resp2 = patron_client.put(f"{BASE_URL}/api/vehicle-orders/{order['id']}/call")
        assert toggle_resp2.status_code == 200
        assert toggle_resp2.json()["client_called"] == False

        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order['id']}")
        print("Successfully toggled client_called: False → True → False")

    def test_delete_order(self, patron_client):
        """DELETE /api/vehicle-orders/{id} - delete order"""
        # Create order
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "TEST_Client_Delete",
            "vehicle_id": self.test_vehicle["id"]
        })
        assert create_resp.status_code == 200
        order_id = create_resp.json()["id"]

        # Delete it
        delete_resp = patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order_id}")
        assert delete_resp.status_code == 200

        # Verify not in list
        get_resp = patron_client.get(f"{BASE_URL}/api/vehicle-orders")
        orders = get_resp.json()
        found = next((o for o in orders if o["id"] == order_id), None)
        assert found is None, "Deleted order should not appear in list"
        print("Successfully deleted order")


# ========== ADMIN ACCESS TESTS ==========

class TestAdminVehicleOrders:
    """Admin specific vehicle order tests"""

    def test_admin_cannot_create_order(self, admin_client):
        """Admin should NOT be able to create orders (403)"""
        # Get a vehicle first
        veh_resp = admin_client.get(f"{BASE_URL}/api/vehicles")
        vehicles = veh_resp.json()
        vehicle_id = vehicles[0]["id"]

        # Try to create order as admin
        response = admin_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "Admin Test",
            "vehicle_id": vehicle_id
        })
        assert response.status_code == 403, f"Admin should not create orders, got {response.status_code}"
        print("Correctly blocked admin from creating orders")

    def test_admin_can_view_all_orders(self, admin_client):
        """Admin can view all orders from all businesses"""
        response = admin_client.get(f"{BASE_URL}/api/vehicle-orders")
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"Admin can view all {len(orders)} orders")


# ========== EDGE CASES ==========

class TestEdgeCases:
    """Edge case tests"""

    def test_order_with_invalid_vehicle_id(self, patron_client):
        """Should fail with 404 for non-existent vehicle"""
        response = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "Test",
            "vehicle_id": "non-existent-vehicle-id-12345"
        })
        assert response.status_code == 404
        print("Correctly rejected order with invalid vehicle_id")

    def test_order_with_negative_reduction(self, patron_client):
        """Should fail with 400 for negative reduction"""
        veh_resp = patron_client.get(f"{BASE_URL}/api/vehicles")
        vehicle_id = veh_resp.json()[0]["id"]

        response = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "Test",
            "vehicle_id": vehicle_id,
            "reduction_percent": -10.0
        })
        assert response.status_code == 400, f"Expected 400 for negative reduction, got {response.status_code}"
        print("Correctly rejected negative reduction")

    def test_invalid_advancement_status(self, patron_client):
        """Should fail with 400 for invalid advancement status"""
        veh_resp = patron_client.get(f"{BASE_URL}/api/vehicles")
        vehicle_id = veh_resp.json()[0]["id"]

        # Create order
        create_resp = patron_client.post(f"{BASE_URL}/api/vehicle-orders", json={
            "client_name": "TEST_Invalid_Status",
            "vehicle_id": vehicle_id
        })
        assert create_resp.status_code == 200
        order_id = create_resp.json()["id"]

        # Try invalid status
        update_resp = patron_client.put(
            f"{BASE_URL}/api/vehicle-orders/{order_id}/advancement?advancement=invalid_status"
        )
        assert update_resp.status_code == 400
        
        # Cleanup
        patron_client.delete(f"{BASE_URL}/api/vehicle-orders/{order_id}")
        print("Correctly rejected invalid advancement status")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
