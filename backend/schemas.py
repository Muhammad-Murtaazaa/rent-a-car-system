from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, List, Dict

# Cars
class CarBase(BaseModel):
    plate_number: str
    chassis_number: Optional[str] = None
    make_model: str
    model_year: int
    color: str
    engine_cc: int
    current_odometer: int
    transmission_type: str  # Auto / Manual
    status: str = "Available"  # Available, Rented, Maintenance, Reserved
    last_oil_change_odometer: int = 0
    image_url: Optional[str] = None
    registration_doc_url: Optional[str] = None
    fitness_cert_url: Optional[str] = None
    token_tax_doc_url: Optional[str] = None
    fitness_expiry_date: Optional[date] = None
    token_tax_expiry_date: Optional[date] = None
    registration_expiry_date: Optional[date] = None
    investor_id: Optional[int] = None
    investor_profit_share: Optional[float] = None
    shareholder_id: Optional[int] = None
    shareholder_profit_share: Optional[float] = None

class CarCreate(CarBase):
    pass

class CarUpdate(BaseModel):
    plate_number: Optional[str] = None
    chassis_number: Optional[str] = None
    make_model: Optional[str] = None
    model_year: Optional[int] = None
    color: Optional[str] = None
    engine_cc: Optional[int] = None
    current_odometer: Optional[int] = None
    transmission_type: Optional[str] = None
    status: Optional[str] = None
    last_oil_change_odometer: Optional[int] = None
    image_url: Optional[str] = None
    registration_doc_url: Optional[str] = None
    fitness_cert_url: Optional[str] = None
    token_tax_doc_url: Optional[str] = None
    fitness_expiry_date: Optional[date] = None
    token_tax_expiry_date: Optional[date] = None
    registration_expiry_date: Optional[date] = None
    investor_id: Optional[int] = None
    investor_profit_share: Optional[float] = None
    shareholder_id: Optional[int] = None
    shareholder_profit_share: Optional[float] = None

class Car(CarBase):
    id: int

    class Config:
        from_attributes = True


# Customers
class CustomerBase(BaseModel):
    full_name: str
    phone_primary: str
    phone_secondary: Optional[str] = None
    home_address: str
    cnic_number: str  # 13-digit constraint
    license_number: str
    cnic_front_path: Optional[str] = None
    cnic_back_path: Optional[str] = None
    license_front_path: Optional[str] = None
    license_expiry_date: Optional[date] = None
    cheque_number: Optional[str] = None
    passport_number: Optional[str] = None
    guarantor_name: Optional[str] = None
    guarantor_phone: Optional[str] = None
    guarantor_cnic: Optional[str] = None
    guarantor_address: Optional[str] = None
    guarantee_details: Optional[str] = None

    @field_validator('cnic_number')
    @classmethod
    def validate_cnic(cls, v):
        cleaned = v.replace("-", "").strip()
        if not cleaned.isdigit() or len(cleaned) != 13:
            raise ValueError("CNIC number must be exactly a 13-digit string")
        return cleaned

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_primary: Optional[str] = None
    phone_secondary: Optional[str] = None
    home_address: Optional[str] = None
    cnic_number: Optional[str] = None
    license_number: Optional[str] = None
    cnic_front_path: Optional[str] = None
    cnic_back_path: Optional[str] = None
    license_front_path: Optional[str] = None
    license_expiry_date: Optional[date] = None
    cheque_number: Optional[str] = None
    passport_number: Optional[str] = None
    guarantor_name: Optional[str] = None
    guarantor_phone: Optional[str] = None
    guarantor_cnic: Optional[str] = None
    guarantor_address: Optional[str] = None
    guarantee_details: Optional[str] = None

class Customer(CustomerBase):
    id: int

    class Config:
        from_attributes = True


# Bookings
class BookedCarBase(BaseModel):
    car_id: int
    daily_rate: float
    start_odometer: Optional[int] = 0
    return_odometer: Optional[int] = 0
    fuel_level_on_start: Optional[str] = "Full"
    fuel_level_on_return: Optional[str] = "Full"
    extra_fuel_charge: Optional[float] = 0.0
    structural_damage_charge: Optional[float] = 0.0

class BookedCarCreate(BookedCarBase):
    pass

class BookedCar(BookedCarBase):
    id: int
    booking_id: int
    car: Optional[Car] = None

    class Config:
        from_attributes = True

class BookingBase(BaseModel):
    car_id: Optional[int] = None
    customer_id: int
    start_datetime: datetime
    expected_end_datetime: datetime
    actual_return_datetime: Optional[datetime] = None
    daily_rate: float
    is_chauffeur_driven: bool = False
    chauffeur_daily_wage: float = 0.0
    security_deposit_amount: float = 0.0
    security_deposit_type: str  # Cash, Cheque, Token/Item
    security_deposit_status: str = "Held"  # Held, Refunded, Withheld
    status: str = "Active"  # Active, Reserved, Completed, Cancelled
    booking_type: Optional[str] = "Individual"  # Individual, Company
    company_name: Optional[str] = None

class BookingCreate(BookingBase):
    booked_cars: Optional[List[BookedCarCreate]] = None

class BookingUpdate(BaseModel):
    car_id: Optional[int] = None
    customer_id: Optional[int] = None
    start_datetime: Optional[datetime] = None
    expected_end_datetime: Optional[datetime] = None
    actual_return_datetime: Optional[datetime] = None
    daily_rate: Optional[float] = None
    is_chauffeur_driven: Optional[bool] = None
    chauffeur_daily_wage: Optional[float] = None
    security_deposit_amount: Optional[float] = None
    security_deposit_type: Optional[str] = None
    security_deposit_status: Optional[str] = None
    status: Optional[str] = None
    booking_type: Optional[str] = None
    company_name: Optional[str] = None
    booked_cars: Optional[List[BookedCarCreate]] = None

class Booking(BookingBase):
    id: int
    car: Optional[Car] = None
    customer: Optional[Customer] = None
    booked_cars: List[BookedCar] = []

    class Config:
        from_attributes = True


# Financials
class FinancialBase(BaseModel):
    booking_id: int
    amount_paid: float
    payment_datetime: datetime
    payment_method: str  # Cash, Bank Transfer, EasyPaisa/JazzCash
    balance_due: float

class FinancialCreate(FinancialBase):
    pass

class Financial(FinancialBase):
    id: int

    class Config:
        from_attributes = True


# Maintenance Logs
class MaintenanceLogBase(BaseModel):
    car_id: int
    log_type: str  # Oil Change, Repair, Tuning, Token Tax, Vehicle Fitness
    cost: float
    execution_date: date
    next_due_date_or_odometer: Optional[str] = None
    notes: Optional[str] = None

class MaintenanceLogCreate(MaintenanceLogBase):
    pass

class MaintenanceLog(MaintenanceLogBase):
    id: int
    car: Optional[Car] = None

    class Config:
        from_attributes = True


# Blacklist
class BlacklistBase(BaseModel):
    cnic_number: str
    reason_flag: str
    logged_date: date

    @field_validator('cnic_number')
    @classmethod
    def validate_cnic(cls, v):
        cleaned = v.replace("-", "").strip()
        if not cleaned.isdigit() or len(cleaned) != 13:
            raise ValueError("CNIC number must be exactly a 13-digit string")
        return cleaned

class BlacklistCreate(BlacklistBase):
    pass

class Blacklist(BlacklistBase):
    id: int

    class Config:
        from_attributes = True

# Tenants
class TenantBase(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    primary_theme_color: Optional[str] = "#0d9488"
    contact_name: str
    operational_manager: str
    is_active: bool = True
    plan_type: str = "standard"
    subscription_status: str = "active"
    trial_ends_at: Optional[date] = None
    feature_flags: List[str] = []
    branding_settings: Dict[str, str] = {}

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_theme_color: Optional[str] = None
    contact_name: Optional[str] = None
    operational_manager: Optional[str] = None
    is_active: Optional[bool] = None
    plan_type: Optional[str] = None
    subscription_status: Optional[str] = None
    trial_ends_at: Optional[date] = None
    feature_flags: Optional[List[str]] = None
    branding_settings: Optional[Dict[str, str]] = None

class Tenant(TenantBase):
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FeatureToggleRequest(BaseModel):
    feature_flags: List[str]

# Investors & Payouts
class InvestorPayoutBase(BaseModel):
    amount: float = Field(..., gt=0)
    payout_date: date
    payment_method: str
    notes: Optional[str] = None

class InvestorPayoutCreate(InvestorPayoutBase):
    investor_id: int

class InvestorPayout(InvestorPayoutBase):
    id: int
    tenant_id: str
    investor_id: int

    class Config:
        from_attributes = True

class InvestorBase(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    cnic_number: Optional[str] = None
    investment_amount: float = 0.0
    payout_type: str = "percentage"  # "percentage" | "fixed"
    profit_share_percentage: float = 70.0
    fixed_amount: float = 0.0
    joined_date: date
    notes: Optional[str] = None

class InvestorCreate(InvestorBase):
    assigned_car_ids: Optional[List[int]] = []

class InvestorUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cnic_number: Optional[str] = None
    investment_amount: Optional[float] = None
    payout_type: Optional[str] = None
    profit_share_percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    joined_date: Optional[date] = None
    notes: Optional[str] = None
    assigned_car_ids: Optional[List[int]] = None

class Investor(InvestorBase):
    id: int
    tenant_id: str
    cars: List[Car] = []
    payouts: List[InvestorPayout] = []

    class Config:
        from_attributes = True

class InvestorCarPerformance(BaseModel):
    car_id: int
    plate_number: str
    make_model: str
    bookings_count: int
    total_revenue_generated: float
    total_maintenance_cost: float
    net_profit: float
    investor_earnings: float

class InvestorFinancialSummary(BaseModel):
    investor_id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    cnic_number: Optional[str] = None
    investment_amount: float
    payout_type: str = "percentage"
    profit_share_percentage: float
    fixed_amount: float = 0.0
    joined_date: date
    notes: Optional[str] = None
    total_cars_owned: int
    total_revenue_generated: float
    total_maintenance_cost: float
    net_profit_generated: float
    total_investor_earnings: float
    total_payouts_received: float
    payout_balance_due: float
    cars: List[Car] = []
    car_performance: List[InvestorCarPerformance] = []
    payouts: List[InvestorPayout] = []

# Shareholders & Payouts
class ShareholderPayoutBase(BaseModel):
    amount: float = Field(..., gt=0)
    payout_date: date
    payment_method: str
    notes: Optional[str] = None

class ShareholderPayoutCreate(ShareholderPayoutBase):
    shareholder_id: int

class ShareholderPayout(ShareholderPayoutBase):
    id: int
    tenant_id: str
    shareholder_id: int

    class Config:
        from_attributes = True

class ShareholderBase(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    cnic_number: Optional[str] = None
    investment_amount: float = 0.0
    payout_type: str = "percentage"  # "percentage" | "fixed"
    share_percentage: float = 50.0
    fixed_amount: float = 0.0
    joined_date: date
    notes: Optional[str] = None

class ShareholderCreate(ShareholderBase):
    assigned_car_ids: Optional[List[int]] = []

class ShareholderUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cnic_number: Optional[str] = None
    investment_amount: Optional[float] = None
    payout_type: Optional[str] = None
    share_percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    joined_date: Optional[date] = None
    notes: Optional[str] = None
    assigned_car_ids: Optional[List[int]] = None

class Shareholder(ShareholderBase):
    id: int
    tenant_id: str
    cars: List[Car] = []
    payouts: List[ShareholderPayout] = []

    class Config:
        from_attributes = True

class ShareholderCarPerformance(BaseModel):
    car_id: int
    plate_number: str
    make_model: str
    bookings_count: int
    total_revenue_generated: float
    total_maintenance_cost: float
    net_profit: float
    platform_fee: float
    shareholder_earnings: float

class ShareholderFinancialSummary(BaseModel):
    shareholder_id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    cnic_number: Optional[str] = None
    investment_amount: float
    payout_type: str = "percentage"
    share_percentage: float
    fixed_amount: float = 0.0
    joined_date: date
    notes: Optional[str] = None
    total_cars_owned: int
    total_revenue_generated: float
    total_maintenance_cost: float
    net_profit_generated: float
    total_platform_fee: float
    total_shareholder_earnings: float
    total_payouts_received: float
    payout_balance_due: float
    cars: List[Car] = []
    car_performance: List[ShareholderCarPerformance] = []
    payouts: List[ShareholderPayout] = []

# Employees & Salary Payments
class EmployeePaymentBase(BaseModel):
    amount: float = Field(..., gt=0)
    payment_date: date
    payment_method: str = "Cash"
    month_label: Optional[str] = None
    notes: Optional[str] = None

class EmployeePaymentCreate(EmployeePaymentBase):
    pass

class EmployeePayment(EmployeePaymentBase):
    id: int
    tenant_id: str
    employee_id: int

    class Config:
        from_attributes = True

class EmployeeBase(BaseModel):
    full_name: str
    role: str = "Driver"
    phone: str
    cnic_number: Optional[str] = None
    address: Optional[str] = None
    license_number: Optional[str] = None
    salary_type: str = "Monthly"
    salary_amount: float = 0.0
    joining_date: date
    status: str = "Active"
    notes: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    cnic_number: Optional[str] = None
    address: Optional[str] = None
    license_number: Optional[str] = None
    salary_type: Optional[str] = None
    salary_amount: Optional[float] = None
    joining_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Employee(EmployeeBase):
    id: int
    tenant_id: str
    payments: List[EmployeePayment] = []

    class Config:
        from_attributes = True

# Leads (Customer Inquiries CRM)
class LeadBase(BaseModel):
    full_name: str
    phone: str
    email: Optional[str] = None
    interested_vehicle: Optional[str] = None
    car_id: Optional[int] = None
    pickup_date: Optional[date] = None
    duration_days: int = 1
    quoted_amount: Optional[float] = 0.0
    source: str = "Phone Call"
    status: str = "New"
    follow_up_date: Optional[date] = None
    notes: Optional[str] = None

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    interested_vehicle: Optional[str] = None
    car_id: Optional[int] = None
    pickup_date: Optional[date] = None
    duration_days: Optional[int] = None
    quoted_amount: Optional[float] = None
    source: Optional[str] = None
    status: Optional[str] = None
    follow_up_date: Optional[date] = None
    notes: Optional[str] = None

class Lead(LeadBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Invoice Quotations
class QuotationBase(BaseModel):
    quote_number: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    company_name: Optional[str] = None
    car_id: Optional[int] = None
    vehicle_description: str
    start_date: date
    end_date: date
    days: int = 1
    daily_rate: float = 0.0
    chauffeur_included: bool = False
    chauffeur_daily_rate: float = 0.0
    discount_amount: float = 0.0
    tax_percentage: float = 0.0
    total_amount: float = 0.0
    valid_until: Optional[date] = None
    status: str = "Draft"
    notes: Optional[str] = None

class QuotationCreate(QuotationBase):
    pass

class QuotationUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    company_name: Optional[str] = None
    car_id: Optional[int] = None
    vehicle_description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    days: Optional[int] = None
    daily_rate: Optional[float] = None
    chauffeur_included: Optional[bool] = None
    chauffeur_daily_rate: Optional[float] = None
    discount_amount: Optional[float] = None
    tax_percentage: Optional[float] = None
    total_amount: Optional[float] = None
    valid_until: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Quotation(QuotationBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Payment & Deposit Receipts
class ReceiptBase(BaseModel):
    receipt_number: Optional[str] = None
    receipt_type: str = "Booking Payment"
    booking_id: Optional[int] = None
    customer_name: str
    customer_phone: Optional[str] = None
    vehicle_info: Optional[str] = None
    amount: float = Field(..., gt=0)
    payment_method: str = "Cash"
    reference_no: Optional[str] = None
    receipt_date: date
    notes: Optional[str] = None

class ReceiptCreate(ReceiptBase):
    pass

class Receipt(ReceiptBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True
