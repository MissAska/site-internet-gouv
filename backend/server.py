from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    JWT_SECRET = 'dev-only-secret-change-in-production'
    logger.warning("JWT_SECRET not set in environment, using development default. SET THIS IN PRODUCTION!")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

app = FastAPI(title="Eyefind - Portail Fiscal")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

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
    permissions: Optional[dict] = None
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
    owner_name: Optional[str] = None

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
class EmployeePermissions(BaseModel):
    cash_register: bool = True       # Accès caisse (revenus uniquement)
    record_expenses: bool = False    # Enregistrer des dépenses
    record_salaries: bool = False    # Enregistrer des salaires
    view_transactions: bool = False  # Voir les transactions
    view_accounting: bool = False    # Voir la comptabilité
    view_tax_notices: bool = False   # Voir les avis d'impôts
    manage_employees: bool = False   # Gérer les employés

class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    salary: float = 0.0
    permissions: Optional[EmployeePermissions] = None

class EmployeeResponse(BaseModel):
    id: str
    email: str
    name: str
    business_id: str
    salary: float
    permissions: Optional[dict] = None
    created_at: str

# Transaction Models
class TransactionCreate(BaseModel):
    type: TransactionType
    amount: float
    description: str
    employee_id: Optional[str] = None
    expense_category: Optional[str] = None  # For expenses: category
    expense_details: Optional[str] = None   # For expenses: detailed justification

class TransactionResponse(BaseModel):
    id: str
    business_id: str
    type: TransactionType
    amount: float
    description: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    expense_category: Optional[str] = None
    expense_details: Optional[str] = None
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
    status: str = "unpaid"
    created_at: str

class AccountingSnapshotResponse(BaseModel):
    id: str
    business_id: str
    business_name: str
    period_start: str
    period_end: str
    total_income: float
    total_expenses: float
    total_salaries: float
    gross_profit: float
    created_at: str

# Vehicle Models
class VehicleCreate(BaseModel):
    name: str
    category: str
    price: float

class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None

class VehicleOrderCreate(BaseModel):
    client_name: str
    client_phone: str = ""
    client_enterprise: str = ""
    vehicle_id: str
    reduction_percent: float = 0.0
    reduction_exceptional: float = 0.0
    commentary: str = ""

class VehicleOrderUpdate(BaseModel):
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_enterprise: Optional[str] = None
    reduction_percent: Optional[float] = None
    reduction_exceptional: Optional[float] = None
    plate_number: Optional[str] = None
    client_called: Optional[bool] = None
    commentary: Optional[str] = None

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

def get_current_week_start():
    """Returns the most recent Sunday at 00:00 UTC"""
    now = datetime.now(timezone.utc)
    days_since_sunday = (now.weekday() + 1) % 7
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_since_sunday)
    return week_start

async def get_accounting_period_start():
    """Returns the start of the current accounting period.
    This is the MOST RECENT of: last Sunday 00:00 UTC OR last manual/auto reset."""
    week_start = get_current_week_start()
    setting = await db.settings.find_one({"key": "last_accounting_reset"}, {"_id": 0})
    if setting and setting.get("value"):
        last_reset = datetime.fromisoformat(setting["value"])
        if last_reset > week_start:
            return last_reset
    return week_start

async def set_accounting_reset():
    """Mark the current time as the last accounting reset"""
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"key": "last_accounting_reset"},
        {"$set": {"key": "last_accounting_reset", "value": now}},
        upsert=True
    )

async def create_weekly_snapshots():
    """Create accounting snapshots for all businesses and reset the accounting period"""
    now = datetime.now(timezone.utc)
    week_start = await get_accounting_period_start()
    
    businesses = await db.businesses.find({}, {"_id": 0}).to_list(1000)
    if not businesses:
        return []
    
    biz_ids = [b["id"] for b in businesses]
    
    # Batch aggregation for period totals
    tx_totals = await db.transactions.aggregate([
        {"$match": {"business_id": {"$in": biz_ids}, "created_at": {"$gte": week_start.isoformat()}}},
        {"$group": {"_id": {"business_id": "$business_id", "type": "$type"}, "total": {"$sum": "$amount"}}}
    ]).to_list(10000)
    
    tx_map = {}
    for t in tx_totals:
        biz_id = t["_id"]["business_id"]
        tx_type = t["_id"]["type"]
        if biz_id not in tx_map:
            tx_map[biz_id] = {}
        tx_map[biz_id][tx_type] = t["total"]
    
    snapshots = []
    for b in businesses:
        totals = tx_map.get(b["id"], {})
        income = totals.get(TransactionType.INCOME, 0.0)
        expenses = totals.get(TransactionType.EXPENSE, 0.0)
        salaries = totals.get(TransactionType.SALARY, 0.0)
        
        snapshot_doc = {
            "id": str(uuid.uuid4()),
            "business_id": b["id"],
            "business_name": b["name"],
            "period_start": week_start.isoformat(),
            "period_end": now.isoformat(),
            "total_income": income,
            "total_expenses": expenses,
            "total_salaries": salaries,
            "gross_profit": income - expenses - salaries,
            "created_at": now.isoformat()
        }
        await db.accounting_snapshots.insert_one(snapshot_doc)
        snapshot_doc.pop("_id", None)
        snapshots.append(snapshot_doc)
    
    # Reset the accounting period
    await set_accounting_reset()
    
    logger.info(f"Created {len(snapshots)} accounting snapshots and reset accounting period")
    return snapshots

async def weekly_scheduler_task():
    """Background task that runs every Sunday at 23:59 UTC"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            days_until_sunday = (6 - now.weekday()) % 7
            if days_until_sunday == 0 and (now.hour > 23 or (now.hour == 23 and now.minute >= 59)):
                days_until_sunday = 7
            next_sunday = (now + timedelta(days=days_until_sunday)).replace(hour=23, minute=59, second=0, microsecond=0)
            wait_seconds = (next_sunday - now).total_seconds()
            logger.info(f"Next auto snapshot: {next_sunday.isoformat()} (in {wait_seconds/3600:.1f}h)")
            await asyncio.sleep(wait_seconds)
            
            logger.info("Running automatic weekly snapshots and tax notices...")
            
            # Capture period BEFORE snapshot (which resets)
            period_start = await get_accounting_period_start()
            period_end = datetime.now(timezone.utc)
            
            await create_weekly_snapshots()
            
            # Auto-generate tax notices using the captured period
            businesses = await db.businesses.find({}, {"_id": 0}).to_list(1000)
            brackets = await db.tax_brackets.find({}, {"_id": 0}).to_list(100)
            if not brackets:
                brackets = DEFAULT_TAX_BRACKETS
            
            for business in businesses:
                biz_id = business["id"]
                income_agg = await db.transactions.aggregate([
                    {"$match": {"business_id": biz_id, "type": TransactionType.INCOME, "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}}},
                    {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
                ]).to_list(1)
                expenses_agg = await db.transactions.aggregate([
                    {"$match": {"business_id": biz_id, "type": TransactionType.EXPENSE, "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}}},
                    {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
                ]).to_list(1)
                salaries_agg = await db.transactions.aggregate([
                    {"$match": {"business_id": biz_id, "type": TransactionType.SALARY, "created_at": {"$gte": period_start.isoformat(), "$lte": period_end.isoformat()}}},
                    {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
                ]).to_list(1)
                
                gross_revenue = income_agg[0]["total"] if income_agg else 0.0
                total_expenses = expenses_agg[0]["total"] if expenses_agg else 0.0
                total_salaries = salaries_agg[0]["total"] if salaries_agg else 0.0
                taxable_income = max(0, gross_revenue - total_expenses - total_salaries)
                tax_rate, tax_amount = calculate_tax(taxable_income, brackets)
                
                notice_doc = {
                    "id": str(uuid.uuid4()), "business_id": biz_id, "business_name": business["name"],
                    "period_start": period_start.isoformat(), "period_end": period_end.isoformat(),
                    "gross_revenue": gross_revenue, "total_expenses": total_expenses, "total_salaries": total_salaries,
                    "taxable_income": taxable_income, "tax_rate": tax_rate, "tax_amount": tax_amount,
                    "status": "unpaid", "created_at": period_end.isoformat()
                }
                await db.tax_notices.insert_one(notice_doc)
            
            logger.info("Auto weekly snapshots and tax notices completed")
            await asyncio.sleep(120)
        except Exception as e:
            logger.error(f"Weekly scheduler error: {e}")
            await asyncio.sleep(3600)

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
        permissions=user.get("permissions"),
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
        permissions=user.get("permissions"),
        created_at=user["created_at"]
    )

# =============================================================================
# ADMIN ROUTES - Create Admin
# =============================================================================

@api_router.post("/admin/init")
async def init_admin():
    """Initialize the admin account if it doesn't exist"""
    existing = await db.users.find_one({"role": UserRole.ADMIN}, {"_id": 0, "email": 1})
    if existing:
        return {"message": "Admin déjà créé", "email": existing["email"]}
    
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "email": "admin@eyefinds.gouvernement.info",
        "password": hash_password("admin123"),
        "name": "Administrateur Gouvernement",
        "role": UserRole.ADMIN,
        "business_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    return {"message": "Admin créé", "email": "admin@eyefinds.gouvernement.info", "password": "admin123"}

# =============================================================================
# USER MANAGEMENT ROUTES (Admin)
# =============================================================================

class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    salary: Optional[float] = None

class FullUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    business_id: Optional[str] = None
    business_name: Optional[str] = None
    salary: Optional[float] = None
    created_at: str

@api_router.get("/admin/users", response_model=List[FullUserResponse])
async def get_all_users(admin: dict = Depends(require_admin)):
    """Get all users in the system"""
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    # Batch load businesses to avoid N+1
    business_ids = list(set(u.get("business_id") for u in users if u.get("business_id")))
    businesses = await db.businesses.find({"id": {"$in": business_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000) if business_ids else []
    business_map = {b["id"]: b["name"] for b in businesses}
    
    return [
        FullUserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            business_id=user.get("business_id"),
            business_name=business_map.get(user.get("business_id")),
            salary=user.get("salary"),
            created_at=user["created_at"]
        )
        for user in users
    ]

@api_router.post("/admin/users", response_model=FullUserResponse)
async def create_admin_user(data: AdminUserCreate, admin: dict = Depends(require_admin)):
    """Create a new admin/government user"""
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": UserRole.ADMIN,
        "business_id": None,
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    return FullUserResponse(
        id=user_id,
        email=data.email,
        name=data.name,
        role=UserRole.ADMIN,
        business_id=None,
        business_name=None,
        salary=None,
        created_at=now
    )

@api_router.put("/admin/users/{user_id}", response_model=FullUserResponse)
async def update_user(user_id: str, data: UserUpdate, admin: dict = Depends(require_admin)):
    """Update any user (admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.email:
        # Check if email already used by another user
        existing = await db.users.find_one({"email": data.email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        update_data["email"] = data.email
    if data.password:
        update_data["password"] = hash_password(data.password)
    if data.salary is not None:
        update_data["salary"] = data.salary
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
        
        # Also update owner_name in business if this is a patron
        if data.name and user["role"] == UserRole.PATRON and user.get("business_id"):
            await db.businesses.update_one(
                {"owner_id": user_id},
                {"$set": {"owner_name": data.name}}
            )
    
    # Get updated user
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    business_name = None
    if updated.get("business_id"):
        business = await db.businesses.find_one({"id": updated["business_id"]}, {"_id": 0})
        if business:
            business_name = business["name"]
    
    return FullUserResponse(
        id=updated["id"],
        email=updated["email"],
        name=updated["name"],
        role=updated["role"],
        business_id=updated.get("business_id"),
        business_name=business_name,
        salary=updated.get("salary"),
        created_at=updated["created_at"]
    )

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    """Delete any user (admin only)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Prevent deleting yourself
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    
    # If deleting a patron, also delete their business
    if user["role"] == UserRole.PATRON and user.get("business_id"):
        business_id = user["business_id"]
        # Delete all employees of this business
        await db.users.delete_many({"business_id": business_id, "role": UserRole.EMPLOYEE})
        # Delete all transactions
        await db.transactions.delete_many({"business_id": business_id})
        # Delete all tax notices
        await db.tax_notices.delete_many({"business_id": business_id})
        # Delete the business
        await db.businesses.delete_one({"id": business_id})
    
    await db.users.delete_one({"id": user_id})
    return {"message": "Utilisateur supprimé"}

@api_router.put("/admin/change-password")
async def change_admin_password(current_password: str, new_password: str, admin: dict = Depends(require_admin)):
    """Change own password"""
    user = await db.users.find_one({"id": admin["id"]}, {"_id": 0})
    if not verify_password(current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    
    await db.users.update_one({"id": admin["id"]}, {"$set": {"password": hash_password(new_password)}})
    return {"message": "Mot de passe modifié avec succès"}

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
    
    if not businesses:
        return []
    
    # Batch: single aggregation for transaction totals
    biz_ids = [b["id"] for b in businesses]
    match_filter = {"business_id": {"$in": biz_ids}}
    
    # Non-admin: only current week totals
    if user["role"] != UserRole.ADMIN:
        match_filter["created_at"] = {"$gte": (await get_accounting_period_start()).isoformat()}
    
    totals_agg = await db.transactions.aggregate([
        {"$match": match_filter},
        {"$group": {"_id": {"business_id": "$business_id", "type": "$type"}, "total": {"$sum": "$amount"}}}
    ]).to_list(10000)
    
    totals_map = {}
    for t in totals_agg:
        biz_id = t["_id"]["business_id"]
        tx_type = t["_id"]["type"]
        if biz_id not in totals_map:
            totals_map[biz_id] = {}
        totals_map[biz_id][tx_type] = t["total"]
    
    return [
        BusinessResponse(
            id=b["id"],
            name=b["name"],
            owner_id=b["owner_id"],
            owner_name=b["owner_name"],
            created_at=b["created_at"],
            total_income=totals_map.get(b["id"], {}).get(TransactionType.INCOME, 0.0),
            total_expenses=totals_map.get(b["id"], {}).get(TransactionType.EXPENSE, 0.0),
            total_salaries=totals_map.get(b["id"], {}).get(TransactionType.SALARY, 0.0)
        )
        for b in businesses
    ]

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
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    # Delete all related data
    await db.users.delete_many({"business_id": business_id})
    await db.transactions.delete_many({"business_id": business_id})
    await db.tax_notices.delete_many({"business_id": business_id})
    await db.businesses.delete_one({"id": business_id})
    
    return {"message": "Entreprise supprimée"}

@api_router.put("/businesses/{business_id}", response_model=BusinessResponse)
async def update_business(business_id: str, data: BusinessUpdate, admin: dict = Depends(require_admin)):
    business = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    if not business:
        raise HTTPException(status_code=404, detail="Entreprise non trouvée")
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.owner_name:
        update_data["owner_name"] = data.owner_name
        # Also update the owner's name in users collection
        await db.users.update_one({"id": business["owner_id"]}, {"$set": {"name": data.owner_name}})
    
    if update_data:
        await db.businesses.update_one({"id": business_id}, {"$set": update_data})
    
    # Return updated business
    updated = await db.businesses.find_one({"id": business_id}, {"_id": 0})
    
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
        id=updated["id"],
        name=updated["name"],
        owner_id=updated["owner_id"],
        owner_name=updated["owner_name"],
        created_at=updated["created_at"],
        total_income=income[0]["total"] if income else 0.0,
        total_expenses=expenses[0]["total"] if expenses else 0.0,
        total_salaries=salaries[0]["total"] if salaries else 0.0
    )

# Route for admin to get all expenses with details
@api_router.get("/admin/expenses")
async def get_all_expenses(admin: dict = Depends(require_admin)):
    """Get all expense transactions with details for government review"""
    expenses = await db.transactions.find(
        {"type": TransactionType.EXPENSE},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Batch load businesses to avoid N+1
    business_ids = list(set(e["business_id"] for e in expenses))
    businesses = await db.businesses.find({"id": {"$in": business_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000) if business_ids else []
    business_map = {b["id"]: b["name"] for b in businesses}
    
    for expense in expenses:
        expense["business_name"] = business_map.get(expense["business_id"], "Inconnu")
    
    return expenses

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
    
    # Default permissions if not provided
    default_permissions = {
        "cash_register": True,
        "record_expenses": False,
        "record_salaries": False,
        "view_transactions": False,
        "view_accounting": False,
        "view_tax_notices": False,
        "manage_employees": False
    }
    
    permissions = data.permissions.model_dump() if data.permissions else default_permissions
    
    employee_doc = {
        "id": employee_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": UserRole.EMPLOYEE,
        "business_id": business_id,
        "salary": data.salary,
        "permissions": permissions,
        "created_at": now
    }
    await db.users.insert_one(employee_doc)
    
    return EmployeeResponse(
        id=employee_id,
        email=data.email,
        name=data.name,
        business_id=business_id,
        salary=data.salary,
        permissions=permissions,
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
        permissions=e.get("permissions"),
        created_at=e["created_at"]
    ) for e in employees]

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, user: dict = Depends(require_patron_or_admin)):
    employee = await db.users.find_one({"id": employee_id, "role": UserRole.EMPLOYEE}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    if user["role"] != UserRole.ADMIN and employee["business_id"] != user["business_id"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    await db.users.delete_one({"id": employee_id})
    return {"message": "Employé supprimé"}

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    salary: Optional[float] = None
    permissions: Optional[EmployeePermissions] = None

@api_router.put("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(employee_id: str, data: EmployeeUpdate, user: dict = Depends(require_patron_or_admin)):
    employee = await db.users.find_one({"id": employee_id, "role": UserRole.EMPLOYEE}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
    
    if user["role"] != UserRole.ADMIN and employee["business_id"] != user["business_id"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.email:
        existing = await db.users.find_one({"email": data.email, "id": {"$ne": employee_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        update_data["email"] = data.email
    if data.password:
        update_data["password"] = hash_password(data.password)
    if data.salary is not None:
        update_data["salary"] = data.salary
    if data.permissions:
        update_data["permissions"] = data.permissions.model_dump()
    
    if update_data:
        await db.users.update_one({"id": employee_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": employee_id}, {"_id": 0, "password": 0})
    
    return EmployeeResponse(
        id=updated["id"],
        email=updated["email"],
        name=updated["name"],
        business_id=updated["business_id"],
        salary=updated.get("salary", 0),
        permissions=updated.get("permissions"),
        created_at=updated["created_at"]
    )

# =============================================================================
# TRANSACTION ROUTES (CASH REGISTER)
# =============================================================================

@api_router.post("/transactions", response_model=TransactionResponse)
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    business_id = user.get("business_id")
    if not business_id:
        raise HTTPException(status_code=400, detail="Utilisateur non associé à une entreprise")
    
    # Check permissions for employees
    if user["role"] == UserRole.EMPLOYEE:
        permissions = user.get("permissions", {})
        
        # Check cash register permission for income
        if data.type == TransactionType.INCOME and not permissions.get("cash_register", True):
            raise HTTPException(status_code=403, detail="Vous n'avez pas la permission d'enregistrer des revenus")
        
        # Check expense permission
        if data.type == TransactionType.EXPENSE and not permissions.get("record_expenses", False):
            raise HTTPException(status_code=403, detail="Vous n'avez pas la permission d'enregistrer des dépenses")
        
        # Check salary permission
        if data.type == TransactionType.SALARY and not permissions.get("record_salaries", False):
            raise HTTPException(status_code=403, detail="Vous n'avez pas la permission d'enregistrer des salaires")
    
    # Require expense details for expense transactions
    if data.type == TransactionType.EXPENSE:
        if not data.expense_category:
            raise HTTPException(status_code=400, detail="La catégorie de dépense est obligatoire")
        if not data.expense_details:
            raise HTTPException(status_code=400, detail="Le détail de la dépense est obligatoire")
    
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
        "expense_category": data.expense_category if data.type == TransactionType.EXPENSE else None,
        "expense_details": data.expense_details if data.type == TransactionType.EXPENSE else None,
        "created_at": now,
        "created_by": user["id"]
    }
    await db.transactions.insert_one(transaction_doc)
    transaction_doc.pop("_id", None)
    
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
        # Non-admin users only see current week transactions
        query["created_at"] = {"$gte": (await get_accounting_period_start()).isoformat()}
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
    """Generate tax notices for all businesses and create accounting snapshots"""
    now = datetime.now(timezone.utc)
    period_end = now
    period_start = await get_accounting_period_start()
    
    # Create accounting snapshots first (this also resets the period)
    await create_weekly_snapshots()
    
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
            "status": "unpaid",
            "created_at": now.isoformat()
        }
        await db.tax_notices.insert_one(notice_doc)
        notice_doc.pop("_id", None)
        notices.append(TaxNoticeResponse(**notice_doc))
    
    return notices

@api_router.get("/tax-notices", response_model=List[TaxNoticeResponse])
async def get_tax_notices(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] != UserRole.ADMIN:
        query["business_id"] = user["business_id"]
    
    notices = await db.tax_notices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Ensure status field exists for old notices
    for n in notices:
        if "status" not in n:
            n["status"] = "unpaid"
    return [TaxNoticeResponse(**n) for n in notices]

@api_router.get("/tax-notices/business/{business_id}", response_model=List[TaxNoticeResponse])
async def get_business_tax_notices(business_id: str, user: dict = Depends(get_current_user)):
    if user["role"] != UserRole.ADMIN and user.get("business_id") != business_id:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    notices = await db.tax_notices.find({"business_id": business_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [TaxNoticeResponse(**n) for n in notices]

@api_router.delete("/tax-notices/{notice_id}")
async def delete_tax_notice(notice_id: str, admin: dict = Depends(require_admin)):
    """Delete a tax notice (admin only)"""
    notice = await db.tax_notices.find_one({"id": notice_id}, {"_id": 0})
    if not notice:
        raise HTTPException(status_code=404, detail="Avis d'impôt non trouvé")
    
    await db.tax_notices.delete_one({"id": notice_id})
    return {"message": "Avis d'impôt supprimé"}

@api_router.put("/tax-notices/{notice_id}/status")
async def update_tax_notice_status(notice_id: str, admin: dict = Depends(require_admin)):
    """Toggle tax notice paid/unpaid status (admin only)"""
    notice = await db.tax_notices.find_one({"id": notice_id}, {"_id": 0})
    if not notice:
        raise HTTPException(status_code=404, detail="Avis d'impôt non trouvé")
    
    new_status = "paid" if notice.get("status", "unpaid") == "unpaid" else "unpaid"
    await db.tax_notices.update_one({"id": notice_id}, {"$set": {"status": new_status}})
    return {"message": f"Statut mis à jour: {new_status}", "status": new_status}

# =============================================================================
# ACCOUNTING HISTORY ROUTES (Admin only)
# =============================================================================

@api_router.get("/admin/accounting-history")
async def get_accounting_history(admin: dict = Depends(require_admin)):
    """Get all accounting snapshots (admin only)"""
    snapshots = await db.accounting_snapshots.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return snapshots

@api_router.post("/admin/accounting-snapshot")
async def create_manual_snapshot(admin: dict = Depends(require_admin)):
    """Manually create an accounting snapshot (admin only)"""
    snapshots = await create_weekly_snapshots()
    return {"message": f"{len(snapshots)} snapshots créés", "snapshots": snapshots}

@api_router.get("/admin/accounting-history/{snapshot_id}/details")
async def get_snapshot_details(snapshot_id: str, admin: dict = Depends(require_admin)):
    """Get full details for a specific accounting snapshot including all transactions"""
    snapshot = await db.accounting_snapshots.find_one({"id": snapshot_id}, {"_id": 0})
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot non trouvé")
    
    # Get all transactions for this business during the snapshot period
    transactions = await db.transactions.find(
        {
            "business_id": snapshot["business_id"],
            "created_at": {"$gte": snapshot["period_start"], "$lte": snapshot["period_end"]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(5000)
    
    # Get employees involved (for salary names)
    employee_ids = list(set(t.get("employee_id") for t in transactions if t.get("employee_id")))
    employees = await db.users.find({"id": {"$in": employee_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000) if employee_ids else []
    emp_map = {e["id"]: e["name"] for e in employees}
    
    # Enrich transactions with employee names
    for t in transactions:
        if t.get("employee_id"):
            t["employee_name"] = emp_map.get(t["employee_id"], "Inconnu")
    
    return {
        "snapshot": snapshot,
        "transactions": transactions,
        "summary": {
            "income_count": sum(1 for t in transactions if t["type"] == TransactionType.INCOME),
            "expense_count": sum(1 for t in transactions if t["type"] == TransactionType.EXPENSE),
            "salary_count": sum(1 for t in transactions if t["type"] == TransactionType.SALARY),
        }
    }

@api_router.get("/tax-notices/{notice_id}/pdf")
async def export_tax_notice_pdf(notice_id: str, user: dict = Depends(get_current_user)):
    """Export a tax notice as PDF"""
    notice = await db.tax_notices.find_one({"id": notice_id}, {"_id": 0})
    if not notice:
        raise HTTPException(status_code=404, detail="Avis d'impôt non trouvé")
    
    if user["role"] != UserRole.ADMIN and user.get("business_id") != notice["business_id"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, alignment=TA_CENTER, spaceAfter=30)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER, textColor=colors.grey)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=14, spaceAfter=10)
    
    elements = []
    
    # Header
    elements.append(Paragraph("GOUVERNEMENT - PORTAIL FISCAL", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("AVIS D'IMPOSITION", title_style))
    elements.append(Spacer(1, 20))
    
    # Business info
    elements.append(Paragraph(f"Entreprise: {notice['business_name']}", header_style))
    period_start = datetime.fromisoformat(notice['period_start']).strftime('%d/%m/%Y')
    period_end = datetime.fromisoformat(notice['period_end']).strftime('%d/%m/%Y')
    elements.append(Paragraph(f"Période: {period_start} - {period_end}", styles['Normal']))
    created_at = datetime.fromisoformat(notice['created_at']).strftime('%d/%m/%Y %H:%M')
    elements.append(Paragraph(f"Date d'émission: {created_at}", styles['Normal']))
    elements.append(Spacer(1, 30))
    
    # Financial table
    def format_currency(amount):
        return f"${amount:,.0f}".replace(',', ' ')
    
    data = [
        ['Description', 'Montant'],
        ['Chiffre d\'affaires brut', format_currency(notice['gross_revenue'])],
        ['Dépenses', f"- {format_currency(notice['total_expenses'])}"],
        ['Salaires versés', f"- {format_currency(notice['total_salaries'])}"],
        ['Bénéfice brut imposable', format_currency(notice['taxable_income'])],
        ['', ''],
        ['Taux d\'imposition', f"{notice['tax_rate']*100:.0f}%"],
        ['IMPÔT À PAYER', format_currency(notice['tax_amount'])],
    ]
    
    table = Table(data, colWidths=[10*cm, 5*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f59e0b')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.black),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 14),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#334155')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(table)
    
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("Note: Minimum de $5,000 d'impôts même en cas de bénéfice négatif.", 
                              ParagraphStyle('Note', parent=styles['Normal'], fontSize=10, textColor=colors.grey)))
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"avis_impot_{notice['business_name'].replace(' ', '_')}_{period_end.replace('/', '-')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# =============================================================================
# GLOBAL ACCOUNTING ROUTES (Admin)
# =============================================================================

@api_router.get("/accounting/global")
async def get_global_accounting(admin: dict = Depends(require_admin)):
    """Get global accounting for all businesses"""
    businesses = await db.businesses.find({}, {"_id": 0}).to_list(1000)
    
    if not businesses:
        return {"businesses": [], "totals": {
            "total_businesses": 0, "total_income": 0, "total_expenses": 0,
            "total_salaries": 0, "total_gross_profit": 0, "total_taxes_paid": 0,
            "total_transactions": 0, "total_employees": 0
        }}
    
    biz_ids = [b["id"] for b in businesses]
    
    # Batch: single aggregation for all transaction totals
    tx_totals = await db.transactions.aggregate([
        {"$match": {"business_id": {"$in": biz_ids}}},
        {"$group": {"_id": {"business_id": "$business_id", "type": "$type"}, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(10000)
    
    # Batch: tax totals
    tax_totals = await db.tax_notices.aggregate([
        {"$match": {"business_id": {"$in": biz_ids}}},
        {"$group": {"_id": "$business_id", "total": {"$sum": "$tax_amount"}}}
    ]).to_list(1000)
    
    # Batch: employee counts
    emp_counts = await db.users.aggregate([
        {"$match": {"role": UserRole.EMPLOYEE, "business_id": {"$in": biz_ids}}},
        {"$group": {"_id": "$business_id", "count": {"$sum": 1}}}
    ]).to_list(1000)
    
    # Build lookup maps
    tx_map = {}
    tx_count_map = {}
    for t in tx_totals:
        biz_id = t["_id"]["business_id"]
        tx_type = t["_id"]["type"]
        if biz_id not in tx_map:
            tx_map[biz_id] = {}
            tx_count_map[biz_id] = 0
        tx_map[biz_id][tx_type] = t["total"]
        tx_count_map[biz_id] += t["count"]
    
    tax_map = {t["_id"]: t["total"] for t in tax_totals}
    emp_map = {e["_id"]: e["count"] for e in emp_counts}
    
    result = []
    for b in businesses:
        bid = b["id"]
        totals = tx_map.get(bid, {})
        total_income = totals.get(TransactionType.INCOME, 0.0)
        total_expenses = totals.get(TransactionType.EXPENSE, 0.0)
        total_salaries = totals.get(TransactionType.SALARY, 0.0)
        
        result.append({
            "id": bid,
            "name": b["name"],
            "owner_name": b["owner_name"],
            "created_at": b["created_at"],
            "total_income": total_income,
            "total_expenses": total_expenses,
            "total_salaries": total_salaries,
            "gross_profit": total_income - total_expenses - total_salaries,
            "total_taxes_paid": tax_map.get(bid, 0.0),
            "transactions_count": tx_count_map.get(bid, 0),
            "employees_count": emp_map.get(bid, 0)
        })
    
    totals = {
        "total_businesses": len(result),
        "total_income": sum(r["total_income"] for r in result),
        "total_expenses": sum(r["total_expenses"] for r in result),
        "total_salaries": sum(r["total_salaries"] for r in result),
        "total_gross_profit": sum(r["gross_profit"] for r in result),
        "total_taxes_paid": sum(r["total_taxes_paid"] for r in result),
        "total_transactions": sum(r["transactions_count"] for r in result),
        "total_employees": sum(r["employees_count"] for r in result)
    }
    
    return {"businesses": result, "totals": totals}

@api_router.get("/accounting/global/pdf")
async def export_global_accounting_pdf(admin: dict = Depends(require_admin)):
    """Export global accounting as PDF"""
    # Get data
    accounting_data = await get_global_accounting(admin)
    businesses = accounting_data["businesses"]
    totals = accounting_data["totals"]
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm, leftMargin=1*cm, rightMargin=1*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER, spaceAfter=20)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey)
    
    elements = []
    
    # Header
    elements.append(Paragraph("GOUVERNEMENT - PORTAIL FISCAL", subtitle_style))
    elements.append(Paragraph("COMPTABILITÉ GLOBALE", title_style))
    elements.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y %H:%M')}", subtitle_style))
    elements.append(Spacer(1, 20))
    
    def format_currency(amount):
        return f"${amount:,.0f}".replace(',', ' ')
    
    # Summary table
    summary_data = [
        ['Statistiques globales', ''],
        ['Nombre d\'entreprises', str(totals['total_businesses'])],
        ['Nombre d\'employés', str(totals['total_employees'])],
        ['Chiffre d\'affaires total', format_currency(totals['total_income'])],
        ['Dépenses totales', format_currency(totals['total_expenses'])],
        ['Salaires totaux', format_currency(totals['total_salaries'])],
        ['Bénéfice brut total', format_currency(totals['total_gross_profit'])],
        ['Impôts collectés', format_currency(totals['total_taxes_paid'])],
    ]
    
    summary_table = Table(summary_data, colWidths=[10*cm, 5*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0ea5e9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#334155')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 30))
    
    # Businesses detail table
    elements.append(Paragraph("Détail par entreprise", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    biz_data = [['Entreprise', 'CA', 'Dépenses', 'Salaires', 'Bénéfice', 'Impôts']]
    for b in businesses:
        biz_data.append([
            b['name'][:20],
            format_currency(b['total_income']),
            format_currency(b['total_expenses']),
            format_currency(b['total_salaries']),
            format_currency(b['gross_profit']),
            format_currency(b['total_taxes_paid'])
        ])
    
    biz_table = Table(biz_data, colWidths=[4*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
    biz_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#334155')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(biz_table)
    
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"comptabilite_globale_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    
    # Non-admin: current week only. Admin: all time
    if user["role"] != UserRole.ADMIN:
        date_filter = (await get_accounting_period_start()).isoformat()
        transactions_count = await db.transactions.count_documents({"business_id": business_id, "created_at": {"$gte": date_filter}})
    else:
        date_filter = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        transactions_count = await db.transactions.count_documents({"business_id": business_id})
    
    income_agg = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.INCOME, "created_at": {"$gte": date_filter}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    expenses_agg = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.EXPENSE, "created_at": {"$gte": date_filter}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    salaries_agg = await db.transactions.aggregate([
        {"$match": {"business_id": business_id, "type": TransactionType.SALARY, "created_at": {"$gte": date_filter}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    income = income_agg[0]["total"] if income_agg else 0
    expenses = expenses_agg[0]["total"] if expenses_agg else 0
    salaries = salaries_agg[0]["total"] if salaries_agg else 0
    
    return {
        "employees_count": employees_count,
        "transactions_count": transactions_count,
        "monthly_income": income,
        "monthly_expenses": expenses,
        "monthly_salaries": salaries,
        "monthly_profit": income - expenses - salaries
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

@app.on_event("startup")
async def startup_scheduler():
    asyncio.create_task(weekly_scheduler_task())
    logger.info("Weekly scheduler started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
