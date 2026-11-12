from sqlalchemy.orm import Session, joinedload
from backend import models, schemas
from datetime import datetime, date
from fastapi import HTTPException, status

# --- Cars CRUD ---
def get_car(db: Session, car_id: int, tenant_id: str):
    return db.query(models.Car).filter(models.Car.id == car_id, models.Car.tenant_id == tenant_id).first()

def get_car_by_plate(db: Session, plate_number: str, tenant_id: str):
    return db.query(models.Car).filter(models.Car.plate_number == plate_number, models.Car.tenant_id == tenant_id).first()

def get_cars(db: Session, tenant_id: str, skip: int = 0, limit: int = 10000):
    return db.query(models.Car).filter(models.Car.tenant_id == tenant_id).offset(skip).limit(limit).all()

def create_car(db: Session, car: schemas.CarCreate, tenant_id: str):
    db_car = models.Car(**car.dict(), tenant_id=tenant_id)
    db.add(db_car)
    db.commit()
    db.refresh(db_car)
    return db_car

def update_car(db: Session, car_id: int, car_update: schemas.CarUpdate, tenant_id: str):
    db_car = get_car(db, car_id, tenant_id)
    if not db_car:
        return None
    payload = car_update.dict(exclude_unset=True)
    # Don't let a blind "Available" overwrite Active/Reserved bookings
    if payload.get("status") == "Available":
        open_bk = db.query(models.Booking).join(models.Booking.booked_cars, isouter=True).filter(
            models.Booking.tenant_id == tenant_id,
            (models.Booking.car_id == car_id) | (models.BookedCar.car_id == car_id),
            models.Booking.status.in_(["Active", "Reserved"]),
        ).first()
        if open_bk:
            payload.pop("status", None)
    for key, value in payload.items():
        setattr(db_car, key, value)
    db.commit()
    db.refresh(db_car)
    return db_car

def delete_car(db: Session, car_id: int, tenant_id: str):
    db_car = get_car(db, car_id, tenant_id)
    if db_car:
        db.delete(db_car)
        db.commit()
    return db_car


# --- Customers CRUD ---
def get_customer(db: Session, customer_id: int, tenant_id: str):
    return db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.tenant_id == tenant_id).first()

def get_customer_by_cnic(db: Session, cnic_number: str, tenant_id: str):
    cleaned = cnic_number.replace("-", "").strip()
    return db.query(models.Customer).filter(models.Customer.cnic_number == cleaned, models.Customer.tenant_id == tenant_id).first()

def get_customers(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
    return db.query(models.Customer).filter(models.Customer.tenant_id == tenant_id).offset(skip).limit(limit).all()

def create_customer(db: Session, customer: schemas.CustomerCreate, tenant_id: str):
    db_customer = models.Customer(**customer.dict(), tenant_id=tenant_id)
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def update_customer(db: Session, customer_id: int, customer_update: schemas.CustomerUpdate, tenant_id: str):
    db_customer = get_customer(db, customer_id, tenant_id)
    if not db_customer:
        return None
    for key, value in customer_update.dict(exclude_unset=True).items():
        setattr(db_customer, key, value)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def delete_customer(db: Session, customer_id: int, tenant_id: str):
    db_customer = get_customer(db, customer_id, tenant_id)
    if db_customer:
        db.delete(db_customer)
        db.commit()
    return db_customer


# --- Bookings CRUD & Overlap Validation & Blacklist Checks ---
def get_booking(db: Session, booking_id: int, tenant_id: str):
    return db.query(models.Booking).filter(models.Booking.id == booking_id, models.Booking.tenant_id == tenant_id).first()

def promote_due_reservations(db: Session, tenant_id: str) -> int:
    """Reserved bookings whose start time has passed become Active."""
    now = datetime.now()
    due = (
        db.query(models.Booking)
        .filter(
            models.Booking.tenant_id == tenant_id,
            models.Booking.status == "Reserved",
            models.Booking.start_datetime <= now,
        )
        .all()
    )
    touched = {b.car_id for b in due}
    for b in due:
        b.status = "Active"
    for car_id in touched:
        reconcile_car_status(db, car_id, tenant_id)
    if due:
        db.commit()
    return len(due)


def get_bookings(db: Session, tenant_id: str, skip: int = 0, limit: int = 10000):
    from sqlalchemy.orm import joinedload
    promote_due_reservations(db, tenant_id)
    return (
        db.query(models.Booking)
        .options(joinedload(models.Booking.car), joinedload(models.Booking.customer))
        .filter(models.Booking.tenant_id == tenant_id)
        .order_by(models.Booking.start_datetime.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def reconcile_car_status(db: Session, car_id: int, tenant_id: str, exclude_booking_id: int = None, clear_maintenance: bool = False):
    """Set car.status from open bookings. clear_maintenance frees workshop hold when idle."""
    car = get_car(db, car_id, tenant_id)
    if not car:
        return None
    query = db.query(models.Booking).join(models.Booking.booked_cars, isouter=True).filter(
        models.Booking.tenant_id == tenant_id,
        (models.Booking.car_id == car_id) | (models.BookedCar.car_id == car_id),
        models.Booking.status.in_(["Active", "Reserved"]),
    )
    if exclude_booking_id:
        query = query.filter(models.Booking.id != exclude_booking_id)
    open_bookings = query.order_by(models.Booking.start_datetime.asc()).all()
    if any(b.status == "Active" for b in open_bookings):
        car.status = "Rented"
    elif open_bookings:
        car.status = "Reserved"
    elif clear_maintenance or car.status != "Maintenance":
        car.status = "Available"
    return car

def check_overlapping_bookings(db: Session, car_id: int, start: datetime, end: datetime, tenant_id: str, exclude_booking_id: int = None):
    # Find active/reserved bookings for this car that overlap
    query = db.query(models.Booking).join(models.Booking.booked_cars, isouter=True).filter(
        models.Booking.tenant_id == tenant_id,
        (models.Booking.car_id == car_id) | (models.BookedCar.car_id == car_id),
        models.Booking.status.in_(["Active", "Reserved"]),
        # (StartA < EndB) and (EndA > StartB)
        models.Booking.start_datetime < end,
        models.Booking.expected_end_datetime > start
    )
    if exclude_booking_id:
        query = query.filter(models.Booking.id != exclude_booking_id)
    return query.first()

def create_booking(db: Session, booking: schemas.BookingCreate, tenant_id: str):
    # 1. Blacklist check first
    db_customer = get_customer(db, booking.customer_id, tenant_id)
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    blacklisted = db.query(models.Blacklist).filter(
        models.Blacklist.cnic_number == db_customer.cnic_number,
        models.Blacklist.tenant_id == tenant_id
    ).first()
    if blacklisted:
        raise HTTPException(status_code=400, detail=f"Customer is BLACKLISTED! Reason: {blacklisted.reason_flag}")

    # Determine booked cars list
    booked_cars_list = booking.booked_cars
    if not booked_cars_list:
        if booking.car_id is not None:
            booked_cars_list = [
                schemas.BookedCarCreate(
                    car_id=booking.car_id,
                    daily_rate=booking.daily_rate
                )
            ]
        else:
            raise HTTPException(status_code=400, detail="No cars selected for booking.")

    # 2. Check collision/overlapping & maintenance for all selected cars
    for bc in booked_cars_list:
        car = get_car(db, bc.car_id, tenant_id)
        if not car:
            raise HTTPException(status_code=404, detail=f"Car ID {bc.car_id} not found")
        if car.status == "Maintenance":
            raise HTTPException(status_code=400, detail=f"Car {car.make_model} ({car.plate_number}) is in Maintenance and cannot be booked.")
        
        overlap = check_overlapping_bookings(db, bc.car_id, booking.start_datetime, booking.expected_end_datetime, tenant_id)
        if overlap:
            raise HTTPException(
                status_code=400,
                detail=f"Car collision detected! Car {car.make_model} ({car.plate_number}) is already booked from {overlap.start_datetime} to {overlap.expected_end_datetime}."
            )

    # 3. Create booking — future starts = Reserved
    booking_data = booking.dict(exclude={"booked_cars"})
    starts_now = booking.start_datetime <= datetime.now()
    booking_data["status"] = "Active" if starts_now else "Reserved"
    
    # Backwards compatibility fields: main car_id and daily_rate
    booking_data["car_id"] = booked_cars_list[0].car_id
    booking_data["daily_rate"] = sum(c.daily_rate for c in booked_cars_list)

    db_booking = models.Booking(**booking_data, tenant_id=tenant_id)
    db.add(db_booking)
    db.flush()

    # Create BookedCar records
    for bc in booked_cars_list:
        db_bc = models.BookedCar(
            tenant_id=tenant_id,
            booking_id=db_booking.id,
            car_id=bc.car_id,
            daily_rate=bc.daily_rate,
            start_odometer=bc.start_odometer or 0,
            return_odometer=bc.return_odometer or 0,
            fuel_level_on_start=bc.fuel_level_on_start or "Full",
            fuel_level_on_return=bc.fuel_level_on_return or "Full",
            extra_fuel_charge=bc.extra_fuel_charge or 0.0,
            structural_damage_charge=bc.structural_damage_charge or 0.0
        )
        db.add(db_bc)

    # 4. Reconcile fleet status from ALL open bookings
    for bc in booked_cars_list:
        reconcile_car_status(db, bc.car_id, tenant_id)

    db.commit()
    db.refresh(db_booking)
    return db_booking

def update_booking(db: Session, booking_id: int, booking_update: schemas.BookingUpdate, tenant_id: str):
    db_booking = get_booking(db, booking_id, tenant_id)
    if not db_booking:
        return None

    old_car_id = db_booking.car_id
    
    # If updating dates/car, re-run overlap check
    new_car_id = booking_update.car_id if booking_update.car_id is not None else db_booking.car_id
    new_start = booking_update.start_datetime if booking_update.start_datetime is not None else db_booking.start_datetime
    new_end = booking_update.expected_end_datetime if booking_update.expected_end_datetime is not None else db_booking.expected_end_datetime

    # If updating dates/car and the booking is Active/Reserved
    status_val = booking_update.status if booking_update.status is not None else db_booking.status
    if status_val in ["Active", "Reserved"] and (booking_update.car_id is not None or booking_update.start_datetime is not None or booking_update.expected_end_datetime is not None):
        overlap = check_overlapping_bookings(db, new_car_id, new_start, new_end, tenant_id, exclude_booking_id=booking_id)
        if overlap:
            raise HTTPException(
                status_code=400,
                detail=f"Car collision detected! The selected car is already booked from {overlap.start_datetime} to {overlap.expected_end_datetime}."
            )

    # Update booked_cars if provided in body
    if booking_update.booked_cars is not None:
        for bc_up in booking_update.booked_cars:
            db_bc = db.query(models.BookedCar).filter(
                models.BookedCar.booking_id == booking_id,
                models.BookedCar.car_id == bc_up.car_id,
                models.BookedCar.tenant_id == tenant_id
            ).first()
            if db_bc:
                db_bc.start_odometer = bc_up.start_odometer
                db_bc.return_odometer = bc_up.return_odometer
                db_bc.fuel_level_on_start = bc_up.fuel_level_on_start
                db_bc.fuel_level_on_return = bc_up.fuel_level_on_return
                db_bc.extra_fuel_charge = bc_up.extra_fuel_charge
                db_bc.structural_damage_charge = bc_up.structural_damage_charge
                db_bc.daily_rate = bc_up.daily_rate

    # Apply updates to Booking model
    booking_data = booking_update.dict(exclude_unset=True, exclude={"booked_cars"})
    for key, value in booking_data.items():
        setattr(db_booking, key, value)

    # Reconcile car status for all cars linked to this booking
    cars_to_reconcile = [bc.car_id for bc in db_booking.booked_cars]
    if old_car_id and old_car_id not in cars_to_reconcile:
        cars_to_reconcile.append(old_car_id)
    if db_booking.car_id and db_booking.car_id not in cars_to_reconcile:
        cars_to_reconcile.append(db_booking.car_id)

    done = (booking_update.status or db_booking.status) in ("Completed", "Cancelled")
    for cid in cars_to_reconcile:
        reconcile_car_status(db, cid, tenant_id, clear_maintenance=done)

    db.commit()
    db.refresh(db_booking)
    return db_booking


# --- Financials CRUD ---
def get_financials(db: Session, tenant_id: str, skip: int = 0, limit: int = 10000):
    return (
        db.query(models.Financial)
        .filter(models.Financial.tenant_id == tenant_id)
        .order_by(models.Financial.payment_datetime.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_financials_by_booking(db: Session, booking_id: int, tenant_id: str):
    return (
        db.query(models.Financial)
        .filter(models.Financial.booking_id == booking_id, models.Financial.tenant_id == tenant_id)
        .order_by(models.Financial.payment_datetime.asc())
        .all()
    )

def sum_paid_for_booking(db: Session, booking_id: int, tenant_id: str) -> float:
    rows = get_financials_by_booking(db, booking_id, tenant_id)
    return float(sum((r.amount_paid or 0) for r in rows))

def create_financial(db: Session, financial: schemas.FinancialCreate, tenant_id: str):
    # Client sends balance_due as remaining AFTER this payment. Clamp negatives.
    # ponytail: no stored invoice total — client computes charges; server validates amount + booking.
    payload = financial.dict()
    amount = float(payload.get("amount_paid") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount_paid must be > 0")
    payload["amount_paid"] = amount
    payload["balance_due"] = max(0.0, float(payload.get("balance_due") or 0))
    db_financial = models.Financial(**payload, tenant_id=tenant_id)
    db.add(db_financial)
    db.commit()
    db.refresh(db_financial)
    return db_financial


# --- Maintenance Logs CRUD ---
def get_maintenance_logs(db: Session, tenant_id: str, skip: int = 0, limit: int = 10000):
    from sqlalchemy.orm import joinedload
    return (
        db.query(models.MaintenanceLog)
        .options(joinedload(models.MaintenanceLog.car))
        .filter(models.MaintenanceLog.tenant_id == tenant_id)
        .order_by(models.MaintenanceLog.execution_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def create_maintenance_log(db: Session, log: schemas.MaintenanceLogCreate, tenant_id: str):
    car = get_car(db, log.car_id, tenant_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    db_log = models.MaintenanceLog(**log.dict(), tenant_id=tenant_id)
    db.add(db_log)

    if log.log_type == "Oil Change":
        car.last_oil_change_odometer = car.current_odometer

    # Only Repair/Tuning park the car in workshop — Oil Change / Token Tax stay Available
    if log.log_type in ("Repair", "Tuning") and log.execution_date == date.today():
        open_rental = db.query(models.Booking).join(models.Booking.booked_cars, isouter=True).filter(
            models.Booking.tenant_id == tenant_id,
            (models.Booking.car_id == log.car_id) | (models.BookedCar.car_id == log.car_id),
            models.Booking.status.in_(["Active", "Reserved"]),
        ).first()
        if not open_rental:
            car.status = "Maintenance"

    db.commit()
    db.refresh(db_log)
    return db_log


# --- Blacklist CRUD ---
def get_blacklist(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
    return db.query(models.Blacklist).filter(models.Blacklist.tenant_id == tenant_id).offset(skip).limit(limit).all()

def get_blacklist_by_cnic(db: Session, cnic_number: str, tenant_id: str):
    cleaned = cnic_number.replace("-", "").strip()
    return db.query(models.Blacklist).filter(models.Blacklist.cnic_number == cleaned, models.Blacklist.tenant_id == tenant_id).first()

def add_to_blacklist(db: Session, blacklist: schemas.BlacklistCreate, tenant_id: str):
    db_blacklist = models.Blacklist(**blacklist.dict(), tenant_id=tenant_id)
    db.add(db_blacklist)
    db.commit()
    db.refresh(db_blacklist)
    return db_blacklist

def remove_from_blacklist(db: Session, cnic_number: str, tenant_id: str):
    cleaned = cnic_number.replace("-", "").strip()
    db_blacklist = db.query(models.Blacklist).filter(models.Blacklist.cnic_number == cleaned, models.Blacklist.tenant_id == tenant_id).first()
    if db_blacklist:
        db.delete(db_blacklist)
        db.commit()
    return db_blacklist

# --- Tenant CRUD (SaaS Operations) ---
def get_tenant(db: Session, tenant_id: str):
    return db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()

def get_tenants(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Tenant).offset(skip).limit(limit).all()

def create_tenant(db: Session, tenant: schemas.TenantCreate):
    db_tenant = models.Tenant(**tenant.dict())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

def update_tenant(db: Session, tenant_id: str, tenant_update: schemas.TenantUpdate):
    db_tenant = get_tenant(db, tenant_id)
    if not db_tenant:
        return None
    for key, value in tenant_update.dict(exclude_unset=True).items():
        setattr(db_tenant, key, value)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant


# --- Investors & Payouts CRUD ---
def get_investor(db: Session, investor_id: int, tenant_id: str):
    return db.query(models.Investor).filter(models.Investor.id == investor_id, models.Investor.tenant_id == tenant_id).first()

def get_investors(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
    return db.query(models.Investor).filter(models.Investor.tenant_id == tenant_id).offset(skip).limit(limit).all()

def create_investor(db: Session, investor: schemas.InvestorCreate, tenant_id: str):
    investor_data = investor.dict(exclude={"assigned_car_ids"})
    db_investor = models.Investor(**investor_data, tenant_id=tenant_id)
    db.add(db_investor)
    db.commit()
    db.refresh(db_investor)

    if investor.assigned_car_ids:
        # Link cars to this investor
        cars = db.query(models.Car).filter(models.Car.id.in_(investor.assigned_car_ids), models.Car.tenant_id == tenant_id).all()
        for car in cars:
            car.investor_id = db_investor.id
            if car.investor_profit_share is None:
                car.investor_profit_share = db_investor.profit_share_percentage
        db.commit()
        db.refresh(db_investor)

    return db_investor

def update_investor(db: Session, investor_id: int, investor_update: schemas.InvestorUpdate, tenant_id: str):
    db_investor = get_investor(db, investor_id, tenant_id)
    if not db_investor:
        return None

    update_data = investor_update.dict(exclude_unset=True)
    assigned_car_ids = update_data.pop("assigned_car_ids", None)

    for key, value in update_data.items():
        setattr(db_investor, key, value)

    if assigned_car_ids is not None:
        # First unlink old cars that are no longer assigned
        old_cars = db.query(models.Car).filter(models.Car.investor_id == investor_id, models.Car.tenant_id == tenant_id).all()
        for car in old_cars:
            if car.id not in assigned_car_ids:
                car.investor_id = None

        # Link newly assigned cars
        new_cars = db.query(models.Car).filter(models.Car.id.in_(assigned_car_ids), models.Car.tenant_id == tenant_id).all()
        for car in new_cars:
            car.investor_id = db_investor.id
            if car.investor_profit_share is None:
                car.investor_profit_share = db_investor.profit_share_percentage

    db.commit()
    db.refresh(db_investor)
    return db_investor

def delete_investor(db: Session, investor_id: int, tenant_id: str):
    db_investor = get_investor(db, investor_id, tenant_id)
    if db_investor:
        # Unlink cars first
        cars = db.query(models.Car).filter(models.Car.investor_id == investor_id, models.Car.tenant_id == tenant_id).all()
        for car in cars:
            car.investor_id = None
        # Delete payouts
        payouts = db.query(models.InvestorPayout).filter(models.InvestorPayout.investor_id == investor_id, models.InvestorPayout.tenant_id == tenant_id).all()
        for p in payouts:
            db.delete(p)
        db.delete(db_investor)
        db.commit()
    return db_investor

def create_investor_payout(db: Session, payout: schemas.InvestorPayoutCreate, tenant_id: str):
    db_payout = models.InvestorPayout(**payout.dict(), tenant_id=tenant_id)
    db.add(db_payout)
    db.commit()
    db.refresh(db_payout)
    return db_payout

def get_investor_payouts(db: Session, investor_id: int, tenant_id: str):
    return db.query(models.InvestorPayout).filter(
        models.InvestorPayout.investor_id == investor_id,
        models.InvestorPayout.tenant_id == tenant_id
    ).all()

def get_investor_financial_summary(db: Session, investor_id: int, tenant_id: str):
    db_investor = get_investor(db, investor_id, tenant_id)
    if not db_investor:
        return None

    # Get cars owned by this investor
    investor_cars = db.query(models.Car).filter(models.Car.investor_id == investor_id, models.Car.tenant_id == tenant_id).all()
    
    car_performance_list = []
    tot_revenue = 0.0
    tot_maint = 0.0
    tot_net_profit = 0.0
    tot_investor_earnings = 0.0

    for car in investor_cars:
        # 1. Total revenue from car's bookings (proportional)
        bookings = (
            db.query(models.Booking)
            .join(models.Booking.booked_cars, isouter=True)
            .options(joinedload(models.Booking.booked_cars))
            .filter(
                (models.Booking.car_id == car.id) | (models.BookedCar.car_id == car.id),
                models.Booking.tenant_id == tenant_id
            )
            .all()
        )
        
        revenue = 0.0
        for b in bookings:
            financials = db.query(models.Financial).filter(models.Financial.booking_id == b.id, models.Financial.tenant_id == tenant_id).all()
            b_revenue = sum(f.amount_paid for f in financials)
            
            proportion = 1.0
            if b.booked_cars:
                total_rate = sum(bc.daily_rate for bc in b.booked_cars) or 1.0
                car_bc = next((bc for bc in b.booked_cars if bc.car_id == car.id), None)
                if car_bc:
                    proportion = car_bc.daily_rate / total_rate
            
            revenue += b_revenue * proportion

        # 2. Total maintenance cost for car
        maint_logs = db.query(models.MaintenanceLog).filter(models.MaintenanceLog.car_id == car.id, models.MaintenanceLog.tenant_id == tenant_id).all()
        maint_cost = sum(m.cost for m in maint_logs)

        net_profit = revenue - maint_cost
        
        # Share rate: fallback to investor rate if car specific rate not set
        share_rate = car.investor_profit_share if car.investor_profit_share is not None else db_investor.profit_share_percentage
        investor_car_earnings = max(0.0, net_profit) * (share_rate / 100.0)

        tot_revenue += revenue
        tot_maint += maint_cost
        tot_net_profit += net_profit
        tot_investor_earnings += investor_car_earnings

        car_performance_list.append(schemas.InvestorCarPerformance(
            car_id=car.id,
            plate_number=car.plate_number,
            make_model=car.make_model,
            bookings_count=len(bookings),
            total_revenue_generated=revenue,
            total_maintenance_cost=maint_cost,
            net_profit=net_profit,
            investor_earnings=investor_car_earnings
        ))

    # Payouts received
    payouts = db.query(models.InvestorPayout).filter(models.InvestorPayout.investor_id == investor_id, models.InvestorPayout.tenant_id == tenant_id).all()
    tot_payouts = sum(p.amount for p in payouts)
    effective_payout_type = getattr(db_investor, "payout_type", "percentage") or "percentage"
    effective_fixed_amount = float(getattr(db_investor, "fixed_amount", 0.0) or 0.0)
    if effective_payout_type == "fixed":
        tot_investor_earnings = effective_fixed_amount
    payout_balance_due = tot_investor_earnings - tot_payouts

    return schemas.InvestorFinancialSummary(
        investor_id=db_investor.id,
        full_name=db_investor.full_name,
        phone=db_investor.phone,
        email=db_investor.email,
        cnic_number=db_investor.cnic_number,
        investment_amount=db_investor.investment_amount,
        payout_type=effective_payout_type,
        profit_share_percentage=db_investor.profit_share_percentage,
        fixed_amount=effective_fixed_amount,
        joined_date=db_investor.joined_date,
        notes=db_investor.notes,
        total_cars_owned=len(investor_cars),
        total_revenue_generated=tot_revenue,
        total_maintenance_cost=tot_maint,
        net_profit_generated=tot_net_profit,
        total_investor_earnings=tot_investor_earnings,
        total_payouts_received=tot_payouts,
        payout_balance_due=payout_balance_due,
        cars=[schemas.Car.from_orm(c) for c in investor_cars],
        car_performance=car_performance_list,
        payouts=[schemas.InvestorPayout.from_orm(p) for p in payouts]
    )

# --- Shareholders & Payouts CRUD ---
def get_shareholder(db: Session, shareholder_id: int, tenant_id: str):
    return db.query(models.Shareholder).filter(models.Shareholder.id == shareholder_id, models.Shareholder.tenant_id == tenant_id).first()

def get_shareholders(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
    return db.query(models.Shareholder).filter(models.Shareholder.tenant_id == tenant_id).offset(skip).limit(limit).all()

def create_shareholder(db: Session, shareholder: schemas.ShareholderCreate, tenant_id: str):
    shareholder_data = shareholder.dict(exclude={"assigned_car_ids"})
    db_shareholder = models.Shareholder(**shareholder_data, tenant_id=tenant_id)
    db.add(db_shareholder)
    db.commit()
    db.refresh(db_shareholder)

    if shareholder.assigned_car_ids:
        # Link cars to this shareholder
        cars = db.query(models.Car).filter(models.Car.id.in_(shareholder.assigned_car_ids), models.Car.tenant_id == tenant_id).all()
        for car in cars:
            car.shareholder_id = db_shareholder.id
            if car.shareholder_profit_share is None:
                car.shareholder_profit_share = db_shareholder.share_percentage
        db.commit()
        db.refresh(db_shareholder)
    return db_shareholder

def update_shareholder(db: Session, shareholder_id: int, shareholder_update: schemas.ShareholderUpdate, tenant_id: str):
    db_shareholder = get_shareholder(db, shareholder_id, tenant_id)
    if not db_shareholder:
        return None
    
    update_data = shareholder_update.dict(exclude_unset=True)
    if "assigned_car_ids" in update_data:
        assigned_car_ids = update_data.pop("assigned_car_ids")
        if assigned_car_ids is not None:
            # Unlink previous cars
            old_cars = db.query(models.Car).filter(models.Car.shareholder_id == shareholder_id, models.Car.tenant_id == tenant_id).all()
            for car in old_cars:
                car.shareholder_id = None
            
            # Link new ones
            new_cars = db.query(models.Car).filter(models.Car.id.in_(assigned_car_ids), models.Car.tenant_id == tenant_id).all()
            for car in new_cars:
                car.shareholder_id = db_shareholder.id
                if car.shareholder_profit_share is None:
                    car.shareholder_profit_share = db_shareholder.share_percentage
    
    for key, value in update_data.items():
        setattr(db_shareholder, key, value)
    
    db.commit()
    db.refresh(db_shareholder)
    return db_shareholder

def delete_shareholder(db: Session, shareholder_id: int, tenant_id: str):
    db_shareholder = get_shareholder(db, shareholder_id, tenant_id)
    if db_shareholder:
        # Unlink cars
        cars = db.query(models.Car).filter(models.Car.shareholder_id == shareholder_id, models.Car.tenant_id == tenant_id).all()
        for car in cars:
            car.shareholder_id = None
        
        # Delete payouts
        payouts = db.query(models.ShareholderPayout).filter(models.ShareholderPayout.shareholder_id == shareholder_id, models.ShareholderPayout.tenant_id == tenant_id).all()
        for p in payouts:
            db.delete(p)
        
        db.delete(db_shareholder)
        db.commit()
    return db_shareholder

def create_shareholder_payout(db: Session, payout: schemas.ShareholderPayoutCreate, tenant_id: str):
    db_payout = models.ShareholderPayout(**payout.dict(), tenant_id=tenant_id)
    db.add(db_payout)
    db.commit()
    db.refresh(db_payout)
    return db_payout

def get_shareholder_payouts(db: Session, shareholder_id: int, tenant_id: str):
    return db.query(models.ShareholderPayout).filter(
        models.ShareholderPayout.shareholder_id == shareholder_id,
        models.ShareholderPayout.tenant_id == tenant_id
    ).all()

def get_shareholder_financial_summary(db: Session, shareholder_id: int, tenant_id: str):
    db_shareholder = get_shareholder(db, shareholder_id, tenant_id)
    if not db_shareholder:
        return None

    # Get cars owned by this shareholder
    shareholder_cars = db.query(models.Car).filter(models.Car.shareholder_id == shareholder_id, models.Car.tenant_id == tenant_id).all()
    
    car_performance_list = []
    tot_revenue = 0.0
    tot_maint = 0.0
    tot_net_profit = 0.0
    tot_platform_fee = 0.0
    tot_shareholder_earnings = 0.0

    for car in shareholder_cars:
        # 1. Total revenue from car's bookings (proportional)
        bookings = (
            db.query(models.Booking)
            .join(models.Booking.booked_cars, isouter=True)
            .options(joinedload(models.Booking.booked_cars))
            .filter(
                (models.Booking.car_id == car.id) | (models.BookedCar.car_id == car.id),
                models.Booking.tenant_id == tenant_id
            )
            .all()
        )
        
        revenue = 0.0
        for b in bookings:
            financials = db.query(models.Financial).filter(models.Financial.booking_id == b.id, models.Financial.tenant_id == tenant_id).all()
            b_revenue = sum(f.amount_paid for f in financials)
            
            proportion = 1.0
            if b.booked_cars:
                total_rate = sum(bc.daily_rate for bc in b.booked_cars) or 1.0
                car_bc = next((bc for bc in b.booked_cars if bc.car_id == car.id), None)
                if car_bc:
                    proportion = car_bc.daily_rate / total_rate
            
            revenue += b_revenue * proportion

        # 2. Total maintenance cost for car
        maint_logs = db.query(models.MaintenanceLog).filter(models.MaintenanceLog.car_id == car.id, models.MaintenanceLog.tenant_id == tenant_id).all()
        maint_cost = sum(m.cost for m in maint_logs)

        net_profit = revenue - maint_cost
        
        # Platform fee is 15% of gross revenue
        platform_fee = revenue * 0.15
        shareable_amount = revenue * 0.85

        # Share rate
        share_rate = car.shareholder_profit_share if car.shareholder_profit_share is not None else db_shareholder.share_percentage
        shareholder_car_earnings = max(0.0, shareable_amount) * (share_rate / 100.0)

        tot_revenue += revenue
        tot_maint += maint_cost
        tot_net_profit += net_profit
        tot_platform_fee += platform_fee
        tot_shareholder_earnings += shareholder_car_earnings

        car_performance_list.append(schemas.ShareholderCarPerformance(
            car_id=car.id,
            plate_number=car.plate_number,
            make_model=car.make_model,
            bookings_count=len(bookings),
            total_revenue_generated=revenue,
            total_maintenance_cost=maint_cost,
            net_profit=net_profit,
            platform_fee=platform_fee,
            shareholder_earnings=shareholder_car_earnings
        ))

    # Payouts received
    payouts = db.query(models.ShareholderPayout).filter(models.ShareholderPayout.shareholder_id == shareholder_id, models.ShareholderPayout.tenant_id == tenant_id).all()
    tot_payouts = sum(p.amount for p in payouts)
    effective_payout_type = getattr(db_shareholder, "payout_type", "percentage") or "percentage"
    effective_fixed_amount = float(getattr(db_shareholder, "fixed_amount", 0.0) or 0.0)
    if effective_payout_type == "fixed":
        tot_shareholder_earnings = effective_fixed_amount
    payout_balance_due = tot_shareholder_earnings - tot_payouts

    return schemas.ShareholderFinancialSummary(
        shareholder_id=db_shareholder.id,
        full_name=db_shareholder.full_name,
        phone=db_shareholder.phone,
        email=db_shareholder.email,
        cnic_number=db_shareholder.cnic_number,
        investment_amount=db_shareholder.investment_amount,
        payout_type=effective_payout_type,
        share_percentage=db_shareholder.share_percentage,
        fixed_amount=effective_fixed_amount,
        joined_date=db_shareholder.joined_date,
        notes=db_shareholder.notes,
        total_cars_owned=len(shareholder_cars),
        total_revenue_generated=tot_revenue,
        total_maintenance_cost=tot_maint,
        net_profit_generated=tot_net_profit,
        total_platform_fee=tot_platform_fee,
        total_shareholder_earnings=tot_shareholder_earnings,
        total_payouts_received=tot_payouts,
        payout_balance_due=payout_balance_due,
        cars=[schemas.Car.from_orm(c) for c in shareholder_cars],
        car_performance=car_performance_list,
        payouts=[schemas.ShareholderPayout.from_orm(p) for p in payouts]
    )


# --- Employees & Payments CRUD ---
def get_employees(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.Employee)
        .options(joinedload(models.Employee.payments))
        .filter(models.Employee.tenant_id == tenant_id)
        .order_by(models.Employee.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_employee(db: Session, employee_id: int, tenant_id: str):
    return (
        db.query(models.Employee)
        .options(joinedload(models.Employee.payments))
        .filter(models.Employee.id == employee_id, models.Employee.tenant_id == tenant_id)
        .first()
    )

def create_employee(db: Session, employee: schemas.EmployeeCreate, tenant_id: str):
    db_emp = models.Employee(**employee.dict(), tenant_id=tenant_id)
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp

def update_employee(db: Session, employee_id: int, employee_update: schemas.EmployeeUpdate, tenant_id: str):
    db_emp = get_employee(db, employee_id, tenant_id)
    if not db_emp:
        return None
    for key, value in employee_update.dict(exclude_unset=True).items():
        setattr(db_emp, key, value)
    db.commit()
    db.refresh(db_emp)
    return db_emp

def delete_employee(db: Session, employee_id: int, tenant_id: str):
    db_emp = get_employee(db, employee_id, tenant_id)
    if db_emp:
        db.delete(db_emp)
        db.commit()
    return db_emp

def create_employee_payment(db: Session, employee_id: int, payment: schemas.EmployeePaymentCreate, tenant_id: str):
    db_payment = models.EmployeePayment(**payment.dict(), employee_id=employee_id, tenant_id=tenant_id)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


# --- Leads CRM CRUD ---
def get_leads(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.Lead)
        .filter(models.Lead.tenant_id == tenant_id)
        .order_by(models.Lead.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_lead(db: Session, lead_id: int, tenant_id: str):
    return db.query(models.Lead).filter(models.Lead.id == lead_id, models.Lead.tenant_id == tenant_id).first()

def create_lead(db: Session, lead: schemas.LeadCreate, tenant_id: str):
    db_lead = models.Lead(**lead.dict(), tenant_id=tenant_id)
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead

def update_lead(db: Session, lead_id: int, lead_update: schemas.LeadUpdate, tenant_id: str):
    db_lead = get_lead(db, lead_id, tenant_id)
    if not db_lead:
        return None
    for key, value in lead_update.dict(exclude_unset=True).items():
        setattr(db_lead, key, value)
    db.commit()
    db.refresh(db_lead)
    return db_lead

def delete_lead(db: Session, lead_id: int, tenant_id: str):
    db_lead = get_lead(db, lead_id, tenant_id)
    if db_lead:
        db.delete(db_lead)
        db.commit()
    return db_lead


# --- Quotations CRUD ---
def get_quotations(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.Quotation)
        .filter(models.Quotation.tenant_id == tenant_id)
        .order_by(models.Quotation.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_quotation(db: Session, quotation_id: int, tenant_id: str):
    return db.query(models.Quotation).filter(models.Quotation.id == quotation_id, models.Quotation.tenant_id == tenant_id).first()

def create_quotation(db: Session, quotation: schemas.QuotationCreate, tenant_id: str):
    data = quotation.dict()
    if not data.get("quote_number"):
        count = db.query(models.Quotation).filter(models.Quotation.tenant_id == tenant_id).count()
        data["quote_number"] = f"QT-{1001 + count}"
    db_q = models.Quotation(**data, tenant_id=tenant_id)
    db.add(db_q)
    db.commit()
    db.refresh(db_q)
    return db_q

def update_quotation(db: Session, quotation_id: int, quotation_update: schemas.QuotationUpdate, tenant_id: str):
    db_q = get_quotation(db, quotation_id, tenant_id)
    if not db_q:
        return None
    for key, value in quotation_update.dict(exclude_unset=True).items():
        setattr(db_q, key, value)
    db.commit()
    db.refresh(db_q)
    return db_q

def delete_quotation(db: Session, quotation_id: int, tenant_id: str):
    db_q = get_quotation(db, quotation_id, tenant_id)
    if db_q:
        db.delete(db_q)
        db.commit()
    return db_q


# --- Receipts CRUD ---
def get_receipts(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.Receipt)
        .filter(models.Receipt.tenant_id == tenant_id)
        .order_by(models.Receipt.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_receipt(db: Session, receipt_id: int, tenant_id: str):
    return db.query(models.Receipt).filter(models.Receipt.id == receipt_id, models.Receipt.tenant_id == tenant_id).first()

def create_receipt(db: Session, receipt: schemas.ReceiptCreate, tenant_id: str):
    data = receipt.dict()
    if not data.get("receipt_number"):
        count = db.query(models.Receipt).filter(models.Receipt.tenant_id == tenant_id).count()
        data["receipt_number"] = f"RCP-{1001 + count}"
    db_r = models.Receipt(**data, tenant_id=tenant_id)
    db.add(db_r)
    db.commit()
    db.refresh(db_r)
    return db_r

def delete_receipt(db: Session, receipt_id: int, tenant_id: str):
    db_r = get_receipt(db, receipt_id, tenant_id)
    if db_r:
        db.delete(db_r)
        db.commit()
    return db_r


# --- Vehicles Invoices CRUD ---
def get_vehicle_invoices(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.VehicleInvoice)
        .filter(models.VehicleInvoice.tenant_id == tenant_id)
        .order_by(models.VehicleInvoice.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_vehicle_invoice(db: Session, invoice_id: int, tenant_id: str):
    return db.query(models.VehicleInvoice).filter(models.VehicleInvoice.id == invoice_id, models.VehicleInvoice.tenant_id == tenant_id).first()

def create_vehicle_invoice(db: Session, invoice: schemas.VehicleInvoiceCreate, tenant_id: str):
    data = invoice.dict()
    if not data.get("invoice_number"):
        count = db.query(models.VehicleInvoice).filter(models.VehicleInvoice.tenant_id == tenant_id).count()
        data["invoice_number"] = f"INV-{1001 + count}"
    db_inv = models.VehicleInvoice(**data, tenant_id=tenant_id)
    db.add(db_inv)
    db.commit()
    db.refresh(db_inv)
    return db_inv

def update_vehicle_invoice(db: Session, invoice_id: int, invoice_update: schemas.VehicleInvoiceUpdate, tenant_id: str):
    db_inv = get_vehicle_invoice(db, invoice_id, tenant_id)
    if not db_inv:
        return None
    for key, value in invoice_update.dict(exclude_unset=True).items():
        setattr(db_inv, key, value)
    db.commit()
    db.refresh(db_inv)
    return db_inv

def delete_vehicle_invoice(db: Session, invoice_id: int, tenant_id: str):
    db_inv = get_vehicle_invoice(db, invoice_id, tenant_id)
    if db_inv:
        db.delete(db_inv)
        db.commit()
    return db_inv


# --- Official Letters CRUD ---
def get_official_letters(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.OfficialLetter)
        .filter(models.OfficialLetter.tenant_id == tenant_id)
        .order_by(models.OfficialLetter.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_official_letter(db: Session, letter_id: int, tenant_id: str):
    return db.query(models.OfficialLetter).filter(models.OfficialLetter.id == letter_id, models.OfficialLetter.tenant_id == tenant_id).first()

def create_official_letter(db: Session, letter: schemas.OfficialLetterCreate, tenant_id: str):
    data = letter.dict()
    if not data.get("letter_number"):
        count = db.query(models.OfficialLetter).filter(models.OfficialLetter.tenant_id == tenant_id).count()
        data["letter_number"] = f"LTR-{1001 + count}"
    db_ltr = models.OfficialLetter(**data, tenant_id=tenant_id)
    db.add(db_ltr)
    db.commit()
    db.refresh(db_ltr)
    return db_ltr

def delete_official_letter(db: Session, letter_id: int, tenant_id: str):
    db_ltr = get_official_letter(db, letter_id, tenant_id)
    if db_ltr:
        db.delete(db_ltr)
        db.commit()
    return db_ltr


# --- Supplier Deals (Sublet / Sourcing) CRUD ---
def get_supplier_deals(db: Session, tenant_id: str, skip: int = 0, limit: int = 1000):
    return (
        db.query(models.SupplierDeal)
        .filter(models.SupplierDeal.tenant_id == tenant_id)
        .order_by(models.SupplierDeal.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_supplier_deal(db: Session, deal_id: int, tenant_id: str):
    return db.query(models.SupplierDeal).filter(models.SupplierDeal.id == deal_id, models.SupplierDeal.tenant_id == tenant_id).first()

def create_supplier_deal(db: Session, deal: schemas.SupplierDealCreate, tenant_id: str):
    data = deal.dict()
    # Ensure calculated fields are accurate
    client_rent = data.get("client_total_rent") or 0.0
    supp_cost = data.get("supplier_total_cost") or 0.0
    driver_exp = data.get("driver_expense") or 0.0
    fuel_exp = data.get("fuel_expense") or 0.0
    other_exp = data.get("other_expense") or 0.0
    tot_exp = driver_exp + fuel_exp + other_exp
    data["total_expenses"] = tot_exp
    data["commission_amount"] = round(client_rent - supp_cost, 2)
    data["net_cash_profit"] = round(data["commission_amount"] - tot_exp, 2)
    client_rec = data.get("client_received_amount") or 0.0
    data["client_remaining_balance"] = round(max(0.0, client_rent - client_rec), 2)
    supp_paid = data.get("supplier_paid_amount") or 0.0
    data["supplier_remaining_payable"] = round(max(0.0, supp_cost - supp_paid), 2)

    db_deal = models.SupplierDeal(**data, tenant_id=tenant_id)
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal

def update_supplier_deal(db: Session, deal_id: int, deal_update: schemas.SupplierDealUpdate, tenant_id: str):
    db_deal = get_supplier_deal(db, deal_id, tenant_id)
    if not db_deal:
        return None
    for k, v in deal_update.dict(exclude_unset=True).items():
        setattr(db_deal, k, v)
    
    # Recalculate
    client_rent = db_deal.client_total_rent or 0.0
    supp_cost = db_deal.supplier_total_cost or 0.0
    driver_exp = db_deal.driver_expense or 0.0
    fuel_exp = db_deal.fuel_expense or 0.0
    other_exp = db_deal.other_expense or 0.0
    tot_exp = driver_exp + fuel_exp + other_exp
    db_deal.total_expenses = tot_exp
    db_deal.commission_amount = round(client_rent - supp_cost, 2)
    db_deal.net_cash_profit = round(db_deal.commission_amount - tot_exp, 2)
    client_rec = db_deal.client_received_amount or 0.0
    db_deal.client_remaining_balance = round(max(0.0, client_rent - client_rec), 2)
    supp_paid = db_deal.supplier_paid_amount or 0.0
    db_deal.supplier_remaining_payable = round(max(0.0, supp_cost - supp_paid), 2)

    db.commit()
    db.refresh(db_deal)
    return db_deal

def delete_supplier_deal(db: Session, deal_id: int, tenant_id: str):
    db_deal = get_supplier_deal(db, deal_id, tenant_id)
    if db_deal:
        db.delete(db_deal)
        db.commit()
    return db_deal

