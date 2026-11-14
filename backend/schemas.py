from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, List, Dict, Any

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
    guarantor2_name: Optional[str] = None
    guarantor2_phone: Optional[str] = None
    guarantor2_cnic: Optional[str] = None
    guarantor2_address: Optional[str] = None
    guarantee_details: Optional[str] = None
    extra_documents: Optional[Any] = None

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
    guarantor2_name: Optional[str] = None
    guarantor2_phone: Optional[str] = None
    guarantor2_cnic: Optional[str] = None
    guarantor2_address: Optional[str] = None
    guarantee_details: Optional[str] = None
    extra_documents: Optional[Any] = None

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
    car_wash_charge: Optional[float] = 0.0
    overtime_charge: Optional[float] = 0.0
    was_given_washed: Optional[bool] = True
    is_returned_unwashed: Optional[bool] = False

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
    driver_type: Optional[str] = "Company Driver"  # Company Driver, Freelance Driver
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_cnic: Optional[str] = None
    billable_days: Optional[int] = None
    specific_days_notes: Optional[str] = None
    late_penalty_charge: Optional[float] = 0.0
    car_wash_charge: Optional[float] = 0.0
    destination: Optional[str] = None
    pickup_location: Optional[str] = None
    event_timing: Optional[str] = None
    road_plan: Optional[str] = None
    fuel_package: Optional[str] = "Without Fuel"
    cars_qty: Optional[int] = 1
    total_rent_decided: Optional[float] = 0.0
    advance_paid: Optional[float] = 0.0

class BookingCreate(BookingBase):
    booked_cars: Optional[List[BookedCarCreate]] = None

class QuickEventBookingRequest(BaseModel):
    client_name: str
    phone: str
    cnic: str
    event_date: Optional[str] = None
    start_datetime: datetime
    expected_end_datetime: datetime
    event_timing: Optional[str] = None
    destination: Optional[str] = None
    pickup_location: Optional[str] = None
    road_plan: Optional[str] = None
    cars_qty: Optional[int] = 1
    car_ids: Optional[List[int]] = None
    car_models_note: Optional[str] = None
    fuel_package: Optional[str] = "Without Fuel"
    is_chauffeur_driven: Optional[bool] = False
    total_rent: float
    advance_paid: Optional[float] = 0.0
    payment_method: Optional[str] = "Cash"
    security_deposit_amount: Optional[float] = 0.0
    security_deposit_type: Optional[str] = "Cash"

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
    destination: Optional[str] = None
    pickup_location: Optional[str] = None
    event_timing: Optional[str] = None
    road_plan: Optional[str] = None
    fuel_package: Optional[str] = None
    cars_qty: Optional[int] = None
    total_rent_decided: Optional[float] = None
    advance_paid: Optional[float] = None
    company_name: Optional[str] = None
    driver_type: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_cnic: Optional[str] = None
    billable_days: Optional[int] = None
    specific_days_notes: Optional[str] = None
    late_penalty_charge: Optional[float] = None
    car_wash_charge: Optional[float] = None
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
    admin_username: Optional[str] = None
    admin_password: Optional[str] = None
    admin_email: Optional[str] = None

class SuperAdminLoginRequest(BaseModel):
    password: str

class TenantLoginRequest(BaseModel):
    tenant_id: str
    username: str
    password: str

class TenantUserBase(BaseModel):
    tenant_id: str
    username: str
    email: Optional[str] = None
    role: str = "tenant_admin"
    full_name: Optional[str] = None
    is_active: bool = True

class TenantUserCreate(TenantUserBase):
    password: str

class TenantUser(TenantUserBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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
    items: Optional[List[Dict]] = []
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
    items: Optional[List[Dict]] = None
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


# Vehicles Invoices (Multi-Vehicle Client Billing & Owner/Investor Settlement)
class VehicleInvoiceBase(BaseModel):
    invoice_number: Optional[str] = None
    invoice_mode: str = "client"  # "client" | "settlement"
    invoice_to: str
    customer_phone: Optional[str] = None
    period_label: Optional[str] = None
    invoice_date: date
    vehicle_items: List[Dict] = []  # [{name, period, amount}]
    expense_items: List[Dict] = []  # [{description, amount}]
    total_rent: float = 0.0
    total_expense: float = 0.0
    received_amount: float = 0.0
    payable_or_balance: float = 0.0
    show_bank_details: bool = True
    bank_name: Optional[str] = None
    account_title: Optional[str] = None
    account_number: Optional[str] = None
    terms_text: Optional[str] = None
    status: str = "Unpaid"

class VehicleInvoiceCreate(VehicleInvoiceBase):
    pass

class VehicleInvoiceUpdate(BaseModel):
    invoice_mode: Optional[str] = None
    invoice_to: Optional[str] = None
    customer_phone: Optional[str] = None
    period_label: Optional[str] = None
    invoice_date: Optional[date] = None
    vehicle_items: Optional[List[Dict]] = None
    expense_items: Optional[List[Dict]] = None
    total_rent: Optional[float] = None
    total_expense: Optional[float] = None
    received_amount: Optional[float] = None
    payable_or_balance: Optional[float] = None
    show_bank_details: Optional[bool] = None
    bank_name: Optional[str] = None
    account_title: Optional[str] = None
    account_number: Optional[str] = None
    terms_text: Optional[str] = None
    status: Optional[str] = None

class VehicleInvoice(VehicleInvoiceBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Official Letterhead Documents
class OfficialLetterBase(BaseModel):
    letter_number: Optional[str] = None
    letter_date: date
    recipient: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None

class OfficialLetterCreate(OfficialLetterBase):
    pass

class OfficialLetter(OfficialLetterBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Tenant Self-Service White-Label Profile Update
class TenantSelfBrandingUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_theme_color: Optional[str] = None
    branding_settings: Optional[Dict[str, str]] = None


# Supplier Deals (Sublet / Third-Party Fleet Sourcing)
class SupplierDealBase(BaseModel):
    supplier_name: str
    supplier_phone: str
    supplier_cnic: Optional[str] = None
    car_make_model: str
    car_plate_number: str
    car_color: Optional[str] = None
    customer_name: str
    customer_phone: str
    start_date: date
    end_date: date
    days: int = 1
    supplier_daily_rate: float = 0.0
    supplier_total_cost: float = 0.0
    client_daily_rate: float = 0.0
    client_total_rent: float = 0.0
    commission_amount: float = 0.0
    driver_expense: float = 0.0
    fuel_expense: float = 0.0
    other_expense: float = 0.0
    total_expenses: float = 0.0
    net_cash_profit: float = 0.0
    client_received_amount: float = 0.0
    client_remaining_balance: float = 0.0
    supplier_paid_amount: float = 0.0
    supplier_remaining_payable: float = 0.0
    status: str = "Active"
    notes: Optional[str] = None

class SupplierDealCreate(SupplierDealBase):
    pass

class SupplierDealUpdate(BaseModel):
    supplier_name: Optional[str] = None
    supplier_phone: Optional[str] = None
    supplier_cnic: Optional[str] = None
    car_make_model: Optional[str] = None
    car_plate_number: Optional[str] = None
    car_color: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    days: Optional[int] = None
    supplier_daily_rate: Optional[float] = None
    supplier_total_cost: Optional[float] = None
    client_daily_rate: Optional[float] = None
    client_total_rent: Optional[float] = None
    commission_amount: Optional[float] = None
    driver_expense: Optional[float] = None
    fuel_expense: Optional[float] = None
    other_expense: Optional[float] = None
    total_expenses: Optional[float] = None
    net_cash_profit: Optional[float] = None
    client_received_amount: Optional[float] = None
    client_remaining_balance: Optional[float] = None
    supplier_paid_amount: Optional[float] = None
    supplier_remaining_payable: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class SupplierDeal(SupplierDealBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Partner Rent A Cars (Other Agencies)
class PartnerAgencyBase(BaseModel):
    agency_name: str
    contact_person: Optional[str] = None
    phone: str
    whatsapp: Optional[str] = None
    city: Optional[str] = "Lahore"
    address: Optional[str] = None
    total_cars_count: int = 0
    available_cars_json: Optional[str] = "[]"
    commission_terms: Optional[str] = None
    notes: Optional[str] = None

class PartnerAgencyCreate(PartnerAgencyBase):
    pass

class PartnerAgencyUpdate(BaseModel):
    agency_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    total_cars_count: Optional[int] = None
    available_cars_json: Optional[str] = None
    commission_terms: Optional[str] = None
    notes: Optional[str] = None

class PartnerAgency(PartnerAgencyBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Chauffeurs / Drivers Directory
class ChauffeurDriverBase(BaseModel):
    name: str
    phone: str
    cnic: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    daily_wage: float = 0.0
    status: str = "Available"
    driver_type: str = "Freelance"
    agency_affiliation: Optional[str] = None
    experience_years: Optional[int] = 0
    specialties: Optional[str] = None
    notes: Optional[str] = None

class ChauffeurDriverCreate(ChauffeurDriverBase):
    pass

class ChauffeurDriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[str] = None
    daily_wage: Optional[float] = None
    status: Optional[str] = None
    driver_type: Optional[str] = None
    agency_affiliation: Optional[str] = None
    experience_years: Optional[int] = None
    specialties: Optional[str] = None
    notes: Optional[str] = None

class ChauffeurDriver(ChauffeurDriverBase):
    id: int
    tenant_id: str
    created_at: datetime

    class Config:
        from_attributes = True
