import os
import shutil
import time
import uuid
import threading
import urllib.request
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

# Security dependencies
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import boto3
from botocore.exceptions import NoCredentialsError

from backend import models, schemas, crud
from backend.database import engine, get_db
from backend.auth import get_tenant_context, create_access_token, verify_password, get_password_hash, require_super_admin

# Create the tables
models.Base.metadata.create_all(bind=engine)

# ponytail: SQLite has no Alembic â€” add missing columns on boot. Switch to migrations if schema churn grows.
def ensure_sqlite_columns():
    if not str(engine.url).startswith("sqlite"):
        return
    needed = {
        "cars": [
            ("chassis_number", "VARCHAR"),
            ("registration_doc_url", "VARCHAR"),
            ("fitness_cert_url", "VARCHAR"),
            ("token_tax_doc_url", "VARCHAR"),
            ("fitness_expiry_date", "DATE"),
            ("token_tax_expiry_date", "DATE"),
            ("registration_expiry_date", "DATE"),
            ("investor_id", "INTEGER"),
            ("investor_profit_share", "FLOAT"),
            ("shareholder_id", "INTEGER"),
            ("shareholder_profit_share", "FLOAT"),
        ],
        "customers": [
            ("license_expiry_date", "DATE"),
            ("cheque_number", "VARCHAR"),
            ("passport_number", "VARCHAR"),
            ("guarantor_name", "VARCHAR"),
            ("guarantor_phone", "VARCHAR"),
            ("guarantor_cnic", "VARCHAR"),
            ("guarantor_address", "VARCHAR"),
            ("guarantee_details", "VARCHAR"),
        ],
        "bookings": [
            ("booking_type", "VARCHAR"),
            ("company_name", "VARCHAR"),
        ],
        "investors": [
            ("payout_type", "VARCHAR DEFAULT 'percentage'"),
            ("fixed_amount", "FLOAT DEFAULT 0.0"),
        ],
        "shareholders": [
            ("payout_type", "VARCHAR DEFAULT 'percentage'"),
            ("fixed_amount", "FLOAT DEFAULT 0.0"),
        ],
        "tenants": [
            ("plan_type", "VARCHAR DEFAULT 'standard'"),
            ("subscription_status", "VARCHAR DEFAULT 'active'"),
            ("trial_ends_at", "DATE"),
            ("created_at", "DATETIME"),
        ],
        "quotations": [
            ("items", "JSON"),
        ],
    }
    with engine.begin() as conn:
        for table, columns in needed.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()}
            for col, typ in columns:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
        
        # Create booked_cars table if it does not exist
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS booked_cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id VARCHAR NOT NULL,
                booking_id INTEGER NOT NULL,
                car_id INTEGER NOT NULL,
                daily_rate FLOAT NOT NULL,
                start_odometer INTEGER DEFAULT 0,
                return_odometer INTEGER DEFAULT 0,
                fuel_level_on_start VARCHAR DEFAULT 'Full',
                fuel_level_on_return VARCHAR DEFAULT 'Full',
                extra_fuel_charge FLOAT DEFAULT 0.0,
                structural_damage_charge FLOAT DEFAULT 0.0,
                FOREIGN KEY (booking_id) REFERENCES bookings (id),
                FOREIGN KEY (car_id) REFERENCES cars (id)
            )
        """))

ensure_sqlite_columns()

# Initialize Rate Limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Rent A Car Management System")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Strict CORS Setup ---
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress JSON/HTML/JS responses for ultra-fast delivery over internet
app.add_middleware(GZipMiddleware, minimum_size=500)

# S3 Configuration
S3_BUCKET = os.environ.get("AWS_STORAGE_BUCKET_NAME")
S3_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID")
S3_SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
S3_ENDPOINT = os.environ.get("AWS_S3_ENDPOINT_URL")

s3_client = None
if S3_BUCKET and S3_ACCESS_KEY and S3_SECRET_KEY:
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        endpoint_url=S3_ENDPOINT
    )

# Local document folders fallback
os.makedirs("app_data/documents", exist_ok=True)
os.makedirs("app_data/backups", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="app_data/documents"), name="uploads")


# --- Automated Backup System ---
def run_db_backup():
    """Copy the database file with a timestamp into the backups folder (if SQLite)."""
    db_source = "app_data/car_rental.db"
    if not os.path.exists(db_source):
        return
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dest = f"app_data/backups/car_rental_backup_{timestamp}.db"
    try:
        shutil.copy2(db_source, backup_dest)
        print(f"[Backup] Successfully created database backup: {backup_dest}")
    except Exception as e:
        print(f"[Backup] Failed to backup database: {str(e)}")

def backup_scheduler():
    """Background thread that runs a backup every 12 hours."""
    while True:
        time.sleep(43200)
        run_db_backup()

def keep_alive_scheduler():
    """
    Periodic self-pinger to prevent cloud free-tier hosting (Render, etc.) from sleeping.
    Render automatically sets RENDER_EXTERNAL_URL (or KEEP_ALIVE_URL can be set manually).
    """
    ping_url = os.environ.get("KEEP_ALIVE_URL") or os.environ.get("RENDER_EXTERNAL_URL")
    if not ping_url:
        return
    if not ping_url.endswith("/api/health"):
        ping_url = ping_url.rstrip("/") + "/api/health"
    print(f"[KeepAlive] Active. Pinging {ping_url} every 10 minutes to prevent cold starts.")
    while True:
        time.sleep(600)  # Ping every 10 minutes (Render sleeps after 15m)
        try:
            req = urllib.request.Request(ping_url, headers={"User-Agent": "Antigravity-KeepAlive/1.0"})
            with urllib.request.urlopen(req, timeout=15) as response:
                print(f"[KeepAlive] Ping successful ({response.status})")
        except Exception as e:
            print(f"[KeepAlive] Ping failed: {e}")

@app.get("/api/health")
def health_check():
    """Public health check endpoint for uptime pingers (UptimeRobot, Cron-job, Render)."""
    return {"status": "online", "timestamp": datetime.utcnow().isoformat()}

@app.on_event("startup")
def startup_event():
    run_db_backup()
    t = threading.Thread(target=backup_scheduler, daemon=True)
    t.start()
    keep_alive_t = threading.Thread(target=keep_alive_scheduler, daemon=True)
    keep_alive_t.start()

@app.on_event("shutdown")
def shutdown_event():
    run_db_backup()


# --- KYC Document Upload Validation & Sanitization ---
def upload_file_securely(file: UploadFile) -> str:
    """
    Validates MIME type, limits size to 5MB,
    renames filename to a random UUID, and uploads to S3 or local directory.
    """
    # Validate MIME type
    allowed_types = ["image/png", "image/jpeg", "image/webp", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type {file.content_type}. Only JPEG, PNG, WEBP, and PDF are allowed."
        )

    # Validate size (max 5MB)
    max_size = 5 * 1024 * 1024
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > max_size:
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")

    # Sanitize and rename
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{uuid.uuid4()}{ext}"

    if s3_client:
        try:
            s3_client.upload_fileobj(
                file.file,
                S3_BUCKET,
                safe_filename,
                ExtraArgs={"ContentType": file.content_type}
            )
            # URL generator for S3 file
            if S3_ENDPOINT:
                return f"{S3_ENDPOINT}/{S3_BUCKET}/{safe_filename}"
            return f"https://{S3_BUCKET}.s3.amazonaws.com/{safe_filename}"
        except NoCredentialsError:
            pass  # Fall back to local if S3 fails
        except Exception as e:
            print(f"[S3 Upload Error] {str(e)}")

    # Fallback to local uploads
    filepath = os.path.join("app_data", "documents", safe_filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return f"/uploads/{safe_filename}"


# --- Auth login endpoint ---
@app.post("/api/auth/token")
@limiter.limit("5/minute")
def login(request: Request, username: str = Form(...), password: str = Form(...), tenant_id: str = Form(...)):
    # Simple mockup tenant/user validation for upgrade demo
    # In production, check credentials against TenantUser database table
    if password == "OmnysyncPassword123":
        access_token = create_access_token(data={"sub": username, "role": "tenant_admin", "tenant_id": tenant_id})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Incorrect credentials")


# --- Alerts Dashboard Endpoint ---
@app.get("/api/alerts")
def get_dashboard_alerts(db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    tenant_id = tenant_context["tenant_id"]
    alerts = []
    
    # 1. Oil Alerts
    cars = db.query(models.Car).filter(models.Car.tenant_id == tenant_id).all()
    for car in cars:
        diff = car.current_odometer - car.last_oil_change_odometer
        if diff >= 5000:
            alerts.append({
                "type": "oil",
                "severity": "red",
                "title": f"Critical Oil Change Alert: {car.make_model} ({car.plate_number})",
                "message": f"Odometer difference is {diff}km (Last oil change: {car.last_oil_change_odometer}km, Current: {car.current_odometer}km). Limit is 5000km.",
                "car_id": car.id
            })
        elif diff >= 4500:
            alerts.append({
                "type": "oil",
                "severity": "yellow",
                "title": f"Oil Change Warning: {car.make_model} ({car.plate_number})",
                "message": f"Odometer difference is {diff}km (Last oil change: {car.last_oil_change_odometer}km, Current: {car.current_odometer}km). Approaching 5000km limit.",
                "car_id": car.id
            })

    # 2. Token Tax & Vehicle Fitness Alerts
    logs = db.query(models.MaintenanceLog).filter(
        models.MaintenanceLog.tenant_id == tenant_id,
        models.MaintenanceLog.log_type.in_(["Token Tax", "Vehicle Fitness"])
    ).all()
    
    today = date.today()
    for log in logs:
        if log.next_due_date_or_odometer:
            try:
                due_date = datetime.strptime(log.next_due_date_or_odometer, "%Y-%m-%d").date()
                days_left = (due_date - today).days
                if 0 <= days_left <= 30:
                    alerts.append({
                        "type": "tax_fitness",
                        "severity": "yellow",
                        "title": f"Upcoming {log.log_type} Expiry for {log.car.make_model if log.car else 'Vehicle'}",
                        "message": f"{log.log_type} expires in {days_left} days (Due Date: {log.next_due_date_or_odometer}).",
                        "car_id": log.car_id
                    })
                elif days_left < 0:
                    alerts.append({
                        "type": "tax_fitness",
                        "severity": "red",
                        "title": f"EXPIRED {log.log_type} for {log.car.make_model if log.car else 'Vehicle'}",
                        "message": f"{log.log_type} expired {abs(days_left)} days ago (Due Date: {log.next_due_date_or_odometer}).",
                        "car_id": log.car_id
                    })
            except ValueError:
                pass

    # 3. Overdue / late-return Active bookings
    now = datetime.now()
    overdue = db.query(models.Booking).options(
        joinedload(models.Booking.car),
        joinedload(models.Booking.customer)
    ).filter(
        models.Booking.tenant_id == tenant_id,
        models.Booking.status == "Active",
        models.Booking.expected_end_datetime < now
    ).all()
    for b in overdue:
        hours_late = max(1, int((now - b.expected_end_datetime).total_seconds() // 3600))
        alerts.append({
            "type": "overdue",
            "severity": "red",
            "title": f"Late Return: {b.customer.full_name if b.customer else 'Customer'} â€” Booking #{b.id}",
            "message": f"Expected return was {b.expected_end_datetime.strftime('%Y-%m-%d %H:%M')}. Overdue by ~{hours_late}h. Vehicle: {b.car.make_model if b.car else 'N/A'} ({b.car.plate_number if b.car else ''}).",
            "booking_id": b.id,
            "car_id": b.car_id
        })

    # 4. Document expiry on cars (fitness / token tax / registration)
    def _expiry_alert(label, due, entity_name, car_id=None, customer_id=None):
        if not due:
            return
        days_left = (due - today).days
        if days_left < 0:
            alerts.append({
                "type": "doc_expiry",
                "severity": "red",
                "title": f"EXPIRED {label}: {entity_name}",
                "message": f"{label} expired {abs(days_left)} days ago (Due: {due.isoformat()}).",
                "car_id": car_id,
                "customer_id": customer_id
            })
        elif days_left <= 7:
            alerts.append({
                "type": "doc_expiry",
                "severity": "red",
                "title": f"{label} expires in {days_left} days: {entity_name}",
                "message": f"{label} due on {due.isoformat()}. Renew immediately.",
                "car_id": car_id,
                "customer_id": customer_id
            })
        elif days_left <= 30:
            alerts.append({
                "type": "doc_expiry",
                "severity": "yellow",
                "title": f"{label} due in {days_left} days: {entity_name}",
                "message": f"{label} expires on {due.isoformat()}.",
                "car_id": car_id,
                "customer_id": customer_id
            })

    for car in cars:
        name = f"{car.make_model} ({car.plate_number})"
        _expiry_alert("Fitness Certificate", car.fitness_expiry_date, name, car_id=car.id)
        _expiry_alert("Token Tax", car.token_tax_expiry_date, name, car_id=car.id)
        _expiry_alert("Registration", car.registration_expiry_date, name, car_id=car.id)

    customers = db.query(models.Customer).filter(models.Customer.tenant_id == tenant_id).all()
    for cust in customers:
        _expiry_alert("Driving License", cust.license_expiry_date, cust.full_name, customer_id=cust.id)
                
    return alerts


# --- Cars Endpoints ---
@app.get("/api/cars", response_model=List[schemas.Car])
def read_cars(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_cars(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.get("/api/cars/{car_id}", response_model=schemas.Car)
def read_car(car_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    db_car = crud.get_car(db, car_id=car_id, tenant_id=tenant_context["tenant_id"])
    if db_car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    return db_car

@app.post("/api/cars", response_model=schemas.Car)
def create_car(car: schemas.CarCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    tenant_id = tenant_context["tenant_id"]
    db_car = crud.get_car_by_plate(db, plate_number=car.plate_number, tenant_id=tenant_id)
    if db_car:
        raise HTTPException(status_code=400, detail="Plate number already registered")
    return crud.create_car(db=db, car=car, tenant_id=tenant_id)

@app.put("/api/cars/{car_id}", response_model=schemas.Car)
def update_car(car_id: int, car_update: schemas.CarUpdate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    db_car = crud.update_car(db, car_id, car_update, tenant_id=tenant_context["tenant_id"])
    if not db_car:
        raise HTTPException(status_code=404, detail="Car not found")
    return db_car

@app.delete("/api/cars/{car_id}")
def delete_car(car_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    db_car = crud.delete_car(db, car_id, tenant_id=tenant_context["tenant_id"])
    if not db_car:
        raise HTTPException(status_code=404, detail="Car not found")
    return {"status": "success", "message": f"Car {car_id} deleted successfully"}

@app.get("/api/cars/{car_id}/history")
def get_car_history(
    car_id: int, 
    db: Session = Depends(get_db), 
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    role = tenant_context["role"]
    
    # 1. Anti-IDOR Check: Check if car exists and belongs to this tenant
    car = db.query(models.Car).options(
        joinedload(models.Car.investor),
        joinedload(models.Car.shareholder)
    ).filter(models.Car.id == car_id, models.Car.tenant_id == tenant_id).first()
    if not car:
        # Return 404 to prevent IDOR scanning / enum attacks
        raise HTTPException(status_code=404, detail="Car not found")
        
    # 2. Prevent N+1 query: joinedload customer for bookings
    bookings = (
        db.query(models.Booking)
        .join(models.Booking.booked_cars, isouter=True)
        .options(joinedload(models.Booking.customer), joinedload(models.Booking.booked_cars))
        .filter(
            models.Booking.tenant_id == tenant_id,
            (models.Booking.car_id == car_id) | (models.BookedCar.car_id == car_id)
        )
        .order_by(models.Booking.start_datetime.desc())
        .all()
    )
    
    maintenance = (
        db.query(models.MaintenanceLog)
        .filter(models.MaintenanceLog.car_id == car_id, models.MaintenanceLog.tenant_id == tenant_id)
        .order_by(models.MaintenanceLog.execution_date.desc())
        .all()
    )
    
    # 3. Proportional Aggregations
    total_earnings = 0.0
    transactions = []
    
    booking_ids = [b.id for b in bookings]
    if booking_ids:
        all_financials = (
            db.query(models.Financial)
            .filter(models.Financial.booking_id.in_(booking_ids), models.Financial.tenant_id == tenant_id)
            .order_by(models.Financial.payment_datetime.desc())
            .all()
        )
        
        financials_by_booking = {}
        for f in all_financials:
            financials_by_booking.setdefault(f.booking_id, []).append(f)
            
        for b in bookings:
            proportion = 1.0
            if b.booked_cars:
                total_rate = sum(bc.daily_rate for bc in b.booked_cars) or 1.0
                car_bc = next((bc for bc in b.booked_cars if bc.car_id == car_id), None)
                if car_bc:
                    proportion = car_bc.daily_rate / total_rate
            
            b_financials = financials_by_booking.get(b.id, [])
            for f in b_financials:
                allocated_amount = f.amount_paid * proportion
                total_earnings += allocated_amount
                transactions.append(models.Financial(
                    id=f.id,
                    booking_id=f.booking_id,
                    amount_paid=allocated_amount,
                    payment_datetime=f.payment_datetime,
                    payment_method=f.payment_method,
                    balance_due=f.balance_due * proportion,
                    tenant_id=f.tenant_id
                ))

    total_maint = (
        db.query(func.sum(models.MaintenanceLog.cost))
        .filter(models.MaintenanceLog.car_id == car_id, models.MaintenanceLog.tenant_id == tenant_id)
        .scalar()
    ) or 0.0

    net_profit = total_earnings - total_maint

    owner_type = "Company"
    owner_name = None
    partner_share = None
    partner_earnings = 0.0
    platform_fee = 0.0

    if car.investor_id:
        owner_type = "Investor"
        owner_name = car.investor.full_name if car.investor else "Unknown"
        partner_share = car.investor_profit_share if car.investor_profit_share is not None else (car.investor.profit_share_percentage if car.investor else 70.0)
        partner_earnings = max(0.0, net_profit) * (partner_share / 100.0)
    elif car.shareholder_id:
        owner_type = "Shareholder"
        owner_name = car.shareholder.full_name if car.shareholder else "Unknown"
        partner_share = car.shareholder_profit_share if car.shareholder_profit_share is not None else (car.shareholder.share_percentage if car.shareholder else 50.0)
        platform_fee = total_earnings * 0.15
        partner_earnings = max(0.0, total_earnings * 0.85) * (partner_share / 100.0)
    
    # 4. Data Masking for desk_staff
    if False:  # Disabled to show history and info to everyone
        total_earnings = None
        total_maint = None
        net_profit = None
        # Mask individual maintenance costs
        maint_list = []
        for log in maintenance:
            maint_list.append({
                "id": log.id,
                "log_type": log.log_type,
                "cost": None,
                "execution_date": log.execution_date,
                "next_due_date_or_odometer": log.next_due_date_or_odometer,
                "notes": log.notes
            })
        
        # Mask individual financial transaction amounts
        financial_list = [
            {
                "id": f.id,
                "amount_paid": None,
                "payment_datetime": f.payment_datetime,
                "payment_method": f.payment_method,
                "balance_due": None,
                "booking_id": f.booking_id
            }
            for f in transactions
        ]
    else:
        maint_list = [
            {
                "id": log.id,
                "log_type": log.log_type,
                "cost": log.cost,
                "execution_date": log.execution_date,
                "next_due_date_or_odometer": log.next_due_date_or_odometer,
                "notes": log.notes
            }
            for log in maintenance
        ]
        
        financial_list = [
            {
                "id": f.id,
                "amount_paid": f.amount_paid,
                "payment_datetime": f.payment_datetime,
                "payment_method": f.payment_method,
                "balance_due": f.balance_due,
                "booking_id": f.booking_id
            }
            for f in transactions
        ]
        
    bookings_list = [
        {
            "id": b.id,
            "start_datetime": b.start_datetime,
            "expected_end_datetime": b.expected_end_datetime,
            "actual_return_datetime": b.actual_return_datetime,
            "status": b.status,
            "customer": {
                "full_name": b.customer.full_name if b.customer else "Unknown",
                "cnic_number": b.customer.cnic_number if b.customer else "Unknown",
                "phone_primary": b.customer.phone_primary if b.customer else "Unknown"
            }
        }
        for b in bookings
    ]
    
    return {
        "car": {
            "id": car.id,
            "make_model": car.make_model,
            "plate_number": car.plate_number,
            "status": car.status,
            "owner_type": owner_type,
            "owner_name": owner_name,
            "partner_share": partner_share,
            "partner_earnings": partner_earnings,
            "platform_fee": platform_fee
        },
        "total_earnings": total_earnings,
        "total_maintenance_cost": total_maint,
        "net_profit": net_profit,
        "bookings": bookings_list,
        "maintenance_logs": maint_list,
        "financials": financial_list
    }


@app.post("/api/cars/upload")
def upload_car_image(file: UploadFile = File(...), tenant_context: dict = Depends(get_tenant_context)):
    safe_url = upload_file_securely(file)
    return {"image_url": safe_url}


# --- Customers Endpoints ---
@app.get("/api/customers", response_model=List[schemas.Customer])
def read_customers(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_customers(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.get("/api/customers/lookup/{cnic}", response_model=schemas.Customer)
def read_customer_by_cnic(cnic: str, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    db_customer = crud.get_customer_by_cnic(db, cnic_number=cnic, tenant_id=tenant_context["tenant_id"])
    if db_customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return db_customer

@app.post("/api/customers", response_model=schemas.Customer)
def create_customer(
    full_name: str = Form(...),
    phone_primary: str = Form(...),
    phone_secondary: Optional[str] = Form(None),
    home_address: str = Form(...),
    cnic_number: str = Form(...),
    license_number: str = Form(...),
    license_expiry_date: Optional[str] = Form(None),
    cheque_number: Optional[str] = Form(None),
    passport_number: Optional[str] = Form(None),
    guarantor_name: Optional[str] = Form(None),
    guarantor_phone: Optional[str] = Form(None),
    guarantor_cnic: Optional[str] = Form(None),
    guarantor_address: Optional[str] = Form(None),
    guarantee_details: Optional[str] = Form(None),
    cnic_front: Optional[UploadFile] = File(None),
    cnic_back: Optional[UploadFile] = File(None),
    license_front: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    # Check if customer already exists
    existing = crud.get_customer_by_cnic(db, cnic_number=cnic_number, tenant_id=tenant_id)
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this CNIC already exists")

    # Save uploaded files securely
    cnic_front_path = upload_file_securely(cnic_front) if cnic_front else None
    cnic_back_path = upload_file_securely(cnic_back) if cnic_back else None
    license_front_path = upload_file_securely(license_front) if license_front else None

    parsed_license_expiry = None
    if license_expiry_date:
        try:
            parsed_license_expiry = datetime.strptime(license_expiry_date[:10], "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid license_expiry_date (use YYYY-MM-DD)")

    customer_schema = schemas.CustomerCreate(
        full_name=full_name,
        phone_primary=phone_primary,
        phone_secondary=phone_secondary or None,
        home_address=home_address,
        cnic_number=cnic_number,
        license_number=license_number,
        cnic_front_path=cnic_front_path,
        cnic_back_path=cnic_back_path,
        license_front_path=license_front_path,
        license_expiry_date=parsed_license_expiry,
        cheque_number=cheque_number or None,
        passport_number=passport_number or None,
        guarantor_name=guarantor_name or None,
        guarantor_phone=guarantor_phone or None,
        guarantor_cnic=guarantor_cnic or None,
        guarantor_address=guarantor_address or None,
        guarantee_details=guarantee_details or None,
    )
    return crud.create_customer(db=db, customer=customer_schema, tenant_id=tenant_id)

@app.put("/api/customers/{customer_id}", response_model=schemas.Customer)
def update_customer(
    customer_id: int,
    full_name: str = Form(...),
    phone_primary: str = Form(...),
    phone_secondary: Optional[str] = Form(None),
    home_address: str = Form(...),
    cnic_number: str = Form(...),
    license_number: str = Form(...),
    license_expiry_date: Optional[str] = Form(None),
    cheque_number: Optional[str] = Form(None),
    passport_number: Optional[str] = Form(None),
    guarantor_name: Optional[str] = Form(None),
    guarantor_phone: Optional[str] = Form(None),
    guarantor_cnic: Optional[str] = Form(None),
    guarantor_address: Optional[str] = Form(None),
    guarantee_details: Optional[str] = Form(None),
    cnic_front: Optional[UploadFile] = File(None),
    cnic_back: Optional[UploadFile] = File(None),
    license_front: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    existing = crud.get_customer(db, customer_id, tenant_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Block CNIC collision with a different customer
    other = crud.get_customer_by_cnic(db, cnic_number=cnic_number, tenant_id=tenant_id)
    if other and other.id != customer_id:
        raise HTTPException(status_code=400, detail="Another customer already uses this CNIC")

    update_data = {
        "full_name": full_name,
        "phone_primary": phone_primary,
        "phone_secondary": phone_secondary or None,
        "home_address": home_address,
        "cnic_number": cnic_number,
        "license_number": license_number,
        "cheque_number": cheque_number or None,
        "passport_number": passport_number or None,
        "guarantor_name": guarantor_name or None,
        "guarantor_phone": guarantor_phone or None,
        "guarantor_cnic": guarantor_cnic or None,
        "guarantor_address": guarantor_address or None,
        "guarantee_details": guarantee_details or None,
    }
    if license_expiry_date:
        try:
            update_data["license_expiry_date"] = datetime.strptime(license_expiry_date[:10], "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid license_expiry_date (use YYYY-MM-DD)")
    else:
        update_data["license_expiry_date"] = None

    if cnic_front:
        update_data["cnic_front_path"] = upload_file_securely(cnic_front)
    if cnic_back:
        update_data["cnic_back_path"] = upload_file_securely(cnic_back)
    if license_front:
        update_data["license_front_path"] = upload_file_securely(license_front)

    updated = crud.update_customer(db, customer_id, schemas.CustomerUpdate(**update_data), tenant_id)
    return updated

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    db_cust = crud.delete_customer(db, customer_id, tenant_id=tenant_context["tenant_id"])
    if not db_cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"status": "success", "message": f"Customer {customer_id} deleted successfully"}


# --- Bookings Endpoints ---
@app.get("/api/bookings", response_model=List[schemas.Booking])
def read_bookings(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_bookings(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.get("/api/bookings/{booking_id}/financials", response_model=List[schemas.Financial])
def read_booking_financials(booking_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    tenant_id = tenant_context["tenant_id"]
    booking = crud.get_booking(db, booking_id, tenant_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return crud.get_financials_by_booking(db, booking_id, tenant_id)

@app.post("/api/bookings", response_model=schemas.Booking)
def create_booking(booking: schemas.BookingCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_booking(db=db, booking=booking, tenant_id=tenant_context["tenant_id"])

@app.put("/api/bookings/{booking_id}", response_model=schemas.Booking)
def update_booking(booking_id: int, booking_update: schemas.BookingUpdate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    updated = crud.update_booking(db=db, booking_id=booking_id, booking_update=booking_update, tenant_id=tenant_context["tenant_id"])
    if updated is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    return updated


# --- Financials Endpoints ---
@app.get("/api/financials", response_model=List[schemas.Financial])
def read_financials(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_financials(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/financials", response_model=schemas.Financial)
def create_financial(financial: schemas.FinancialCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    tenant_id = tenant_context["tenant_id"]
    booking = crud.get_booking(db, financial.booking_id, tenant_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return crud.create_financial(db=db, financial=financial, tenant_id=tenant_id)


# --- Maintenance Logs Endpoints ---
@app.get("/api/maintenance", response_model=List[schemas.MaintenanceLog])
def read_maintenance(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_maintenance_logs(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/maintenance", response_model=schemas.MaintenanceLog)
def create_maintenance(log: schemas.MaintenanceLogCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_maintenance_log(db=db, log=log, tenant_id=tenant_context["tenant_id"])


# --- Blacklist Endpoints ---
@app.get("/api/blacklist", response_model=List[schemas.Blacklist])
def read_blacklist(skip: int = 0, limit: int = 10000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_blacklist(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.get("/api/blacklist/lookup/{cnic}", response_model=schemas.Blacklist)
def read_blacklist_by_cnic(cnic: str, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    db_bl = crud.get_blacklist_by_cnic(db, cnic_number=cnic, tenant_id=tenant_context["tenant_id"])
    if db_bl is None:
        raise HTTPException(status_code=404, detail="CNIC not blacklisted")
    return db_bl

@app.post("/api/blacklist", response_model=schemas.Blacklist)
def add_to_blacklist(blacklist: schemas.BlacklistCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    tenant_id = tenant_context["tenant_id"]
    existing = crud.get_blacklist_by_cnic(db, cnic_number=blacklist.cnic_number, tenant_id=tenant_id)
    if existing:
         raise HTTPException(status_code=400, detail="CNIC already blacklisted")
    return crud.add_to_blacklist(db=db, blacklist=blacklist, tenant_id=tenant_id)

@app.delete("/api/blacklist/{cnic}")
def remove_from_blacklist(cnic: str, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    crud.remove_from_blacklist(db, cnic_number=cnic, tenant_id=tenant_context["tenant_id"])
    return {"status": "success", "message": f"CNIC {cnic} removed from blacklist"}


@app.on_event("startup")
def startup_event():
    # Provision default tenant if missing
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        default_tenant = crud.get_tenant(db, "default")
        if not default_tenant:
            crud.create_tenant(db, schemas.TenantCreate(
                id="default",
                name="Rent A Car Management System",
                logo_url=None,
                primary_theme_color="#0d9488",
                contact_name="Muhammad Ali",
                operational_manager="Operational Manager",
                is_active=True,
                feature_flags=["dashboard", "fleet", "customers", "bookings", "maintenance", "blacklist", "whatsapp_api", "advanced_analytics", "chauffeur_module"],
                branding_settings={
                    "support_email": "support@rentacarmanagement.com",
                    "support_phone": "0300-1234567",
                    "footer_status_text": "Offline Backup System",
                    "bg_gradient_start": "#0d9488"
                }
            ))
    except Exception as e:
        print(f"Error seeding default tenant: {e}")
    finally:
        db.close()


# --- SaaS Admin Operator Endpoints ---
@app.post("/api/saas-admin/tenants", response_model=schemas.Tenant)
def provision_tenant(
    tenant: schemas.TenantCreate, 
    db: Session = Depends(get_db), 
    admin_context: dict = Depends(require_super_admin)
):
    db_tenant = crud.get_tenant(db, tenant.id)
    if db_tenant:
        raise HTTPException(status_code=400, detail="Subdomain/Tenant already exists")
    return crud.create_tenant(db, tenant)

@app.get("/api/saas-admin/tenants", response_model=List[schemas.Tenant])
def list_tenants(
    db: Session = Depends(get_db), 
    admin_context: dict = Depends(require_super_admin)
):
    return crud.get_tenants(db)

@app.patch("/api/saas-admin/tenants/{tenant_id}/features", response_model=schemas.Tenant)
def toggle_tenant_features(
    tenant_id: str, 
    payload: schemas.TenantUpdate, 
    db: Session = Depends(get_db), 
    admin_context: dict = Depends(require_super_admin)
):
    db_tenant = crud.get_tenant(db, tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return crud.update_tenant(db, tenant_id, payload)

@app.delete("/api/saas-admin/tenants/{tenant_id}")
def remove_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    admin_context: dict = Depends(require_super_admin)
):
    if tenant_id == "default":
        raise HTTPException(status_code=400, detail="Cannot delete default tenant")
    db_tenant = crud.get_tenant(db, tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    db.delete(db_tenant)
    db.commit()
    return {"message": f"Tenant '{tenant_id}' deleted successfully"}

@app.post("/api/saas-admin/tenants/{tenant_id}/extend-trial", response_model=schemas.Tenant)
def extend_tenant_trial(
    tenant_id: str,
    days: int = 7,
    db: Session = Depends(get_db),
    admin_context: dict = Depends(require_super_admin)
):
    db_tenant = crud.get_tenant(db, tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    base_date = db_tenant.trial_ends_at if (db_tenant.trial_ends_at and db_tenant.trial_ends_at >= date.today()) else date.today()
    db_tenant.plan_type = f"trial_{days}d"
    db_tenant.subscription_status = "trialing"
    db_tenant.trial_ends_at = base_date + timedelta(days=days)
    db_tenant.is_active = True
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@app.get("/api/saas-admin/stats")
def get_saas_stats(
    db: Session = Depends(get_db),
    admin_context: dict = Depends(require_super_admin)
):
    tenants = crud.get_tenants(db)
    total_cars = db.query(models.Car).count()
    total_bookings = db.query(models.Booking).count()
    total_customers = db.query(models.Customer).count()
    trial_count = sum(1 for t in tenants if t.subscription_status == "trialing")
    active_count = sum(1 for t in tenants if t.is_active)
    db_engine = "SQLite (WAL Mode)" if str(engine.url).startswith("sqlite") else "PostgreSQL"
    return {
        "total_tenants": len(tenants),
        "active_tenants": active_count,
        "trial_tenants": trial_count,
        "total_cars": total_cars,
        "total_bookings": total_bookings,
        "total_customers": total_customers,
        "db_engine": db_engine
    }

@app.get("/api/tenant/branding")
def get_tenant_branding(
    db: Session = Depends(get_db), 
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    db_tenant = crud.get_tenant(db, tenant_id)
    all_default_flags = [
        "dashboard", "fleet", "customers", "leads", "quotations", "bookings",
        "receipts", "employees", "maintenance", "blacklist", "whatsapp_api",
        "advanced_analytics", "chauffeur_module"
    ]
    if not db_tenant:
        return {
            "id": "default",
            "name": "Rent A Car Management System",
            "logo_url": None,
            "primary_theme_color": "#0d9488",
            "is_active": True,
            "plan_type": "standard",
            "subscription_status": "active",
            "trial_ends_at": None,
            "trial_days_left": None,
            "feature_flags": all_default_flags,
            "branding_settings": {
                "support_email": "support@rentacarmanagement.com",
                "support_phone": "0300-1234567",
                "footer_status_text": "Cloud SaaS Ready",
                "bg_gradient_start": "#0d9488"
            }
        }
    sub_status = getattr(db_tenant, "subscription_status", "active") or "active"
    trial_ends = getattr(db_tenant, "trial_ends_at", None)
    days_left = None
    if trial_ends:
        days_left = (trial_ends - date.today()).days
        if sub_status == "trialing" and days_left < 0:
            sub_status = "expired"
    return {
        "id": db_tenant.id,
        "name": db_tenant.name,
        "logo_url": db_tenant.logo_url,
        "primary_theme_color": db_tenant.primary_theme_color,
        "is_active": db_tenant.is_active,
        "plan_type": getattr(db_tenant, "plan_type", "standard") or "standard",
        "subscription_status": sub_status,
        "trial_ends_at": trial_ends.isoformat() if trial_ends else None,
        "trial_days_left": days_left,
        "feature_flags": db_tenant.feature_flags or all_default_flags,
        "branding_settings": db_tenant.branding_settings or {}
    }

@app.put("/api/tenant/branding")
def update_own_tenant_branding(
    payload: schemas.TenantSelfBrandingUpdate,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    db_tenant = crud.get_tenant(db, tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if payload.name is not None:
        db_tenant.name = payload.name
    if payload.logo_url is not None:
        db_tenant.logo_url = payload.logo_url
    if payload.primary_theme_color is not None:
        db_tenant.primary_theme_color = payload.primary_theme_color
    if payload.branding_settings is not None:
        merged = dict(db_tenant.branding_settings or {})
        merged.update(payload.branding_settings)
        db_tenant.branding_settings = merged
    db.commit()
    db.refresh(db_tenant)
    return {
        "id": db_tenant.id,
        "name": db_tenant.name,
        "logo_url": db_tenant.logo_url,
        "primary_theme_color": db_tenant.primary_theme_color,
        "branding_settings": db_tenant.branding_settings or {}
    }

@app.post("/api/tenant/upload-logo")
def upload_tenant_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    safe_url = upload_file_securely(file)
    db_tenant = crud.get_tenant(db, tenant_context["tenant_id"])
    if db_tenant:
        db_tenant.logo_url = safe_url
        db.commit()
    return {"logo_url": safe_url}


# --- Investors & Tracing Endpoints ---
@app.get("/api/investors", response_model=List[schemas.InvestorFinancialSummary])
@app.get("/api/investors/", response_model=List[schemas.InvestorFinancialSummary])
def list_investors(
    skip: int = 0,
    limit: int = 10000,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    investors = crud.get_investors(db, tenant_id=tenant_id, skip=skip, limit=limit)
    summaries = []
    for inv in investors:
        summary = crud.get_investor_financial_summary(db, investor_id=inv.id, tenant_id=tenant_id)
        if summary:
            summaries.append(summary)
    return summaries

@app.post("/api/investors/", response_model=schemas.Investor)
def create_investor(
    investor: schemas.InvestorCreate,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    return crud.create_investor(db, investor=investor, tenant_id=tenant_id)

@app.get("/api/investors/{investor_id}", response_model=schemas.InvestorFinancialSummary)
def get_investor_summary(
    investor_id: int,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    summary = crud.get_investor_financial_summary(db, investor_id=investor_id, tenant_id=tenant_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Investor not found")
    return summary

@app.put("/api/investors/{investor_id}", response_model=schemas.Investor)
def update_investor(
    investor_id: int,
    investor_update: schemas.InvestorUpdate,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    updated = crud.update_investor(db, investor_id=investor_id, investor_update=investor_update, tenant_id=tenant_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Investor not found")
    return updated

@app.delete("/api/investors/{investor_id}")
def delete_investor(
    investor_id: int,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    deleted = crud.delete_investor(db, investor_id=investor_id, tenant_id=tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Investor not found")
    return {"message": "Investor deleted successfully"}

@app.get("/api/investors/{investor_id}/payouts", response_model=List[schemas.InvestorPayout])
def list_investor_payouts(
    investor_id: int,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    return crud.get_investor_payouts(db, investor_id=investor_id, tenant_id=tenant_id)

@app.post("/api/investors/{investor_id}/payouts", response_model=schemas.InvestorPayout)
def create_investor_payout(
    investor_id: int,
    payout: schemas.InvestorPayoutBase,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    db_investor = crud.get_investor(db, investor_id=investor_id, tenant_id=tenant_id)
    if not db_investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    payout_create = schemas.InvestorPayoutCreate(**payout.dict(), investor_id=investor_id)
    return crud.create_investor_payout(db, payout=payout_create, tenant_id=tenant_id)


# --- Shareholders & Tracing Endpoints ---
@app.get("/api/shareholders", response_model=List[schemas.ShareholderFinancialSummary])
@app.get("/api/shareholders/", response_model=List[schemas.ShareholderFinancialSummary])
def list_shareholders(
    skip: int = 0,
    limit: int = 10000,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    shareholders = crud.get_shareholders(db, tenant_id=tenant_id, skip=skip, limit=limit)
    summaries = []
    for sh in shareholders:
        summary = crud.get_shareholder_financial_summary(db, shareholder_id=sh.id, tenant_id=tenant_id)
        if summary:
            summaries.append(summary)
    return summaries

@app.post("/api/shareholders/", response_model=schemas.Shareholder)
def create_shareholder(
    shareholder: schemas.ShareholderCreate,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    return crud.create_shareholder(db, shareholder=shareholder, tenant_id=tenant_id)

@app.get("/api/shareholders/{shareholder_id}", response_model=schemas.ShareholderFinancialSummary)
def get_shareholder_summary(
    shareholder_id: int,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    summary = crud.get_shareholder_financial_summary(db, shareholder_id=shareholder_id, tenant_id=tenant_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Shareholder not found")
    return summary

@app.put("/api/shareholders/{shareholder_id}", response_model=schemas.Shareholder)
def update_shareholder(
    shareholder_id: int,
    shareholder_update: schemas.ShareholderUpdate,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    updated = crud.update_shareholder(db, shareholder_id=shareholder_id, shareholder_update=shareholder_update, tenant_id=tenant_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Shareholder not found")
    return updated

@app.delete("/api/shareholders/{shareholder_id}")
def delete_shareholder(
    shareholder_id: int,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    deleted = crud.delete_shareholder(db, shareholder_id=shareholder_id, tenant_id=tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Shareholder not found")
    return {"message": "Shareholder deleted successfully"}

@app.get("/api/shareholders/{shareholder_id}/payouts", response_model=List[schemas.ShareholderPayout])
def list_shareholder_payouts(
    shareholder_id: int,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    return crud.get_shareholder_payouts(db, shareholder_id=shareholder_id, tenant_id=tenant_id)

@app.post("/api/shareholders/{shareholder_id}/payouts", response_model=schemas.ShareholderPayout)
def create_shareholder_payout(
    shareholder_id: int,
    payout: schemas.ShareholderPayoutBase,
    db: Session = Depends(get_db),
    tenant_context: dict = Depends(get_tenant_context)
):
    tenant_id = tenant_context["tenant_id"]
    db_shareholder = crud.get_shareholder(db, shareholder_id=shareholder_id, tenant_id=tenant_id)
    if not db_shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    payout_create = schemas.ShareholderPayoutCreate(**payout.dict(), shareholder_id=shareholder_id)
    return crud.create_shareholder_payout(db, payout=payout_create, tenant_id=tenant_id)


# --- Employees & Payroll Endpoints ---
@app.get("/api/employees", response_model=List[schemas.Employee])
def list_employees(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_employees(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/employees", response_model=schemas.Employee)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_employee(db, employee=employee, tenant_id=tenant_context["tenant_id"])

@app.put("/api/employees/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: int, employee_update: schemas.EmployeeUpdate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    updated = crud.update_employee(db, employee_id=employee_id, employee_update=employee_update, tenant_id=tenant_context["tenant_id"])
    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found")
    return updated

@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    deleted = crud.delete_employee(db, employee_id=employee_id, tenant_id=tenant_context["tenant_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}

@app.post("/api/employees/{employee_id}/payments", response_model=schemas.EmployeePayment)
def create_employee_payment(employee_id: int, payment: schemas.EmployeePaymentCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    tenant_id = tenant_context["tenant_id"]
    emp = crud.get_employee(db, employee_id=employee_id, tenant_id=tenant_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return crud.create_employee_payment(db, employee_id=employee_id, payment=payment, tenant_id=tenant_id)


# --- Customer Leads CRM Endpoints ---
@app.get("/api/leads", response_model=List[schemas.Lead])
def list_leads(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_leads(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/leads", response_model=schemas.Lead)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_lead(db, lead=lead, tenant_id=tenant_context["tenant_id"])

@app.put("/api/leads/{lead_id}", response_model=schemas.Lead)
def update_lead(lead_id: int, lead_update: schemas.LeadUpdate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    updated = crud.update_lead(db, lead_id=lead_id, lead_update=lead_update, tenant_id=tenant_context["tenant_id"])
    if not updated:
        raise HTTPException(status_code=404, detail="Lead not found")
    return updated

@app.delete("/api/leads/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    deleted = crud.delete_lead(db, lead_id=lead_id, tenant_id=tenant_context["tenant_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted successfully"}


# --- Invoice Quotations Endpoints ---
@app.get("/api/quotations", response_model=List[schemas.Quotation])
def list_quotations(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_quotations(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/quotations", response_model=schemas.Quotation)
def create_quotation(quotation: schemas.QuotationCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_quotation(db, quotation=quotation, tenant_id=tenant_context["tenant_id"])

@app.put("/api/quotations/{quotation_id}", response_model=schemas.Quotation)
def update_quotation(quotation_id: int, quotation_update: schemas.QuotationUpdate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    updated = crud.update_quotation(db, quotation_id=quotation_id, quotation_update=quotation_update, tenant_id=tenant_context["tenant_id"])
    if not updated:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return updated

@app.delete("/api/quotations/{quotation_id}")
def delete_quotation(quotation_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    deleted = crud.delete_quotation(db, quotation_id=quotation_id, tenant_id=tenant_context["tenant_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return {"message": "Quotation deleted successfully"}


# --- Receipts Endpoints ---
@app.get("/api/receipts", response_model=List[schemas.Receipt])
def list_receipts(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_receipts(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/receipts", response_model=schemas.Receipt)
def create_receipt(receipt: schemas.ReceiptCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_receipt(db, receipt=receipt, tenant_id=tenant_context["tenant_id"])

@app.delete("/api/receipts/{receipt_id}")
def delete_receipt(receipt_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    deleted = crud.delete_receipt(db, receipt_id=receipt_id, tenant_id=tenant_context["tenant_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"message": "Receipt deleted successfully"}


# --- Vehicles Invoices (Multi-Vehicle Client Billing & Owner Settlement) ---
@app.get("/api/vehicle-invoices", response_model=List[schemas.VehicleInvoice])
def list_vehicle_invoices(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_vehicle_invoices(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/vehicle-invoices", response_model=schemas.VehicleInvoice)
def create_vehicle_invoice(invoice: schemas.VehicleInvoiceCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_vehicle_invoice(db, invoice=invoice, tenant_id=tenant_context["tenant_id"])

@app.put("/api/vehicle-invoices/{invoice_id}", response_model=schemas.VehicleInvoice)
def update_vehicle_invoice(invoice_id: int, invoice_update: schemas.VehicleInvoiceUpdate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    updated = crud.update_vehicle_invoice(db, invoice_id=invoice_id, invoice_update=invoice_update, tenant_id=tenant_context["tenant_id"])
    if not updated:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return updated

@app.delete("/api/vehicle-invoices/{invoice_id}")
def delete_vehicle_invoice(invoice_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    deleted = crud.delete_vehicle_invoice(db, invoice_id=invoice_id, tenant_id=tenant_context["tenant_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}


# --- Official Letterhead Documents ---
@app.get("/api/letters", response_model=List[schemas.OfficialLetter])
def list_official_letters(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.get_official_letters(db, tenant_id=tenant_context["tenant_id"], skip=skip, limit=limit)

@app.post("/api/letters", response_model=schemas.OfficialLetter)
def create_official_letter(letter: schemas.OfficialLetterCreate, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    return crud.create_official_letter(db, letter=letter, tenant_id=tenant_context["tenant_id"])

@app.delete("/api/letters/{letter_id}")
def delete_official_letter(letter_id: int, db: Session = Depends(get_db), tenant_context: dict = Depends(get_tenant_context)):
    deleted = crud.delete_official_letter(db, letter_id=letter_id, tenant_id=tenant_context["tenant_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Letter not found")
    return {"message": "Letter deleted successfully"}


# --- Serve React Frontend SPA build ---
if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
else:
    @app.get("/")
    def index():
        return {"status": "Backend running", "message": "Production frontend static assets not found. Run dev server."}
