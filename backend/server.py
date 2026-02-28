from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'gta-rp-super-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

app = FastAPI(title="GTA RP - Portail Fiscal")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# =============================================================================
# ENUMS & MODELS
# =============================================================================

class UserRole(str, Enum):
    ADMIN = "admin"
    PATRON = "patron"
    EMPLOYEE = "employee"

class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"
    SALARY = "salary"

# Auth Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.EMPLOYEE

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    business_id: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Business Models
class BusinessCreate(BaseModel):
    name: str
    owner_email: EmailStr
    owner_name: str
    owner_password: str

class BusinessUpdate(BaseModel):
    name: Optional[str] = None

class BusinessResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    owner_name: str
    created_at: str
    total_income: float = 0.0
    total_expenses: float = 0.0
    total_salaries: float = 0.0

# Employee Models
class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    salary: float = 0.0

class EmployeeResponse(BaseModel):
    id: str
    email: str
    name: str
    business_id: str
    salary: float
    created_at: str

# Transaction Models
class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float
    description: str
    employee_id: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    business_id: str
    type: TransactionType
    amount: float
    description: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    created_at: str
    created_by: str

# Tax Models
class TaxBracket(BaseModel):
    min_amount: float
    max_amount: Optional[float]
    rate: float

class TaxNoticeResponse(BaseModel):
    id: str
    business_id: str
    business_name: str
    period_start: str
    period_end: str
    gross_revenue: float
    total_expenses: float
    total_salaries: float
    taxable_income: float
    tax_rate: float
    tax_amount: float
    created_at: str

# Default Tax Brackets (can be modified by admin)
DEFAULT_TAX_BRACKETS = [
    {"min_amount": 0, "max_amount": 50000, "rate": 0.10},
    {"min_amount": 50000, "max_amount": 150000, "rate": 0.20},
    {"min_amount": 150000, "max_amount": 500000, "rate": 0.30},
    {"min_amount": 500000, "max_amount": None, "rate": 0.40},
]

# =============================================================================
# AUTH HELPERS
# =============================================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user

async def require_patron_or_admin(user: dict = Depends(get_current_user)):
    if user["role"] not in [UserRole.ADMIN, UserRole.PATRON]:
        raise HTTPException(status_code=403, detail="Accès réservé aux patrons et administrateurs")
    return user

# =============================================================================
# AUTH ROUTES
# =============================================================================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    # Check if user exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "business_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, data.email, data.role)
    user_response = UserResponse(
        id=user_id,
        email=data.email,
        name=data.name,
        role=data.role,
        business_id=None,
        created_at=user_doc["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    token = create_token(user["id"], user["email"], user["role"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        business_id=user.get("business_id"),
        created_at=user["created_at"]
    )
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        business_id=user.get("business_id"),
        created_at=user["created_at"]
    )

# =============================================================================
# ADMIN ROUTES - Create Admin
# =============================================================================

@api_router.post("/admin/init")
async def init_admin():
    """Initialize the admin account if it doesn't exist"""
    existing = await db.users.find_one({"role": UserRole.ADMIN})
    if existing:
        return {"message": "Admin déjà créé", "email": existing["email"]}
    
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "email": "admin@gouvernement.rp",
        "password": hash_password("admin123"),
        "name": "Administrateur Gouvernement",
        "role": UserRole.ADMIN,
        "business_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    return {"message": "Admin créé", "email": "admin@gouvernement.rp", "password": "admin123"}

# =============================================================================
# BUSINESS ROUTES
# =============================================================================

@api_router.post("/businesses", response_model=BusinessResponse)
async def create_business(data: BusinessCreate, admin: dict = Depends(require_admin)):
    # Check if owner email exists
    existing_user = await db.users.find_one({"email": data.owner_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    business_id = str(uuid.uuid4())
    owner_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create owner user
    owner_doc = {
        "id": owner_id,
        "email": data.owner_email,
        "password": hash_password(data.owner_password),
        "name": data.owner_name,
        "role": UserRole.PATRON,
        "business_id": business_id,
        "created_at": now
    }
    await db.users.insert_one(owner_doc)
    
    # Create business
    business_doc = {
        "id": business_id,
        "name": data.name,
        "owner_id": owner_id,
        "owner_name": data.owner_name,
        "created_at": now
    }
    await db.businesses.insert_one(business_doc)
    
    return BusinessResponse(
        id=business_id,
        name=data.name,
        owner_id=owner_id,
        owner_name=data.owner_name,
        created_at=now,
        total_income=0.0,
        total_expenses=0.0,
        total_salaries=0.0
    )

@api_router.get("/businesses", response_model=List[BusinessResponse])
async def get_businesses(user: dict = Depends(get_current_user)):
    if user["role"] == UserRole.ADMIN:
        businesses = await db.businesses.find({}, {"_id": 0}).to_list(1000)
    elif user["role"] == UserRole.PATRON:
        businesses = await db.businesses.find({"id": user["business_id"]}, {"_id": 0}).to_list(1)
    else:
        businesses = await db.businesses.find({"id": user["business_id"]}, {"_id": 0}).to_list(1)
    
    result = []
    for b in businesses:
        # Calculate totals
        income = await db.transactions.aggregate([
            {"$match": {"business_id": b["id"], "type": TransactionType.INCOME}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        expenses = await db.transactions.aggregate([
            {"$match": {"business_id": b["id"], "type": TransactionType.EXPENSE}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        salaries = await db.transactions.aggregate([
            {"$match": {"business_id": b["id"], "type": TransactionType.SALARY}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        result.append(BusinessResponse(
            id=b["id"],
            name=b["name"],
            owner_id=b["owner_id"],
            owner_name=b["owner_name"],
            created_at=b["created_at"],
            total_income=income[0]["total"] if income else 0.0,
            total_expenses=expenses[0]["total"] if expenses else 0.0,
            total_salaries=salaries[0]["total"] if salaries else 0.0
        ))
    
    return result

@api_router.get("/businesses/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.ADMIN and user.get("business_id") != business_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # Calculate totals
    income = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.INCOME}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    expenses = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.EXPENSE}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    salaries = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.SALARY}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    return BusinessResponse(
        id=business["id"],
        name=business["name"],
        owner_id=business["owner_id"],
        owner_name=business["owner_name"],
        created_at=business["created_at"],
        total_income=income[0]["total"] if income else 0.0,
        total_expenses=expenses[0]["total"] if expenses else 0.0,
        total_salaries=salaries[0]["total"] if salaries else 0.0
    )

@api_router.delete("/businesses/{business_id}")
async def delete_business(business_id: str, admin: dict = Depends(require_admin)):
    business = await db.businesses.find_one({"id": business_id})
    if not business:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # Delete all related data
    await db.users.delete_many({"business_id": business_id})
    await db.transactions.delete_many({"business_id": business_id})
    await db.tax_notices.delete_many({"business_id": business_id})
    await db.businesses.delete_one({"id": business_id})
    
    return {"message": "Entreprise supprimée"}

# =============================================================================
# EMPLOYEE ROUTES
# =============================================================================

@api_router.post("/employees", response_model=EmployeeResponse)
async def create_employee(data: EmployeeCreate, user: dict = Depends(require_patron_or_admin)):
    business_id = user.get("business_id")
    if user["role"] == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="L'admin doit spécifier une entreprise")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    employee_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    employee_doc = {
        "id": employee_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": UserRole.EMPLOYEE,
        "business_id": business_id,
        "salary": data.salary,
        "created_at": now
    }
    await db.users.insert_one(employee_doc)
    
    return EmployeeResponse(
        id=employee_id,
        email=data.email,
        name=data.name,
        business_id=business_id,
        salary=data.salary,
        created_at=now
    )

@api_router.get("/employees", response_model=List[EmployeeResponse])
async def get_employees(user: dict = Depends(get_current_user)):
    if user["role"] == UserRole.ADMIN:
        employees = await db.users.find({"role": UserRole.EMPLOYEE}, {"_id": 0, "password": 0}).to_list(1000)
    else:
        employees = await db.users.find(
            {"role": UserRole.EMPLOYEE, "business_id": user["business_id"]},
            {"_id": 0, "password": 0}
        ).to_list(1000)
    
    return [EmployeeResponse(
        id=e["id"],
        email=e["email"],
        name=e["name"],
        business_id=e["business_id"],
        salary=e.get("salary", 0),
        created_at=e["created_at"]
    ) for e in employees]

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, user: dict = Depends(require_patron_or_admin)):
    employee = await db.users.find_one({"id": employee_id, "role": UserRole.EMPLOYEE})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    if user["role"] != UserRole.ADMIN and employee["business_id"] != user["business_id"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    await db.users.delete_one({"id": employee_id})
    return {"message": "Employé supprimé"}

# =============================================================================
# TRANSACTION ROUTES (CASH REGISTER)
# =============================================================================

@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="Utilisateur non associé à une entreprise")
    
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    employee_name = None
    if data.employee_id:
        employee = await db.users.find_one({"id": data.employee_id}, {"_id": 0})
        if employee:
            employee_name = employee["name"]
    
    transaction_doc = {
        "id": transaction_id,
        "business_id": business_id,
        "type": data.type,
        "amount": data.amount,
        "description": data.description,
        "employee_id": data.employee_id,
        "employee_name": employee_name,
        "created_at": now,
        "created_by": user["id"]
    }
    await db.transactions.insert_one(transaction_doc)
    
    return TransactionResponse(**transaction_doc)

@api_router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    user: dict = Depends(get_current_user),
    limit: int = 100,
    type: Optional[TransactionType] = None
):
    query = {}
    if user["role"] != UserRole.ADMIN:
        query["business_id"] = user["business_id"]
    if type:
        query["type"] = type
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [TransactionResponse(**t) for t in transactions]

@api_router.get("/transactions/business/{business_id}", response_model=List[TransactionResponse])
async def get_business_transactions(
    business_id: str,
    user: dict = Depends(get_current_user),
    limit: int = 100
):
    if user["role"] != UserRole.ADMIN and user.get("business_id") != business_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    transactions = await db.transactions.find(
        {"business_id": business_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [TransactionResponse(**t) for t in transactions]

# =============================================================================
# TAX ROUTES
# =============================================================================

@api_router.get("/tax-brackets", response_model=List[TaxBracket])
async def get_tax_brackets():
    brackets = await db.tax_brackets.find({}, {"_id": 0}).to_list(100)
    if not brackets:
        # Initialize default brackets
        for bracket in DEFAULT_TAX_BRACKETS:
            await db.tax_brackets.insert_one(bracket)
        return [TaxBracket(**b) for b in DEFAULT_TAX_BRACKETS]
    return [TaxBracket(**b) for b in brackets]

@api_router.post("/tax-brackets", response_model=List[TaxBracket])
async def update_tax_brackets(brackets: List[TaxBracket], admin: dict = Depends(require_admin)):
    await db.tax_brackets.delete_many({})
    for bracket in brackets:
        await db.tax_brackets.insert_one(bracket.model_dump())
    return brackets

MINIMUM_TAX = 5000.0  # Minimum tax amount even for negative profit

def calculate_tax(taxable_income: float, brackets: List[dict]) -> tuple:
    """Calculate tax based on brackets, returns (rate, amount). Minimum tax is 5000$"""
    if taxable_income <= 0:
        return 0.0, MINIMUM_TAX  # Minimum tax even for negative profit
    
    for bracket in sorted(brackets, key=lambda x: x["min_amount"], reverse=True):
        if taxable_income >= bracket["min_amount"]:
            calculated_tax = taxable_income * bracket["rate"]
            return bracket["rate"], max(calculated_tax, MINIMUM_TAX)
    return 0.0, MINIMUM_TAX

@api_router.post("/tax-notices/generate", response_model=List[TaxNoticeResponse])
async def generate_tax_notices(admin: dict = Depends(require_admin)):
    """Generate tax notices for all businesses"""
    now = datetime.now(timezone.utc)
    period_end = now
    period_start = now - timedelta(days=7)
    
    businesses = await db.businesses.find({}, {"_id": 0}).to_list(1000)
    brackets = await db.tax_brackets.find({}, {"_id": 0}).to_list(100)
    if not brackets:
        brackets = DEFAULT_TAX_BRACKETS
    
    notices = []
    for business in businesses:
        # Calculate totals for the period
        income_agg = await db.transactions.aggregate([
            {"$match": {
                "business_id": business["id"],
                "type": TransactionType.INCOME,
                "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        expenses_agg = await db.transactions.aggregate([
            {"$match": {
                "business_id": business["id"],
                "type": TransactionType.EXPENSE,
                "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        salaries_agg = await db.transactions.aggregate([
            {"$match": {
                "business_id": business["id"],
                "type": TransactionType.SALARY,
                "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        gross_revenue = income_agg[0]["total"] if income_agg else 0.0
        total_expenses = expenses_agg[0]["total"] if expenses_agg else 0.0
        total_salaries = salaries_agg[0]["total"] if salaries_agg else 0.0
        taxable_income = max(0, gross_revenue - total_expenses - total_salaries)
        
        tax_rate, tax_amount = calculate_tax(taxable_income, brackets)
        
        notice_id = str(uuid.uuid4())
        notice_doc = {
            "id": notice_id,
            "business_id": business["id"],
            "business_name": business["name"],
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "gross_revenue": gross_revenue,
            "total_expenses": total_expenses,
            "total_salaries": total_salaries,
            "taxable_income": taxable_income,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "created_at": now.isoformat()
        }
        await db.tax_notices.insert_one(notice_doc)
        notices.append(TaxNoticeResponse(**notice_doc))
    
    return notices

@api_router.get("/tax-notices", response_model=List[TaxNoticeResponse])
async def get_tax_notices(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] != UserRole.ADMIN:
        query["business_id"] = user["business_id"]
    
    notices = await db.tax_notices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [TaxNoticeResponse(**n) for n in notices]

@api_router.get("/tax-notices/business/{business_id}", response_model=List[TaxNoticeResponse])
async def get_business_tax_notices(business_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.ADMIN and user.get("business_id") != business_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    notices = await db.tax_notices.find({"business_id": business_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [TaxNoticeResponse(**n) for n in notices]

# =============================================================================
# STATS/DASHBOARD ROUTES
# =============================================================================

@api_router.get("/stats/admin")
async def get_admin_stats(admin: dict = Depends(require_admin)):
    total_businesses = await db.businesses.count_documents({})
    total_employees = await db.users.count_documents({"role": UserRole.EMPLOYEE})
    total_transactions = await db.transactions.count_documents({})
    
    total_income_agg = await db.transactions.aggregate([
        {"$match": {"type": TransactionType.INCOME}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    total_taxes_agg = await db.tax_notices.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$tax_amount"}}}
    ]).to_list(1)
    
    return {
        "total_businesses": total_businesses,
        "total_employees": total_employees,
        "total_transactions": total_transactions,
        "total_income": total_income_agg[0]["total"] if total_income_agg else 0,
        "total_taxes_collected": total_taxes_agg[0]["total"] if total_taxes_agg else 0
    }

@api_router.get("/stats/business/{business_id}")
async def get_business_stats(business_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.ADMIN and user.get("business_id") != business_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    employees_count = await db.users.count_documents({"business_id": business_id, "role": UserRole.EMPLOYEE})
    transactions_count = await db.transactions.count_documents({"business_id": business_id})
    
    # Last 30 days stats
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    income_agg = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.INCOME, "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    expenses_agg = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.EXPENSE, "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    salaries_agg = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.SALARY, "created_at": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    return {
        "employees_count": employees_count,
        "transactions_count": transactions_count,
        "monthly_income": income_agg[0]["total"] if income_agg else 0,
        "monthly_expenses": expenses_agg[0]["total"] if expenses_agg else 0,
        "monthly_salaries": salaries_agg[0]["total"] if salaries_agg else 0,
        "monthly_profit": (income_agg[0]["total"] if income_agg else 0) - (expenses_agg[0]["total"] if expenses_agg else 0) - (salaries_agg[0]["total"] if salaries_agg else 0)
    }

# =============================================================================
# APP CONFIG
# =============================================================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
