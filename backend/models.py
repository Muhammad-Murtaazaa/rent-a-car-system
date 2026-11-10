from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base

class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    plate_number = Column(String, unique=True, index=True, nullable=False)
    chassis_number = Column(String, nullable=True, index=True)
    make_model = Column(String, nullable=False)
    model_year = Column(Integer, nullable=False)
    color = Column(String, nullable=False)
    engine_cc = Column(Integer, nullable=False)
    current_odometer = Column(Integer, nullable=False)
    transmission_type = Column(String, nullable=False)  # Auto / Manual
    status = Column(String, nullable=False, default="Available")  # Available, Rented, Maintenance, Reserved
    last_oil_change_odometer = Column(Integer, nullable=False, default=0)
    image_url = Column(String, nullable=True)
    registration_doc_url = Column(String, nullable=True)
    fitness_cert_url = Column(String, nullable=True)
    token_tax_doc_url = Column(String, nullable=True)
    fitness_expiry_date = Column(Date, nullable=True)
    token_tax_expiry_date = Column(Date, nullable=True)
    registration_expiry_date = Column(Date, nullable=True)
    investor_id = Column(Integer, ForeignKey("investors.id"), nullable=True)
    investor_profit_share = Column(Float, nullable=True)
    shareholder_id = Column(Integer, ForeignKey("shareholders.id"), nullable=True)
    shareholder_profit_share = Column(Float, nullable=True)

    bookings = relationship("Booking", back_populates="car")
    maintenance_logs = relationship("MaintenanceLog", back_populates="car")
    investor = relationship("Investor", back_populates="cars")
    shareholder = relationship("Shareholder", back_populates="cars")

class Investor(Base):
    __tablename__ = "investors"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    cnic_number = Column(String, nullable=True)
    investment_amount = Column(Float, nullable=False, default=0.0)
    payout_type = Column(String, nullable=False, default="percentage")  # "percentage" | "fixed"
    profit_share_percentage = Column(Float, nullable=False, default=70.0) # Default investor share %
    fixed_amount = Column(Float, nullable=False, default=0.0)  # Fixed agreed amount if payout_type == "fixed"
    joined_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)

    cars = relationship("Car", back_populates="investor")
    payouts = relationship("InvestorPayout", back_populates="investor")

class InvestorPayout(Base):
    __tablename__ = "investor_payouts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    investor_id = Column(Integer, ForeignKey("investors.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payout_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=False) # Cash, Bank Transfer, Cheque, EasyPaisa
    notes = Column(String, nullable=True)

    investor = relationship("Investor", back_populates="payouts")

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    full_name = Column(String, nullable=False)
    phone_primary = Column(String, nullable=False)
    phone_secondary = Column(String, nullable=True)
    home_address = Column(String, nullable=False)
    cnic_number = Column(String, unique=True, index=True, nullable=False)  # 13-digit string
    license_number = Column(String, nullable=False)
    cnic_front_path = Column(String, nullable=True)
    cnic_back_path = Column(String, nullable=True)
    license_front_path = Column(String, nullable=True)
    license_expiry_date = Column(Date, nullable=True)
    cheque_number = Column(String, nullable=True)
    passport_number = Column(String, nullable=True)
    guarantor_name = Column(String, nullable=True)
    guarantor_phone = Column(String, nullable=True)
    guarantor_cnic = Column(String, nullable=True)
    guarantor_address = Column(String, nullable=True)
    guarantee_details = Column(String, nullable=True)

    bookings = relationship("Booking", back_populates="customer")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    expected_end_datetime = Column(DateTime, nullable=False)
    actual_return_datetime = Column(DateTime, nullable=True)
    daily_rate = Column(Float, nullable=False)
    is_chauffeur_driven = Column(Boolean, nullable=False, default=False)
    chauffeur_daily_wage = Column(Float, nullable=False, default=0.0)
    security_deposit_amount = Column(Float, nullable=False, default=0.0)
    security_deposit_type = Column(String, nullable=False)  # Cash, Cheque, Token/Item
    security_deposit_status = Column(String, nullable=False, default="Held")  # Held, Refunded, Withheld
    status = Column(String, nullable=False, default="Active")  # Active, Reserved, Completed, Cancelled
    booking_type = Column(String, nullable=False, default="Individual")  # Individual, Company
    company_name = Column(String, nullable=True)

    car = relationship("Car", back_populates="bookings")
    customer = relationship("Customer", back_populates="bookings")
    financials = relationship("Financial", back_populates="booking")
    booked_cars = relationship("BookedCar", back_populates="booking", cascade="all, delete-orphan")

class BookedCar(Base):
    __tablename__ = "booked_cars"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    daily_rate = Column(Float, nullable=False)
    start_odometer = Column(Integer, nullable=True, default=0)
    return_odometer = Column(Integer, nullable=True, default=0)
    fuel_level_on_start = Column(String, nullable=True, default="Full")
    fuel_level_on_return = Column(String, nullable=True, default="Full")
    extra_fuel_charge = Column(Float, nullable=True, default=0.0)
    structural_damage_charge = Column(Float, nullable=True, default=0.0)

    booking = relationship("Booking", back_populates="booked_cars")
    car = relationship("Car")

class Financial(Base):
    __tablename__ = "financials"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_datetime = Column(DateTime, nullable=False)
    payment_method = Column(String, nullable=False)  # Cash, Bank Transfer, EasyPaisa/JazzCash
    balance_due = Column(Float, nullable=False)

    booking = relationship("Booking", back_populates="financials")

class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    log_type = Column(String, nullable=False)  # Oil Change, Repair, Tuning, Token Tax, Vehicle Fitness
    cost = Column(Float, nullable=False)
    execution_date = Column(Date, nullable=False)
    next_due_date_or_odometer = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    car = relationship("Car", back_populates="maintenance_logs")

class Blacklist(Base):
    __tablename__ = "blacklist"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    cnic_number = Column(String, unique=True, index=True, nullable=False)
    reason_flag = Column(String, nullable=False)
    logged_date = Column(Date, nullable=False)

class Shareholder(Base):
    __tablename__ = "shareholders"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    cnic_number = Column(String, nullable=True)
    investment_amount = Column(Float, nullable=False, default=0.0)
    payout_type = Column(String, nullable=False, default="percentage")  # "percentage" | "fixed"
    share_percentage = Column(Float, nullable=False, default=50.0)
    fixed_amount = Column(Float, nullable=False, default=0.0)  # Fixed agreed amount if payout_type == "fixed"
    joined_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)

    cars = relationship("Car", back_populates="shareholder")
    payouts = relationship("ShareholderPayout", back_populates="shareholder")

class ShareholderPayout(Base):
    __tablename__ = "shareholder_payouts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    shareholder_id = Column(Integer, ForeignKey("shareholders.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payout_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=False)
    notes = Column(String, nullable=True)

    shareholder = relationship("Shareholder", back_populates="payouts")

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, index=True) # e.g. subdomain or identifier
    name = Column(String, nullable=False)
    logo_url = Column(String, nullable=True)
    primary_theme_color = Column(String, nullable=True, default="#0d9488") # Default teal-600 hex
    contact_name = Column(String, nullable=False)
    operational_manager = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    plan_type = Column(String, nullable=False, default="standard")  # "trial_7d", "monthly", "yearly", "lifetime", "standard"
    subscription_status = Column(String, nullable=False, default="active")  # "trialing", "active", "expired", "suspended"
    trial_ends_at = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    feature_flags = Column(JSON, nullable=False, default=list) # e.g. ["whatsapp_api", "advanced_analytics"]
    branding_settings = Column(JSON, nullable=False, default=dict)

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="Driver")  # Driver, Desk Staff, Manager, Mechanic, Washer, Accountant
    phone = Column(String, nullable=False)
    cnic_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    license_number = Column(String, nullable=True)
    salary_type = Column(String, nullable=False, default="Monthly")  # Monthly, Daily, Per Trip
    salary_amount = Column(Float, nullable=False, default=0.0)
    joining_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="Active")  # Active, On Leave, Inactive
    notes = Column(String, nullable=True)

    payments = relationship("EmployeePayment", back_populates="employee", cascade="all, delete-orphan")

class EmployeePayment(Base):
    __tablename__ = "employee_payments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=False, default="Cash")
    month_label = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    employee = relationship("Employee", back_populates="payments")

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    interested_vehicle = Column(String, nullable=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=True)
    pickup_date = Column(Date, nullable=True)
    duration_days = Column(Integer, nullable=False, default=1)
    quoted_amount = Column(Float, nullable=True, default=0.0)
    source = Column(String, nullable=False, default="Phone Call")  # Walk-in, Phone Call, WhatsApp, Social Media, Website, Referral
    status = Column(String, nullable=False, default="New")  # New, Contacted, Quoted, Converted, Lost
    follow_up_date = Column(Date, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    quote_number = Column(String, nullable=False, index=True)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=True)
    vehicle_description = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days = Column(Integer, nullable=False, default=1)
    daily_rate = Column(Float, nullable=False, default=0.0)
    chauffeur_included = Column(Boolean, nullable=False, default=False)
    chauffeur_daily_rate = Column(Float, nullable=False, default=0.0)
    discount_amount = Column(Float, nullable=False, default=0.0)
    tax_percentage = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    valid_until = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="Draft")  # Draft, Sent, Accepted, Expired, Converted
    items = Column(JSON, nullable=True, default=list)  # Multi-vehicle rate lines: [{name, days_label, amount}]
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class VehicleInvoice(Base):
    __tablename__ = "vehicle_invoices"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    invoice_number = Column(String, nullable=False, index=True)
    invoice_mode = Column(String, nullable=False, default="client")  # "client" | "settlement"
    invoice_to = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    period_label = Column(String, nullable=True)  # e.g. "Month Of October"
    invoice_date = Column(Date, nullable=False)
    vehicle_items = Column(JSON, nullable=False, default=list)  # [{name, period, amount}]
    expense_items = Column(JSON, nullable=False, default=list)  # [{description, amount}]
    total_rent = Column(Float, nullable=False, default=0.0)
    total_expense = Column(Float, nullable=False, default=0.0)
    received_amount = Column(Float, nullable=False, default=0.0)
    payable_or_balance = Column(Float, nullable=False, default=0.0)
    show_bank_details = Column(Boolean, nullable=False, default=True)
    bank_name = Column(String, nullable=True)
    account_title = Column(String, nullable=True)
    account_number = Column(String, nullable=True)
    terms_text = Column(String, nullable=True)
    status = Column(String, nullable=False, default="Unpaid")  # Unpaid, Partial, Paid, Settled
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class OfficialLetter(Base):
    __tablename__ = "official_letters"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    letter_number = Column(String, nullable=False, index=True)
    letter_date = Column(Date, nullable=False)
    recipient = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    body = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, nullable=False, index=True, default="default")
    receipt_number = Column(String, nullable=False, index=True)
    receipt_type = Column(String, nullable=False, default="Booking Payment")  # Booking Payment, Security Deposit, Deposit Refund, Other Income
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    vehicle_info = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False, default="Cash")
    reference_no = Column(String, nullable=True)
    receipt_date = Column(Date, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
