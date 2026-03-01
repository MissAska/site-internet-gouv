"""
Backend API tests for Eyefind Tax Portal - GTA RP Business Management
Tests: Auth, Admin users, Businesses, Transactions, Tax notices, Global accounting
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "l.bennett@eyefinds.gouvernement.info"
ADMIN_PASSWORD = "password"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        # Verify no ObjectId leaked
        assert "_id" not in data["user"], "ObjectId leaked in user response"
        
    def test_admin_login_wrong_password(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        
    def test_auth_me_without_token(self):
        """Test /auth/me without token - should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]


class TestAdminUsers:
    """Admin user management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_users(self):
        """GET /api/admin/users - should return users with business_name field, no ObjectId"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify structure and no ObjectId
        for user in data:
            assert "id" in user, "Missing id field"
            assert "email" in user, "Missing email field"
            assert "name" in user, "Missing name field"
            assert "role" in user, "Missing role field"
            assert "_id" not in user, f"ObjectId leaked in user: {user}"
            # Check business_name field exists (can be null)
            assert "business_name" in user or user.get("business_id") is None, "Missing business_name field"
            
        print(f"Got {len(data)} users, all without ObjectId leak")
    
    def test_get_users_without_auth(self):
        """GET /api/admin/users without auth - should fail"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403]


class TestBusinesses:
    """Business management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_businesses(self):
        """GET /api/businesses - should return businesses with totals, no ObjectId"""
        response = requests.get(f"{BASE_URL}/api/businesses", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        for business in data:
            # Verify required fields
            assert "id" in business, "Missing id field"
            assert "name" in business, "Missing name field"
            assert "owner_id" in business, "Missing owner_id field"
            assert "owner_name" in business, "Missing owner_name field"
            
            # Verify financial totals
            assert "total_income" in business, "Missing total_income field"
            assert "total_expenses" in business, "Missing total_expenses field"
            assert "total_salaries" in business, "Missing total_salaries field"
            
            # Verify no ObjectId
            assert "_id" not in business, f"ObjectId leaked in business: {business}"
            
        print(f"Got {len(data)} businesses with financial totals")


class TestGlobalAccounting:
    """Global accounting endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_global_accounting(self):
        """GET /api/accounting/global - should return businesses array with totals object"""
        response = requests.get(f"{BASE_URL}/api/accounting/global", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "businesses" in data, "Missing businesses array"
        assert "totals" in data, "Missing totals object"
        assert isinstance(data["businesses"], list), "businesses should be array"
        assert isinstance(data["totals"], dict), "totals should be object"
        
        # Verify totals structure
        totals = data["totals"]
        expected_fields = ["total_businesses", "total_income", "total_expenses", 
                          "total_salaries", "total_gross_profit", "total_taxes_paid",
                          "total_transactions", "total_employees"]
        for field in expected_fields:
            assert field in totals, f"Missing {field} in totals"
        
        # Verify no ObjectId in businesses
        for biz in data["businesses"]:
            assert "_id" not in biz, f"ObjectId leaked in accounting business: {biz}"
            
        print(f"Global accounting: {totals['total_businesses']} businesses, ${totals['total_income']} total income")


class TestAdminExpenses:
    """Admin expenses review endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_all_expenses(self):
        """GET /api/admin/expenses - should return expenses with business_name, no ObjectId"""
        response = requests.get(f"{BASE_URL}/api/admin/expenses", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        for expense in data:
            # Verify required fields
            assert "id" in expense, "Missing id field"
            assert "business_id" in expense, "Missing business_id field"
            assert "type" in expense, "Missing type field"
            assert expense["type"] == "expense", f"Wrong type: {expense['type']}"
            
            # Verify business_name enrichment
            assert "business_name" in expense, "Missing business_name field"
            
            # Verify no ObjectId
            assert "_id" not in expense, f"ObjectId leaked in expense: {expense}"
            
        print(f"Got {len(data)} expenses, all with business_name field")


class TestTransactions:
    """Transaction (cash register) endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and find a business owner"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get a patron user for transaction tests
        users_res = requests.get(f"{BASE_URL}/api/admin/users", headers=self.admin_headers)
        if users_res.status_code == 200:
            users = users_res.json()
            patrons = [u for u in users if u["role"] == "patron"]
            if patrons:
                self.patron_email = patrons[0]["email"]
            else:
                self.patron_email = None
        else:
            self.patron_email = None
    
    def test_create_income_transaction_patron(self):
        """POST /api/transactions - create income transaction as patron"""
        if not self.patron_email:
            pytest.skip("No patron user found for transaction test")
        
        # Login as patron (using default password)
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.patron_email,
            "password": "password"  # Default password
        })
        
        if login_res.status_code != 200:
            pytest.skip(f"Patron login failed: {login_res.text}")
        
        patron_token = login_res.json()["access_token"]
        patron_headers = {"Authorization": f"Bearer {patron_token}"}
        
        # Create income transaction
        transaction_data = {
            "type": "income",
            "amount": 1500.00,
            "description": "TEST_Transaction test income"
        }
        
        response = requests.post(f"{BASE_URL}/api/transactions", 
                                json=transaction_data, 
                                headers=patron_headers)
        
        assert response.status_code == 200, f"Failed to create transaction: {response.text}"
        
        data = response.json()
        assert "id" in data, "Missing id in response"
        assert data["type"] == "income", f"Wrong type: {data['type']}"
        assert data["amount"] == 1500.00, f"Wrong amount: {data['amount']}"
        assert "_id" not in data, "ObjectId leaked in transaction response"
        
        print(f"Created income transaction: {data['id']}")
    
    def test_get_transactions(self):
        """GET /api/transactions - verify no ObjectId in response"""
        if not self.patron_email:
            pytest.skip("No patron user found")
            
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.patron_email,
            "password": "password"
        })
        
        if login_res.status_code != 200:
            pytest.skip("Patron login failed")
        
        patron_token = login_res.json()["access_token"]
        patron_headers = {"Authorization": f"Bearer {patron_token}"}
        
        response = requests.get(f"{BASE_URL}/api/transactions", headers=patron_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        for tx in data:
            assert "_id" not in tx, f"ObjectId leaked in transaction: {tx}"


class TestTaxNotices:
    """Tax notices endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_tax_notices(self):
        """GET /api/tax-notices - verify response structure and no ObjectId"""
        response = requests.get(f"{BASE_URL}/api/tax-notices", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        for notice in data:
            assert "id" in notice, "Missing id field"
            assert "business_id" in notice, "Missing business_id field"
            assert "business_name" in notice, "Missing business_name field"
            assert "tax_amount" in notice, "Missing tax_amount field"
            assert "_id" not in notice, f"ObjectId leaked in tax notice: {notice}"
            
        print(f"Got {len(data)} tax notices")
    
    def test_generate_tax_notices(self):
        """POST /api/tax-notices/generate - generate new tax notices"""
        response = requests.post(f"{BASE_URL}/api/tax-notices/generate", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        for notice in data:
            assert "_id" not in notice, f"ObjectId leaked in generated notice: {notice}"
            
        print(f"Generated {len(data)} tax notices")


class TestAdminStats:
    """Admin dashboard stats tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_admin_stats(self):
        """GET /api/stats/admin - verify stats structure"""
        response = requests.get(f"{BASE_URL}/api/stats/admin", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        expected_fields = ["total_businesses", "total_employees", "total_transactions",
                          "total_income", "total_taxes_collected"]
        
        for field in expected_fields:
            assert field in data, f"Missing {field} in stats"
            
        print(f"Admin stats: {data['total_businesses']} businesses, {data['total_employees']} employees")


class TestTaxBrackets:
    """Tax brackets endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_tax_brackets(self):
        """GET /api/tax-brackets - verify tax brackets response"""
        response = requests.get(f"{BASE_URL}/api/tax-brackets", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one tax bracket"
        
        for bracket in data:
            assert "min_amount" in bracket, "Missing min_amount"
            assert "rate" in bracket, "Missing rate"
            assert "_id" not in bracket, f"ObjectId leaked in bracket: {bracket}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
