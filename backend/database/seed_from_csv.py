import os
import datetime
import pandas as pd
import random
from sqlalchemy.orm import Session
from backend.database.models import (
    Department, User, Doctor, Patient, Visit, PrescriptionItem, MedicalReport, Notification, Appointment
)
from backend.services.auth_service import get_password_hash

def seed_db_from_csv(db: Session, csv_path: str):
    print("Checking if seeding is required...")
    # Check if departments are already seeded
    if db.query(Department).count() > 0:
        print("Database already has data. Skipping CSV seeding.")
        return

    print(f"Starting database seeding from {csv_path}...")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Seeding dataset not found at {csv_path}")

    # Load first 250 rows to get at least 200 unique patient entries
    df = pd.read_csv(csv_path)
    # De-duplicate by patient Name to keep unique patient profiles
    df_unique = df.drop_duplicates(subset=["Name"]).head(200)

    # 1. Seed Departments
    departments_data = [
        {"name": "General Medicine", "code": "G"},
        {"name": "Cardiology", "code": "C"},
        {"name": "Orthopedics", "code": "O"},
        {"name": "Oncology", "code": "ON"}
    ]
    seeded_depts = {}
    for dept in departments_data:
        new_dept = Department(name=dept["name"], code=dept["code"])
        db.add(new_dept)
        db.commit()
        db.refresh(new_dept)
        seeded_depts[dept["name"]] = new_dept.id
        print(f"Seeded department: {dept['name']}")

    # 2. Seed Default Admin & Receptionist (pre-compute hashes)
    admin_hash = get_password_hash("admin123")
    recep_hash = get_password_hash("recep123")
    doctor_hash = get_password_hash("doctor123")
    patient_hash = get_password_hash("patient123")

    admin = User(username="admin", hashed_password=admin_hash, role="Admin")
    recep = User(username="receptionist", hashed_password=recep_hash, role="Receptionist")
    db.add(admin)
    db.add(recep)
    db.commit()
    print("Seeded default admin and receptionist accounts.")

    # 3. Seed Pool of 12 Doctors
    doctors_data = [
        # General Medicine
        {"username": "drhouse", "name": "Dr. Gregory House", "specialization": "Diagnostic Medicine", "room": "101", "dept": "General Medicine"},
        {"username": "drgrey", "name": "Dr. Meredith Grey", "specialization": "General Surgery", "room": "102", "dept": "General Medicine"},
        {"username": "drwatson", "name": "Dr. John Watson", "specialization": "Family Medicine", "room": "103", "dept": "General Medicine"},
        # Cardiology
        {"username": "drstrange", "name": "Dr. Stephen Strange", "specialization": "Cardiology", "room": "201", "dept": "Cardiology"},
        {"username": "dryang", "name": "Dr. Cristina Yang", "specialization": "Cardiothoracic Surgery", "room": "202", "dept": "Cardiology"},
        {"username": "drchase", "name": "Dr. Robert Chase", "specialization": "Clinical Cardiology", "room": "203", "dept": "Cardiology"},
        # Orthopedics
        {"username": "drbones", "name": "Dr. Leonard McCoy", "specialization": "Orthopedics", "room": "301", "dept": "Orthopedics"},
        {"username": "drtorres", "name": "Dr. Callie Torres", "specialization": "Orthopedic Surgery", "room": "302", "dept": "Orthopedics"},
        {"username": "drbrennan", "name": "Dr. Temperance Brennan", "specialization": "Forensic Orthopedics", "room": "303", "dept": "Orthopedics"},
        # Oncology
        {"username": "drcameron", "name": "Dr. Allison Cameron", "specialization": "Oncology", "room": "401", "dept": "Oncology"},
        {"username": "drwilson", "name": "Dr. James Wilson", "specialization": "Clinical Oncology", "room": "402", "dept": "Oncology"},
        {"username": "drrobbins", "name": "Dr. Arizona Robbins", "specialization": "Pediatric Oncology", "room": "403", "dept": "Oncology"}
    ]

    dept_doctors = {dept_name: [] for dept_name in seeded_depts.keys()}
    for d_info in doctors_data:
        doc_user = User(username=d_info["username"], hashed_password=doctor_hash, role="Doctor")
        db.add(doc_user)
        db.commit()
        db.refresh(doc_user)

        doctor = Doctor(
            user_id=doc_user.id,
            department_id=seeded_depts[d_info["dept"]],
            name=d_info["name"],
            specialization=d_info["specialization"],
            room_number=d_info["room"],
            is_available=True
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)
        dept_doctors[d_info["dept"]].append(doctor)
        print(f"Seeded doctor: {doctor.name}")

    # Condition to Department mappings
    condition_dept_map = {
        "Asthma": "General Medicine",
        "Hypertension": "General Medicine",
        "Diabetes": "Cardiology",
        "Cancer": "Oncology",
        "Arthritis": "Orthopedics",
        "Obesity": "Orthopedics"
    }

    # Medicine dosages lookup
    medicine_dosages = {
        "Aspirin": "100mg",
        "Penicillin": "500mg",
        "Ibuprofen": "400mg",
        "Paracetamol": "500mg",
        "Lipitor": "20mg"
    }

    # 4. Seed Patients & Visit Records from CSV
    print(f"Processing {len(df_unique)} patients from CSV...")
    count = 0
    for idx, row in df_unique.iterrows():
        raw_name = str(row["Name"])
        title_name = raw_name.title()
        
        # Make a clean alphanumeric username (e.g. bobbyjackson)
        username = "".join([c.lower() for c in title_name if c.isalnum()])
        if not username:
            username = f"patient_{idx}"
            
        # Ensure username uniqueness in database
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            username = f"{username}_{idx}"

        # Create Patient User
        p_user = User(username=username, hashed_password=patient_hash, role="Patient")
        db.add(p_user)
        db.commit()
        db.refresh(p_user)

        # Create Patient Profile
        mobile = f"+1-555-{random.randint(100,999):03d}-{random.randint(1000,9999):04d}"
        contact_name = f"{random.choice(['John', 'Jane', 'Robert', 'Mary', 'William', 'Linda'])} {title_name.split()[-1]}"
        patient = Patient(
            user_id=p_user.id,
            name=title_name,
            email=f"{username}@hospital.com",
            age=int(row["Age"]),
            gender=str(row["Gender"]),
            blood_group=str(row["Blood Type"]),
            allergies="None",
            profile_photo=f"https://images.unsplash.com/photo-{random.choice(['1544005313-94ddf0286df2','1506794778202-cad84cf45f1d','1534528741775-53994a69daeb','1507003211169-0a1dd7228f2d'])}?auto=format&fit=crop&q=80&w=200",
            emergency_contact=f"{contact_name} ({mobile})",
            mobile_number=mobile
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

        # 5. Map Patient Consultation Visit
        medical_condition = str(row["Medical Condition"])
        dept_name = condition_dept_map.get(medical_condition, "General Medicine")
        assigned_doctor = random.choice(dept_doctors[dept_name])

        admission_date = pd.to_datetime(row["Date of Admission"])
        discharge_date = pd.to_datetime(row["Discharge Date"])
        stay_days = (discharge_date - admission_date).days

        visit = Visit(
            patient_id=patient.id,
            doctor_id=assigned_doctor.id,
            department=dept_name,
            visit_date=admission_date,
            diagnosis=medical_condition,
            chief_complaint=f"Admitted via {row['Admission Type']} with clinical indicators for {medical_condition}.",
            doctor_notes=f"Patient admitted on {admission_date.strftime('%Y-%m-%d')} for {medical_condition}. Discharge date: {discharge_date.strftime('%Y-%m-%d')}. Length of stay: {stay_days} days. Billing Amount: ${row['Billing Amount']:,.2f}.",
            follow_up_date=discharge_date
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)

        # 6. Seed Prescription Items
        medication = str(row["Medication"])
        dosage = medicine_dosages.get(medication, "500mg")
        prescription = PrescriptionItem(
            visit_id=visit.id,
            medicine_name=medication,
            dosage=dosage,
            frequency="Twice daily" if medication in ["Ibuprofen", "Paracetamol"] else "Once daily",
            duration=f"{stay_days} days" if stay_days > 0 else "5 days",
            instructions="Take after meals."
        )
        db.add(prescription)

        # 7. Seed Medical Reports
        test_results = str(row["Test Results"])
        report = MedicalReport(
            visit_id=visit.id,
            patient_id=patient.id,
            report_name=f"Urgent Diagnostic Panel ({test_results})",
            report_type="Blood/Lab Panel",
            file_path=f"/reports/lab_{patient.id}.pdf",
            upload_date=admission_date + datetime.timedelta(days=min(1, stay_days))
        )
        db.add(report)

        # 8. Seed a Notification for the Patient
        notification = Notification(
            patient_id=patient.id,
            title="Medical Records Updated",
            type="TokenGenerated",
            message=f"Welcome to the portal, {patient.name}! Your medical records from your stay for {medical_condition} (Admitted: {admission_date.strftime('%Y-%m-%d')}) have been loaded.",
            channel="Email",
            status="Sent",
            created_at=datetime.datetime.utcnow()
        )
        db.add(notification)
        db.commit()

        count += 1
        if count % 50 == 0:
            print(f"Seeded {count} patients...")

    # Seed one upcoming appointment for the first patient to ensure appointment features work
    first_patient = db.query(Patient).first()
    first_doctor = db.query(Doctor).first()
    if first_patient and first_doctor:
        appt = Appointment(
            patient_id=first_patient.id,
            doctor_id=first_doctor.id,
            appointment_type="Scheduled",
            appointment_time=datetime.datetime.utcnow() + datetime.timedelta(days=1, hours=2),
            status="Scheduled"
        )
        db.add(appt)
        db.commit()
        print("[SUCCESS] Seeded dummy upcoming appointment for first patient.")

    print(f"Database seeding completed successfully! Total {count} patients imported.")
