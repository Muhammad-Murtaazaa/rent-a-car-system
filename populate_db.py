import os
from datetime import datetime, date, timedelta
from backend.database import SessionLocal, engine, Base
from backend import models

# Recreate tables (drop and create for full clean schema sync)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # Clear existing data to ensure clean demo state
    db.query(models.InvestorPayout).delete()
    db.query(models.Investor).delete()
    db.query(models.Financial).delete()
    db.query(models.Booking).delete()
    db.query(models.MaintenanceLog).delete()
    db.query(models.Car).delete()
    db.query(models.Customer).delete()
    db.query(models.Blacklist).delete()
    db.commit()

    print("Cleared existing records. Populating Rent A Car Management System datasets with rich logs, bookings, and financials...")

    # 1. Populate Real Cars (15 vehicles)
    cars_data = [
        {"make_model": "Mercedes Maybach", "model_year": 2024, "color": "Black", "engine_cc": 6000, "current_odometer": 8100, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 7800, "image_url": "/images/Mercedes-Maybach.jpg", "plate_number": "LEK-24-0007"},
        {"make_model": "Toyota Land Cruiser V8", "model_year": 2023, "color": "Black", "engine_cc": 4600, "current_odometer": 18500, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 18000, "image_url": "/images/Landcruiser-V8.jpg", "plate_number": "LEM-23-4567"},
        {"make_model": "Range Rover", "model_year": 2023, "color": "Grey", "engine_cc": 3000, "current_odometer": 22400, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 22000, "image_url": "/images/Range-Rover-300x200.jpg", "plate_number": "LEO-23-8899"},
        {"make_model": "Toyota Prado", "model_year": 2023, "color": "White", "engine_cc": 2700, "current_odometer": 32100, "transmission_type": "Auto", "status": "Rented", "last_oil_change_odometer": 31000, "image_url": "/images/Toyota-Parado.jpg", "plate_number": "LED-23-1102"},
        {"make_model": "Premium Audi A6", "model_year": 2023, "color": "Black", "engine_cc": 2000, "current_odometer": 15100, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 14800, "image_url": "/images/Audi-A6.png", "plate_number": "LEJ-23-5561"},
        {"make_model": "Toyota Revo", "model_year": 2024, "color": "Bronze", "engine_cc": 2800, "current_odometer": 18200, "transmission_type": "Auto", "status": "Rented", "last_oil_change_odometer": 17500, "image_url": "/images/Toyota-Revo.jpg", "plate_number": "LEI-24-9021"},
        {"make_model": "Premium Audi A4", "model_year": 2023, "color": "Grey", "engine_cc": 1400, "current_odometer": 22100, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 21800, "image_url": "/images/Premium-Audi-A4.jpg", "plate_number": "LEG-23-4521"},
        {"make_model": "Toyota Corolla Altis", "model_year": 2023, "color": "Black", "engine_cc": 1600, "current_odometer": 27200, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 26500, "image_url": "/images/Toyota-Corolla-Altise.png", "plate_number": "LET-23-9092"},
        {"make_model": "Honda Civic", "model_year": 2024, "color": "Black", "engine_cc": 1500, "current_odometer": 12500, "transmission_type": "Auto", "status": "Rented", "last_oil_change_odometer": 12000, "image_url": "/images/Honda-Civic.jpg", "plate_number": "LEF-24-8891"},
        {"make_model": "Toyota Corolla GLi", "model_year": 2022, "color": "White", "engine_cc": 1300, "current_odometer": 48500, "transmission_type": "Auto", "status": "Rented", "last_oil_change_odometer": 44200, "image_url": "/images/Toyota-Corolla-GLI.jpg", "plate_number": "LEB-12-8923"},
        {"make_model": "Toyota Yaris", "model_year": 2023, "color": "Grey", "engine_cc": 1300, "current_odometer": 21000, "transmission_type": "Auto", "status": "Maintenance", "last_oil_change_odometer": 15000, "image_url": "/images/Toyota-Corolla-Yaris.jpg", "plate_number": "LEH-23-3891"},
        {"make_model": "Coaster 4C Saloon Bus", "model_year": 2022, "color": "White", "engine_cc": 4000, "current_odometer": 58200, "transmission_type": "Manual", "status": "Available", "last_oil_change_odometer": 54000, "image_url": "/images/Coaster-4C-Saloon-Bus.jpg", "plate_number": "LEY-22-1002"},
        {"make_model": "Honda City", "model_year": 2023, "color": "White", "engine_cc": 1500, "current_odometer": 25400, "transmission_type": "Auto", "status": "Reserved", "last_oil_change_odometer": 24000, "image_url": "/images/Honda-City.jpg", "plate_number": "LEH-23-1123"},
        {"make_model": "Suzuki Wagon R", "model_year": 2022, "color": "Silver", "engine_cc": 1000, "current_odometer": 48200, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 45000, "image_url": "/images/Suzuki-Wagon-R.jpg", "plate_number": "LEE-22-4412"},
        {"make_model": "Suzuki Cultus", "model_year": 2022, "color": "White", "engine_cc": 1000, "current_odometer": 52100, "transmission_type": "Auto", "status": "Available", "last_oil_change_odometer": 48000, "image_url": "/images/Suzuki-Cultus-1.png", "plate_number": "LEL-22-6712"}
    ]

    db_cars = []
    for item in cars_data:
        car = models.Car(
            plate_number=item["plate_number"],
            make_model=item["make_model"],
            model_year=item["model_year"],
            color=item["color"],
            engine_cc=item["engine_cc"],
            current_odometer=item["current_odometer"],
            transmission_type=item["transmission_type"],
            status=item["status"],
            last_oil_change_odometer=item["last_oil_change_odometer"],
            image_url=item["image_url"]
        )
        db_cars.append(car)
        db.add(car)
    
    db.commit()

    # 2. Populate Customers (12 customers)
    customers_data = [
        {"name": "Muhammad Ali", "phone": "03001234567", "sec": "03211234567", "address": "House 44, Block C-3, DHA Phase 5, Lahore", "cnic": "3520111223344", "license": "LHR-982123A"},
        {"name": "Zainab Bibi", "phone": "03219876543", "sec": None, "address": "Flat 12, Gulberg Heights, Gulberg III, Lahore", "cnic": "3520299887766", "license": "LHR-772391B"},
        {"name": "Usman Khan", "phone": "03334445555", "sec": None, "address": "Plot 102, Block G, Johar Town, Lahore", "cnic": "3520155554444", "license": "LHR-883294C"},
        {"name": "Ayesha Siddique", "phone": "03017778888", "sec": "03337778888", "address": "House 12, Block J, Model Town, Lahore", "cnic": "3520288887777", "license": "LHR-449102D"},
        {"name": "Hamza Bilal", "phone": "03225556666", "sec": None, "address": "Apartment 4B, Askari 11, Lahore Cantt", "cnic": "3520122223333", "license": "LHR-556123E"},
        {"name": "Fatima Noor", "phone": "03451239876", "sec": None, "address": "House 291, Block D, Valencia Town, Lahore", "cnic": "3520266665555", "license": "LHR-889021F"},
        {"name": "Bilal Ahmed", "phone": "03004443333", "sec": "03214443333", "address": "Plot 18, Phase 2, Bahria Town, Lahore", "cnic": "3520177778888", "license": "LHR-901234G"},
        {"name": "Sadia Batool", "phone": "03123456789", "sec": None, "address": "House 55, Block E, WAPDA Town, Lahore", "cnic": "3520244443333", "license": "LHR-112233H"},
        {"name": "Omer Tariq", "phone": "03248889999", "sec": None, "address": "Flat 80, Eden Heights, Jail Road, Lahore", "cnic": "3520199990000", "license": "LHR-445566I"},
        {"name": "Mariam Yasmin", "phone": "03361112222", "sec": None, "address": "House 7, Street 2, Cavalry Ground, Lahore", "cnic": "3520211110000", "license": "LHR-778899J"},
        {"name": "Zubair Hashmi", "phone": "03029998888", "sec": "03229998888", "address": "House 410, Block N, Samanabad, Lahore", "cnic": "3520133332222", "license": "LHR-123456K"},
        {"name": "Fiza Shah", "phone": "03215551111", "sec": None, "address": "House 9, Block DD, DHA Phase 4, Lahore", "cnic": "3520222221111", "license": "LHR-654321L"}
    ]

    db_customers = []
    for c in customers_data:
        cust = models.Customer(
            full_name=c["name"],
            phone_primary=c["phone"],
            phone_secondary=c["sec"],
            home_address=c["address"],
            cnic_number=c["cnic"],
            license_number=c["license"],
            cnic_front_path=None,
            cnic_back_path=None,
            license_front_path=None
        )
        db_customers.append(cust)
        db.add(cust)
    
    db.commit()

    # 3. Populate Blacklist (3 records)
    bl_data = [
        {"cnic": "3520199998888", "reason": "Absconded with rental vehicle, recovered via tracker in Gujranwala."},
        {"cnic": "3520277776666", "reason": "Structural chassis damage returned without reporting, payment defaults."},
        {"cnic": "3520155556666", "reason": "Involved in smuggling/criminal case with Toyota Corolla (Seized by excise authority)."}
    ]
    for bl in bl_data:
        b_entry = models.Blacklist(
            cnic_number=bl["cnic"],
            reason_flag=bl["reason"],
            logged_date=date.today() - timedelta(days=90)
        )
        db.add(b_entry)
    db.commit()

    # 4. Bookings, Financials, and Returns (15 Bookings)
    now = datetime.now()
    
    # Booking 1: Rented - Toyota Prado
    b1 = models.Booking(
        car_id=db_cars[3].id,
        customer_id=db_customers[1].id, # Zainab Bibi
        start_datetime=now - timedelta(days=2),
        expected_end_datetime=now + timedelta(days=3),
        daily_rate=25000.0,
        is_chauffeur_driven=True,
        chauffeur_daily_wage=2000.0,
        security_deposit_amount=50000.0,
        security_deposit_type="Cash",
        security_deposit_status="Held",
        status="Active"
    )

    # Booking 2: Rented - Toyota Revo
    b2 = models.Booking(
        car_id=db_cars[5].id,
        customer_id=db_customers[3].id, # Ayesha Siddique
        start_datetime=now - timedelta(days=4),
        expected_end_datetime=now + timedelta(days=2),
        daily_rate=18000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=30000.0,
        security_deposit_type="Cheque",
        security_deposit_status="Held",
        status="Active"
    )

    # Booking 3: Rented - Honda Civic
    b3 = models.Booking(
        car_id=db_cars[8].id,
        customer_id=db_customers[0].id, # Muhammad Ali
        start_datetime=now - timedelta(days=1),
        expected_end_datetime=now + timedelta(days=5),
        daily_rate=9000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=15000.0,
        security_deposit_type="Cash",
        security_deposit_status="Held",
        status="Active"
    )

    # Booking 4: Rented - Toyota Corolla GLi
    b4 = models.Booking(
        car_id=db_cars[9].id,
        customer_id=db_customers[4].id, # Hamza Bilal
        start_datetime=now - timedelta(days=3),
        expected_end_datetime=now + timedelta(days=1),
        daily_rate=7000.0,
        is_chauffeur_driven=True,
        chauffeur_daily_wage=1500.0,
        security_deposit_amount=10000.0,
        security_deposit_type="Cash",
        security_deposit_status="Held",
        status="Active"
    )

    # Booking 5: Reserved - Honda City
    b5 = models.Booking(
        car_id=db_cars[12].id,
        customer_id=db_customers[5].id, # Fatima Noor
        start_datetime=now + timedelta(days=2),
        expected_end_datetime=now + timedelta(days=6),
        daily_rate=6000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=10000.0,
        security_deposit_type="Cheque",
        security_deposit_status="Held",
        status="Reserved"
    )

    # Booking 6-12: Completed Bookings
    b6 = models.Booking(
        car_id=db_cars[0].id, # Maybach
        customer_id=db_customers[6].id,
        start_datetime=now - timedelta(days=15),
        expected_end_datetime=now - timedelta(days=10),
        actual_return_datetime=now - timedelta(days=10),
        daily_rate=150000.0,
        is_chauffeur_driven=True,
        chauffeur_daily_wage=5000.0,
        security_deposit_amount=200000.0,
        security_deposit_type="Cash",
        security_deposit_status="Refunded",
        status="Completed"
    )

    b7 = models.Booking(
        car_id=db_cars[1].id, # Land Cruiser
        customer_id=db_customers[7].id,
        start_datetime=now - timedelta(days=8),
        expected_end_datetime=now - timedelta(days=5),
        actual_return_datetime=now - timedelta(days=5),
        daily_rate=45000.0,
        is_chauffeur_driven=True,
        chauffeur_daily_wage=3000.0,
        security_deposit_amount=100000.0,
        security_deposit_type="Cash",
        security_deposit_status="Refunded",
        status="Completed"
    )

    b8 = models.Booking(
        car_id=db_cars[4].id, # Audi A6
        customer_id=db_customers[8].id,
        start_datetime=now - timedelta(days=12),
        expected_end_datetime=now - timedelta(days=9),
        actual_return_datetime=now - timedelta(days=9),
        daily_rate=35000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=50000.0,
        security_deposit_type="Cash",
        security_deposit_status="Refunded",
        status="Completed"
    )

    b9 = models.Booking(
        car_id=db_cars[13].id, # Wagon R
        customer_id=db_customers[9].id,
        start_datetime=now - timedelta(days=10),
        expected_end_datetime=now - timedelta(days=6),
        actual_return_datetime=now - timedelta(days=6),
        daily_rate=5000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=10000.0,
        security_deposit_type="Cash",
        security_deposit_status="Refunded",
        status="Completed"
    )

    b10 = models.Booking(
        car_id=db_cars[14].id, # Cultus
        customer_id=db_customers[10].id,
        start_datetime=now - timedelta(days=5),
        expected_end_datetime=now - timedelta(days=2),
        actual_return_datetime=now - timedelta(days=2),
        daily_rate=5000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=10000.0,
        security_deposit_type="Cash",
        security_deposit_status="Refunded",
        status="Completed"
    )

    # Booking 11: Cancelled
    b11 = models.Booking(
        car_id=db_cars[6].id, # Audi A4
        customer_id=db_customers[11].id,
        start_datetime=now - timedelta(days=1),
        expected_end_datetime=now + timedelta(days=2),
        daily_rate=30000.0,
        is_chauffeur_driven=False,
        security_deposit_amount=0.0,
        security_deposit_type="Cash",
        security_deposit_status="Refunded",
        status="Cancelled"
    )

    db.add_all([b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11])
    db.commit()

    # 5. Financial Transactions for Completed Bookings
    # b6: Maybach (5 days * 150000) + (5 days * 5000 wage) = 775000
    f1 = models.Financial(
        booking_id=b6.id,
        amount_paid=775000.0,
        payment_datetime=now - timedelta(days=10),
        payment_method="Bank Transfer",
        balance_due=0.0
    )

    # b7: Land Cruiser (3 days * 45000) + (3 days * 3000 wage) = 144000
    f2 = models.Financial(
        booking_id=b7.id,
        amount_paid=144000.0,
        payment_datetime=now - timedelta(days=5),
        payment_method="Bank Transfer",
        balance_due=0.0
    )

    # b8: Audi A6 (3 days * 35000) = 105000
    f3 = models.Financial(
        booking_id=b8.id,
        amount_paid=105000.0,
        payment_datetime=now - timedelta(days=9),
        payment_method="Cash",
        balance_due=0.0
    )

    # b9: Wagon R (4 days * 5000) = 20000
    f4 = models.Financial(
        booking_id=b9.id,
        amount_paid=20000.0,
        payment_datetime=now - timedelta(days=6),
        payment_method="EasyPaisa",
        balance_due=0.0
    )

    # b10: Cultus (3 days * 5000) = 15000
    f5 = models.Financial(
        booking_id=b10.id,
        amount_paid=15000.0,
        payment_datetime=now - timedelta(days=2),
        payment_method="Cash",
        balance_due=0.0
    )

    db.add_all([f1, f2, f3, f4, f5])
    db.commit()

    # 6. Maintenance Logs & Compliance Records (8 Logs)
    # Log 1: Wagon R Oil Change Executed
    m1 = models.MaintenanceLog(
        car_id=db_cars[13].id,
        log_type="Oil Change",
        cost=6500.0,
        execution_date=date.today() - timedelta(days=15),
        next_due_date_or_odometer="50000",
        notes="Shell Helix Ultra 5W-30 synthetic engine oil replaced with oil filter."
    )

    # Log 2: Yaris fitness certificate expired (Red Alert!)
    m2 = models.MaintenanceLog(
        car_id=db_cars[10].id,
        log_type="Vehicle Fitness",
        cost=4500.0,
        execution_date=date.today() - timedelta(days=200),
        next_due_date_or_odometer=(date.today() - timedelta(days=10)).strftime("%Y-%m-%d"),
        notes="Punjab Transport Authority fitness certificate renewal expired."
    )

    # Log 3: Prado Token Tax Due (Warning state)
    m3 = models.MaintenanceLog(
        car_id=db_cars[3].id,
        log_type="Token Tax",
        cost=25000.0,
        execution_date=date.today() - timedelta(days=340),
        next_due_date_or_odometer=(date.today() + timedelta(days=25)).strftime("%Y-%m-%d"),
        notes="Annual Lahore Excise & Taxation Token Tax payment due soon."
    )

    # Log 4: Audi A6 General Repair
    m4 = models.MaintenanceLog(
        car_id=db_cars[4].id,
        log_type="Repair",
        cost=12000.0,
        execution_date=date.today() - timedelta(days=40),
        next_due_date_or_odometer=None,
        notes="Rear brake pads replacement and wheel alignment."
    )

    # Log 5: Coaster Tuning
    m5 = models.MaintenanceLog(
        car_id=db_cars[11].id,
        log_type="Tuning",
        cost=18000.0,
        execution_date=date.today() - timedelta(days=80),
        next_due_date_or_odometer=None,
        notes="Diesel injector cleaning and diesel filter replacement."
    )

    # Log 6: Land Cruiser Oil Change Executed
    m6 = models.MaintenanceLog(
        car_id=db_cars[1].id,
        log_type="Oil Change",
        cost=18500.0,
        execution_date=date.today() - timedelta(days=30),
        next_due_date_or_odometer="23000",
        notes="Toyota Genuine Motor Oil 5W-40 replaced."
    )

    db.add_all([m1, m2, m3, m4, m5, m6])
    db.commit()

    # 7. Populate Investors & Payouts (3 Investors)
    inv1 = models.Investor(
        full_name="Malik Mansoor Ahmed",
        phone="0300-9876543",
        email="mansoor.malik@gmail.com",
        cnic_number="35201-1234567-9",
        investment_amount=25000000.0, # 2.5 Crore investment
        profit_share_percentage=70.0,
        joined_date=date.today() - timedelta(days=180),
        notes="Owner of Land Cruiser V8 and Range Rover."
    )

    inv2 = models.Investor(
        full_name="Sheikh Farooq Investment Group",
        phone="0321-4433221",
        email="info@sheikhinvestments.pk",
        cnic_number="35202-9876543-1",
        investment_amount=15000000.0, # 1.5 Crore investment
        profit_share_percentage=75.0,
        joined_date=date.today() - timedelta(days=120),
        notes="Owner of Audi A6 and Prado."
    )

    inv3 = models.Investor(
        full_name="Chaudhry Waqas & Sons",
        phone="0333-7766554",
        email="waqas.chaudhry@outlook.com",
        cnic_number="35201-5544332-5",
        investment_amount=8000000.0,
        profit_share_percentage=65.0,
        joined_date=date.today() - timedelta(days=90),
        notes="Owner of Toyota Revo and Honda Civic."
    )

    db.add_all([inv1, inv2, inv3])
    db.commit()

    # Associate Cars to Investors
    db_cars[1].investor_id = inv1.id # Land Cruiser
    db_cars[1].investor_profit_share = 70.0
    db_cars[2].investor_id = inv1.id # Range Rover
    db_cars[2].investor_profit_share = 70.0

    db_cars[3].investor_id = inv2.id # Prado
    db_cars[3].investor_profit_share = 75.0
    db_cars[4].investor_id = inv2.id # Audi A6
    db_cars[4].investor_profit_share = 75.0

    db_cars[5].investor_id = inv3.id # Revo
    db_cars[5].investor_profit_share = 65.0
    db_cars[8].investor_id = inv3.id # Civic
    db_cars[8].investor_profit_share = 65.0

    db.commit()

    # Seed Sample Payouts
    p1 = models.InvestorPayout(
        investor_id=inv1.id,
        amount=150000.0,
        payout_date=date.today() - timedelta(days=30),
        payment_method="Bank Transfer",
        notes="Monthly profit disbursement for Land Cruiser & Range Rover."
    )

    p2 = models.InvestorPayout(
        investor_id=inv2.id,
        amount=100000.0,
        payout_date=date.today() - timedelta(days=20),
        payment_method="Cheque",
        notes="Interim profit payout for Audi A6 & Prado."
    )

    db.add_all([p1, p2])
    db.commit()

    print("Rent A Car Management System rich database seeding completed successfully!")

finally:
    db.close()
