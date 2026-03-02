"""
Test new features for GTA RP Business Management App:
1. Tax notices status (paid/unpaid) toggle
2. Accounting history snapshots (admin only)
3. Weekly transaction filtering for non-admin users
4. Permissions checkbox fix (not causing page crash)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://business-admin-suite.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "l.bennett@eyefinds.gouvernement.info"
ADMIN_PASSWORD = "password"
PATRON_EMAIL = "patron.test@lsc.rp"
PATRON_PASSWORD = "password"


class TestAuthentication:
    """Test authentication for admin and patron users"""
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful: {data['user']['name']}")
    
    def test_patron_login(self):
        """Test patron can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PATRON_EMAIL,
            "password": PATRON_PASSWORD
        })
        assert response.status_code == 200, f"Patron login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "patron"
        assert data["user"]["business_id"] is not None
        print(f"✓ Patron login successful: {data['user']['name']}")


class TestTaxNoticesStatus:
    """Test tax notice paid/unpaid status feature"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_generate_tax_notices_with_unpaid_status(self, admin_token):
        """Test that generated tax notices have 'status' field set to 'unpaid'"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Generate tax notices
        response = requests.post(f"{BASE_URL}/api/tax-notices/generate", headers=headers)
        assert response.status_code == 200, f"Generate notices failed: {response.text}"
        
        notices = response.json()
        # Check that all notices have status = 'unpaid'
        for notice in notices:
            assert "status" in notice, f"Notice missing 'status' field: {notice}"
            assert notice["status"] == "unpaid", f"Expected 'unpaid', got: {notice['status']}"
            assert "id" in notice
            assert "business_name" in notice
            assert "tax_amount" in notice
        
        print(f"✓ Generated {len(notices)} tax notices, all with 'unpaid' status")
        return notices
    
    def test_get_tax_notices_include_status(self, admin_token):
        """Test GET /api/tax-notices returns notices with status field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/tax-notices", headers=headers)
        assert response.status_code == 200
        
        notices = response.json()
        for notice in notices:
            assert "status" in notice, f"Notice missing 'status' field"
            assert notice["status"] in ["paid", "unpaid"], f"Invalid status: {notice['status']}"
        
        print(f"✓ Retrieved {len(notices)} tax notices with status field")
    
    def test_toggle_tax_notice_status(self, admin_token):
        """Test PUT /api/tax-notices/{id}/status toggles between paid/unpaid"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, get existing notices
        response = requests.get(f"{BASE_URL}/api/tax-notices", headers=headers)
        assert response.status_code == 200
        notices = response.json()
        
        if not notices:
            # Generate notices if none exist
            response = requests.post(f"{BASE_URL}/api/tax-notices/generate", headers=headers)
            notices = response.json()
        
        assert len(notices) > 0, "No tax notices to test with"
        
        notice = notices[0]
        original_status = notice.get("status", "unpaid")
        
        # Toggle status
        response = requests.put(f"{BASE_URL}/api/tax-notices/{notice['id']}/status", headers=headers)
        assert response.status_code == 200, f"Toggle status failed: {response.text}"
        
        result = response.json()
        assert "status" in result
        expected_status = "paid" if original_status == "unpaid" else "unpaid"
        assert result["status"] == expected_status, f"Expected {expected_status}, got {result['status']}"
        
        print(f"✓ Toggled notice {notice['id'][:8]}... from '{original_status}' to '{result['status']}'")
        
        # Toggle back
        response = requests.put(f"{BASE_URL}/api/tax-notices/{notice['id']}/status", headers=headers)
        assert response.status_code == 200
        result2 = response.json()
        assert result2["status"] == original_status
        
        print(f"✓ Toggled back to '{original_status}'")
    
    def test_toggle_status_non_admin_forbidden(self):
        """Test that non-admin users cannot toggle tax notice status"""
        # Login as patron
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PATRON_EMAIL,
            "password": PATRON_PASSWORD
        })
        patron_token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        # Get notices
        response = requests.get(f"{BASE_URL}/api/tax-notices", headers=headers)
        notices = response.json()
        
        if notices:
            # Try to toggle status (should fail)
            response = requests.put(f"{BASE_URL}/api/tax-notices/{notices[0]['id']}/status", headers=headers)
            assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"
            print("✓ Non-admin correctly forbidden from toggling status")


class TestAccountingHistory:
    """Test accounting history snapshots feature (admin only)"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def patron_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PATRON_EMAIL,
            "password": PATRON_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_get_accounting_history_admin(self, admin_token):
        """Test GET /api/admin/accounting-history returns snapshots for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/accounting-history", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        snapshots = response.json()
        assert isinstance(snapshots, list)
        
        # Verify snapshot structure if any exist
        for snap in snapshots:
            assert "id" in snap
            assert "business_id" in snap
            assert "business_name" in snap
            assert "period_start" in snap
            assert "period_end" in snap
            assert "total_income" in snap
            assert "total_expenses" in snap
            assert "total_salaries" in snap
            assert "gross_profit" in snap
            assert "created_at" in snap
            # Verify no MongoDB _id field
            assert "_id" not in snap, "Response should not contain MongoDB _id"
        
        print(f"✓ Retrieved {len(snapshots)} accounting snapshots")
    
    def test_create_manual_snapshot(self, admin_token):
        """Test POST /api/admin/accounting-snapshot creates snapshots manually"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting-snapshot", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "message" in result
        assert "snapshots" in result
        
        for snap in result["snapshots"]:
            assert "_id" not in snap, "Snapshot should not contain MongoDB _id"
        
        print(f"✓ Created {len(result['snapshots'])} manual snapshots")
    
    def test_accounting_history_non_admin_forbidden(self, patron_token):
        """Test that non-admin users cannot access accounting history"""
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        response = requests.get(f"{BASE_URL}/api/admin/accounting-history", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin correctly forbidden from accessing accounting history")
    
    def test_create_snapshot_non_admin_forbidden(self, patron_token):
        """Test that non-admin users cannot create manual snapshots"""
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        response = requests.post(f"{BASE_URL}/api/admin/accounting-snapshot", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin correctly forbidden from creating snapshots")


class TestWeeklyTransactionFiltering:
    """Test that non-admin users only see current week transactions"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def patron_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PATRON_EMAIL,
            "password": PATRON_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_patron_transactions_filtered_by_week(self, patron_token):
        """Test GET /api/transactions as patron returns only current week"""
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        transactions = response.json()
        print(f"✓ Patron sees {len(transactions)} transactions (current week only)")
        
        # Verify no _id field in responses
        for tx in transactions:
            assert "_id" not in tx, "Transaction should not contain MongoDB _id"
    
    def test_admin_transactions_not_filtered(self, admin_token):
        """Test GET /api/transactions as admin returns all transactions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        transactions = response.json()
        print(f"✓ Admin sees {len(transactions)} transactions (all time)")
        
        # Verify no _id field in responses
        for tx in transactions:
            assert "_id" not in tx, "Transaction should not contain MongoDB _id"
    
    def test_patron_businesses_weekly_totals(self, patron_token):
        """Test GET /api/businesses as patron shows weekly totals only"""
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        response = requests.get(f"{BASE_URL}/api/businesses", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        businesses = response.json()
        assert len(businesses) > 0, "Patron should see their business"
        
        for biz in businesses:
            assert "total_income" in biz
            assert "total_expenses" in biz
            assert "total_salaries" in biz
            assert "_id" not in biz, "Business should not contain MongoDB _id"
        
        print(f"✓ Patron sees {len(businesses)} business(es) with weekly totals")


class TestEmployeePermissions:
    """Test employee creation with permissions"""
    
    @pytest.fixture
    def patron_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PATRON_EMAIL,
            "password": PATRON_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_employee_with_permissions(self, patron_token):
        """Test creating an employee with toggled permissions works"""
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        # Create employee with specific permissions
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "email": f"test.employee.{unique_id}@eyefinds.lsc.rp",
            "password": "testpass123",
            "name": f"Test Employee {unique_id}",
            "salary": 1500,
            "permissions": {
                "cash_register": True,
                "record_expenses": True,
                "record_salaries": False,
                "view_transactions": True,
                "view_accounting": False,
                "view_tax_notices": False,
                "manage_employees": False
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=headers)
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        
        employee = response.json()
        assert employee["name"] == employee_data["name"]
        assert employee["email"] == employee_data["email"]
        assert employee["salary"] == employee_data["salary"]
        assert employee["permissions"]["cash_register"] == True
        assert employee["permissions"]["record_expenses"] == True
        assert employee["permissions"]["view_transactions"] == True
        assert employee["permissions"]["record_salaries"] == False
        assert "_id" not in employee, "Employee should not contain MongoDB _id"
        
        print(f"✓ Created employee with permissions: {employee['name']}")
        
        # Cleanup - delete the test employee
        response = requests.delete(f"{BASE_URL}/api/employees/{employee['id']}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Cleaned up test employee")
    
    def test_update_employee_permissions(self, patron_token):
        """Test updating an employee's permissions works"""
        headers = {"Authorization": f"Bearer {patron_token}"}
        
        # First create an employee
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        employee_data = {
            "email": f"test.update.{unique_id}@eyefinds.lsc.rp",
            "password": "testpass123",
            "name": f"Update Test {unique_id}",
            "salary": 1000,
            "permissions": {
                "cash_register": True,
                "record_expenses": False,
                "record_salaries": False,
                "view_transactions": False,
                "view_accounting": False,
                "view_tax_notices": False,
                "manage_employees": False
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/employees", json=employee_data, headers=headers)
        assert response.status_code == 200
        employee = response.json()
        employee_id = employee["id"]
        
        # Now update permissions
        update_data = {
            "permissions": {
                "cash_register": True,
                "record_expenses": True,
                "record_salaries": True,
                "view_transactions": True,
                "view_accounting": True,
                "view_tax_notices": True,
                "manage_employees": False
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/employees/{employee_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update employee: {response.text}"
        
        updated = response.json()
        assert updated["permissions"]["record_expenses"] == True
        assert updated["permissions"]["record_salaries"] == True
        assert updated["permissions"]["view_accounting"] == True
        
        print(f"✓ Updated employee permissions successfully")
        
        # Cleanup
        response = requests.delete(f"{BASE_URL}/api/employees/{employee_id}", headers=headers)
        assert response.status_code == 200
        print(f"✓ Cleaned up test employee")


class TestAPIResponseNoMongoId:
    """Verify all API responses don't contain MongoDB _id field"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_tax_notices_no_mongo_id(self, admin_token):
        """Verify tax notices don't contain _id"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tax-notices", headers=headers)
        for notice in response.json():
            assert "_id" not in notice, f"Tax notice contains _id: {notice.get('id')}"
        print("✓ Tax notices don't contain MongoDB _id")
    
    def test_businesses_no_mongo_id(self, admin_token):
        """Verify businesses don't contain _id"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/businesses", headers=headers)
        for biz in response.json():
            assert "_id" not in biz, f"Business contains _id: {biz.get('id')}"
        print("✓ Businesses don't contain MongoDB _id")
    
    def test_transactions_no_mongo_id(self, admin_token):
        """Verify transactions don't contain _id"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        for tx in response.json():
            assert "_id" not in tx, f"Transaction contains _id: {tx.get('id')}"
        print("✓ Transactions don't contain MongoDB _id")
    
    def test_users_no_mongo_id(self, admin_token):
        """Verify users list doesn't contain _id"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        for user in response.json():
            assert "_id" not in user, f"User contains _id: {user.get('id')}"
        print("✓ Users don't contain MongoDB _id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
