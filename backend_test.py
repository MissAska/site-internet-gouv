import requests
import sys
import json
from datetime import datetime

class GTA_RP_API_Tester:
    def __init__(self, base_url="https://business-admin-suite.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.patron_token = None
        self.employee_token = None
        self.business_id = None
        self.employee_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                return True, response.json() if response.content else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    print(f"   Response: {response.text}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: Error - {str(e)}")
            return False, {}

    def test_admin_init(self):
        """Test admin initialization"""
        success, response = self.run_test(
            "Admin Init",
            "POST", 
            "admin/init",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login", 
            200,
            data={"email": "admin@gouvernement.rp", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"✅ Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_admin_stats(self):
        """Test admin dashboard stats"""
        success, response = self.run_test(
            "Admin Stats",
            "GET",
            "stats/admin",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Stats: {response}")
        return success

    def test_create_business(self):
        """Test business creation"""
        business_data = {
            "name": "Los Santos Customs Test",
            "owner_email": "patron.test@lsc.rp", 
            "owner_name": "Patron Test",
            "owner_password": "patron123"
        }
        success, response = self.run_test(
            "Create Business",
            "POST",
            "businesses",
            200,
            data=business_data,
            token=self.admin_token
        )
        if success and 'id' in response:
            self.business_id = response['id']
            print(f"✅ Business created: {self.business_id}")
            return True
        return False

    def test_patron_login(self):
        """Test patron login with created account"""
        success, response = self.run_test(
            "Patron Login", 
            "POST",
            "auth/login",
            200,
            data={"email": "patron.test@lsc.rp", "password": "patron123"}
        )
        if success and 'access_token' in response:
            self.patron_token = response['access_token']
            print(f"✅ Patron token obtained: {self.patron_token[:20]}...")
            return True
        return False

    def test_create_employee(self):
        """Test employee creation by patron"""
        employee_data = {
            "email": "employee.test@lsc.rp",
            "password": "employee123", 
            "name": "Employee Test",
            "salary": 5000.0
        }
        success, response = self.run_test(
            "Create Employee",
            "POST", 
            "employees",
            200,
            data=employee_data,
            token=self.patron_token
        )
        if success and 'id' in response:
            self.employee_id = response['id']
            print(f"✅ Employee created: {self.employee_id}")
            return True
        return False

    def test_employee_login(self):
        """Test employee login"""
        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login", 
            200,
            data={"email": "employee.test@lsc.rp", "password": "employee123"}
        )
        if success and 'access_token' in response:
            self.employee_token = response['access_token']
            print(f"✅ Employee token obtained: {self.employee_token[:20]}...")
            return True
        return False

    def test_cash_register_transactions(self):
        """Test cash register transactions"""
        transactions = [
            {"type": "income", "amount": 15000, "description": "Vente de véhicule customisé"},
            {"type": "expense", "amount": 3000, "description": "Achat de pièces détachées"}, 
            {"type": "salary", "amount": 5000, "description": "Salaire mensuel", "employee_id": self.employee_id}
        ]
        
        all_passed = True
        for i, transaction in enumerate(transactions):
            success, response = self.run_test(
                f"Transaction {i+1} ({transaction['type']})",
                "POST",
                "transactions",
                200,
                data=transaction,
                token=self.patron_token
            )
            if not success:
                all_passed = False
        return all_passed

    def test_get_transactions(self):
        """Test retrieving transactions"""
        success, response = self.run_test(
            "Get Transactions",
            "GET", 
            "transactions",
            200,
            token=self.patron_token
        )
        if success:
            print(f"   Found {len(response)} transactions")
        return success

    def test_business_stats(self):
        """Test business statistics"""
        success, response = self.run_test(
            "Business Stats",
            "GET",
            f"stats/business/{self.business_id}",
            200,
            token=self.patron_token
        )
        if success:
            print(f"   Business Stats: {response}")
        return success

    def test_tax_brackets(self):
        """Test tax brackets management"""
        success, response = self.run_test(
            "Get Tax Brackets",
            "GET",
            "tax-brackets", 
            200,
            token=self.admin_token
        )
        return success

    def test_generate_tax_notices(self):
        """Test tax notice generation"""
        success, response = self.run_test(
            "Generate Tax Notices",
            "POST",
            "tax-notices/generate",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Generated {len(response)} tax notices")
        return success

    def test_get_tax_notices(self):
        """Test retrieving tax notices"""
        success, response = self.run_test(
            "Get Tax Notices (Admin)",
            "GET",
            "tax-notices",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} tax notices")

        # Test patron access to their tax notices
        success2, response2 = self.run_test(
            "Get Tax Notices (Patron)",
            "GET", 
            "tax-notices",
            200,
            token=self.patron_token
        )
        return success and success2

    def test_get_businesses(self):
        """Test retrieving businesses"""
        success, response = self.run_test(
            "Get Businesses",
            "GET",
            "businesses",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} businesses")
        return success

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        tokens_to_test = [
            ("Admin", self.admin_token),
            ("Patron", self.patron_token), 
            ("Employee", self.employee_token)
        ]
        
        all_passed = True
        for role, token in tokens_to_test:
            if token:
                success, response = self.run_test(
                    f"Auth Me ({role})",
                    "GET",
                    "auth/me",
                    200,
                    token=token
                )
                if success:
                    print(f"   {role} user: {response.get('name')} ({response.get('role')})")
                if not success:
                    all_passed = False
        return all_passed

def main():
    print("🚀 Starting GTA RP Tax Portal API Tests")
    print("=" * 50)
    
    tester = GTA_RP_API_Tester()
    
    # Test sequence
    test_sequence = [
        tester.test_admin_init,
        tester.test_admin_login,
        tester.test_admin_stats,
        tester.test_create_business,
        tester.test_patron_login, 
        tester.test_create_employee,
        tester.test_employee_login,
        tester.test_auth_me,
        tester.test_cash_register_transactions,
        tester.test_get_transactions,
        tester.test_business_stats,
        tester.test_get_businesses,
        tester.test_tax_brackets,
        tester.test_generate_tax_notices,
        tester.test_get_tax_notices
    ]

    # Run all tests
    for test in test_sequence:
        if not test():
            print(f"\n⚠️ Test failed, continuing with remaining tests...")

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"✅ Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate > 80 else 1

if __name__ == "__main__":
    sys.exit(main())