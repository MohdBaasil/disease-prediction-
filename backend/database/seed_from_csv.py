import os
import datetime
import pandas as pd
import random
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.database.models import (
    Department, User, Doctor, Patient, Appointment, Queue, Visit, PrescriptionItem, MedicalReport, Notification
)
from backend.services.auth_service import get_password_hash

def load_csv_safe(filename: str, datasets_dir: str) -> pd.DataFrame:
    path = os.path.join(datasets_dir, filename)
    print(f"Loading {filename} from {path}...", flush=True)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Required CSV file '{filename}' was not found at expected path: {path}")
    try:
        df = pd.read_csv(path)
        print(f"Loaded successfully: {filename} ({len(df)} rows)", flush=True)
        return df
    except Exception as e:
        print(f"ERROR reading {filename}: {e}", flush=True)
        raise e

def seed_db_from_csv(db: Session, base_csv_path: str):
    # Resolve portable relative path to the datasets/ folder
    datasets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "datasets"))
    
    # Enable SQLite speed PRAGMAs for fast bulk writes
    is_sqlite = db.bind.dialect.name == "sqlite"
    if is_sqlite:
        print("Enabling SQLite performance PRAGMAs (synchronous=OFF, journal_mode=MEMORY)...", flush=True)
        try:
            db.execute(text("PRAGMA synchronous = OFF"))
            db.execute(text("PRAGMA journal_mode = MEMORY"))
        except Exception as e:
            print(f"WARNING: Could not apply SQLite PRAGMAs: {e}", flush=True)
    
    print(f"Checking if database seeding is required. Datasets directory: {datasets_dir}", flush=True)
    try:
        dept_count = db.query(Department).count()
        print(f"Current Department count in database: {dept_count}", flush=True)
        if dept_count > 0:
            print("Database already has data. Skipping CSV seeding.", flush=True)
            return
    except Exception as e:
        print(f"ERROR checking existing database records: {e}", flush=True)
        raise e

    print("Starting optimized database seeding from improved datasets...", flush=True)
    
    # Pre-compute hashes to avoid slow bcrypt hashing in loop
    print("Pre-computing default passwords hashes...", flush=True)
    admin_hash = get_password_hash("admin123")
    recep_hash = get_password_hash("recep123")
    doctor_hash = get_password_hash("doctor123")
    patient_hash = get_password_hash("patient123")
    print("Password hashes pre-computed.", flush=True)

    # 1. Seed Default Admin & Receptionist (IDs 1, 2)
    print("Starting Default Admin & Receptionist seeding...", flush=True)
    try:
        admin = User(username="admin", hashed_password=admin_hash, role="Admin")
        recep = User(username="receptionist", hashed_password=recep_hash, role="Receptionist")
        db.add(admin)
        db.add(recep)
        db.commit()
        print("Default Admin & Receptionist seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Admin/Receptionist: {e}", flush=True)
        db.rollback()
        raise e

    # 2. Seed Departments
    print("Starting Departments seeding...", flush=True)
    try:
        depts_df = load_csv_safe("03_departments.csv", datasets_dir)
        dept_csv_to_db_id = {}
        
        dept_records = []
        for idx, row in depts_df.iterrows():
            name = row["Department_Name"]
            code = "".join([w[0] for w in name.replace("/", " ").replace("&", " ").split() if w])[:3].upper()
            if len(code) == 1:
                code = name[:2].upper()
            
            existing_codes = [d["code"] for d in dept_records]
            if code in existing_codes:
                code = f"{code}{random.randint(1,9)}"
                
            dept_records.append({
                "name": name,
                "code": code
            })
            dept_csv_to_db_id[row["Department_ID"]] = idx + 1
            
        db.bulk_insert_mappings(Department, dept_records)
        db.commit()
        print("Departments seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Departments: {e}", flush=True)
        db.rollback()
        raise e

    # 3. Seed Doctors
    print("Starting Doctors seeding...", flush=True)
    try:
        docs_df = load_csv_safe("02_doctors.csv", datasets_dir)
        
        doc_user_mappings = []
        for idx, row in docs_df.iterrows():
            username = f"doctor_{idx+1}"
            doc_user_mappings.append({
                "username": username,
                "hashed_password": doctor_hash,
                "role": "Doctor"
            })
            
        db.bulk_insert_mappings(User, doc_user_mappings)
        db.commit()
        
        doctor_profiles = []
        dept_name_to_id = {row["Department_Name"]: dept_csv_to_db_id[row["Department_ID"]] for _, row in depts_df.iterrows()}
        
        doc_csv_to_db_id = {}
        for idx, row in docs_df.iterrows():
            dept_name = row["Department"]
            dept_id = dept_name_to_id.get(dept_name, 1)
            
            doctor_profiles.append({
                "user_id": idx + 3,
                "department_id": dept_id,
                "name": row["Doctor_Name"],
                "specialization": row["Specialization"],
                "room_number": str(random.randint(101, 509)),
                "is_available": True
            })
            doc_csv_to_db_id[row["Doctor_ID"]] = idx + 1
            
        db.bulk_insert_mappings(Doctor, doctor_profiles)
        db.commit()
        print("Doctors seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Doctors: {e}", flush=True)
        db.rollback()
        raise e

    # 4. Seed Patients
    print("Starting Patients seeding...", flush=True)
    try:
        patients_df = load_csv_safe("01_patients.csv", datasets_dir)
        
        patient_user_mappings = []
        for idx, row in patients_df.iterrows():
            username = f"patient_{idx+1}"
            patient_user_mappings.append({
                "username": username,
                "hashed_password": patient_hash,
                "role": "Patient"
            })
            
        db.bulk_insert_mappings(User, patient_user_mappings)
        db.commit()
        
        patient_profiles = []
        patient_csv_to_db_id = {}
        for idx, row in patients_df.iterrows():
            patient_profiles.append({
                "user_id": idx + 1003,
                "name": f"{row['First_Name']} {row['Last_Name']}",
                "email": row["Email"],
                "age": int(row["Age"]),
                "gender": row["Gender"],
                "blood_group": row["Blood_Group"],
                "allergies": "None",
                "profile_photo": f"https://images.unsplash.com/photo-{random.choice(['1544005313-94ddf0286df2','1506794778202-cad84cf45f1d','1534528741775-53994a69daeb','1507003211169-0a1dd7228f2d'])}?auto=format&fit=crop&q=80&w=200",
                "emergency_contact": row["Emergency_Contact"],
                "mobile_number": row["Phone"]
            })
            patient_csv_to_db_id[row["Patient_ID"]] = idx + 1
            
        db.bulk_insert_mappings(Patient, patient_profiles)
        db.commit()
        print("Patients seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Patients: {e}", flush=True)
        db.rollback()
        raise e

    # 5. Seed Appointments
    print("Starting Appointments seeding...", flush=True)
    try:
        appts_df = load_csv_safe("14_appointments.csv", datasets_dir)
        
        # Vectorized parsing of Date + Time strings to Datetime objects
        print("Parsing appointment datetimes...", flush=True)
        appts_df["parsed_time"] = pd.to_datetime(appts_df["Date"] + " " + appts_df["Time"])
        print("Appointment datetimes parsed successfully.", flush=True)
        
        appt_mappings = []
        for idx, row in appts_df.iterrows():
            p_id = patient_csv_to_db_id.get(row["Patient_ID"])
            d_id = doc_csv_to_db_id.get(row["Doctor_ID"])
            
            if p_id and d_id:
                appt_mappings.append({
                    "patient_id": p_id,
                    "doctor_id": d_id,
                    "appointment_type": "Scheduled",
                    "appointment_time": row["parsed_time"].to_pydatetime(),
                    "status": row["Status"]
                })
                
        db.bulk_insert_mappings(Appointment, appt_mappings)
        db.commit()
        print("Appointments seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Appointments: {e}", flush=True)
        db.rollback()
        raise e

    # 6. Seed Queue Entries
    print("Starting Queue seeding...", flush=True)
    try:
        queue_df = load_csv_safe("15_queue.csv", datasets_dir)
        doctor_dept_ids = {idx + 1: d_profiles["department_id"] for idx, d_profiles in enumerate(doctor_profiles)}
        
        queue_mappings = []
        for idx, row in queue_df.iterrows():
            p_id = patient_csv_to_db_id.get(row["Patient_ID"])
            d_id = doc_csv_to_db_id.get(row["Doctor_ID"])
            dept_id = doctor_dept_ids.get(d_id, 1)
            
            if p_id:
                queue_mappings.append({
                    "token_number": row["Token_Number"],
                    "department_id": dept_id,
                    "doctor_id": d_id,
                    "patient_id": p_id,
                    "priority_level": 3,
                    "status": row["Status"],
                    "checked_in_time": datetime.datetime.utcnow() - datetime.timedelta(minutes=random.randint(10, 120)),
                    "estimated_wait_time": float(str(row["Estimated_Wait_Time"]).lower().replace(" min", "").replace("s", "").strip()),
                    "position": int(row["Queue_Position"])
                })
                
        db.bulk_insert_mappings(Queue, queue_mappings)
        db.commit()
        print("Queue seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Queue: {e}", flush=True)
        db.rollback()
        raise e

    # 7. Seed Prescriptions (Visits & PrescriptionItems)
    print("Starting Prescriptions & Visits seeding...", flush=True)
    try:
        presc_df = load_csv_safe("16_prescriptions.csv", datasets_dir)
        presc_df_subset = presc_df.head(5000)
        
        doctor_dept_names = {}
        dept_id_to_name = {idx + 1: row["Department_Name"] for idx, row in depts_df.iterrows()}
        for idx, d_prof in enumerate(doctor_profiles):
            dept_id = d_prof["department_id"]
            doctor_dept_names[idx + 1] = dept_id_to_name.get(dept_id, "General Medicine")
            
        visit_id = 1
        visit_mappings = []
        prescription_mappings = []
        
        for idx, row in presc_df_subset.iterrows():
            p_id = patient_csv_to_db_id.get(row["Patient_ID"])
            d_id = doc_csv_to_db_id.get(row["Doctor_ID"])
            
            if p_id and d_id:
                dept_name = doctor_dept_names.get(d_id, "General Medicine")
                
                visit_mappings.append({
                    "patient_id": p_id,
                    "doctor_id": d_id,
                    "department": dept_name,
                    "visit_date": datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(1, 30)),
                    "diagnosis": row["Disease"],
                    "chief_complaint": f"Patient presents with indicators for {row['Disease']}.",
                    "doctor_notes": row["Instructions"]
                })
                
                prescription_mappings.append({
                    "visit_id": visit_id,
                    "medicine_name": row["Medicine"],
                    "dosage": row["Dosage"],
                    "frequency": "Once daily",
                    "duration": row["Duration"],
                    "instructions": row["Instructions"]
                })
                visit_id += 1
                
        db.bulk_insert_mappings(Visit, visit_mappings)
        db.commit()
        
        db.bulk_insert_mappings(PrescriptionItem, prescription_mappings)
        db.commit()
        print("Prescriptions & Visits seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Prescriptions/Visits: {e}", flush=True)
        db.rollback()
        raise e

    # 8. Seed Lab Reports
    print("Starting Lab Reports seeding...", flush=True)
    try:
        labs_df = load_csv_safe("17_lab_reports.csv", datasets_dir)
        labs_df_subset = labs_df.head(5000)
        
        lab_mappings = []
        for idx, row in labs_df_subset.iterrows():
            p_id = patient_csv_to_db_id.get(row["Patient_ID"])
            if p_id:
                lab_mappings.append({
                    "patient_id": p_id,
                    "report_name": row["Test_Name"],
                    "report_type": "Lab Report",
                    "file_path": f"/reports/lab_{row['Report_ID']}.pdf"
                })
                
        db.bulk_insert_mappings(MedicalReport, lab_mappings)
        db.commit()
        print("Lab Reports seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Lab Reports: {e}", flush=True)
        db.rollback()
        raise e

    # 9. Seed Notifications
    print("Starting Notifications seeding...", flush=True)
    try:
        notifs_df = load_csv_safe("18_notifications.csv", datasets_dir)
        
        notif_mappings = []
        for idx, row in notifs_df.iterrows():
            p_id = patient_csv_to_db_id.get(row["Patient_ID"])
            if p_id:
                notif_mappings.append({
                    "patient_id": p_id,
                    "title": row["Title"],
                    "type": row["Type"],
                    "message": row["Message"],
                    "channel": "Email",
                    "status": row["Status"]
                })
                
        db.bulk_insert_mappings(Notification, notif_mappings)
        db.commit()
        print("Notifications seeding complete.", flush=True)
    except Exception as e:
        print(f"ERROR seeding Notifications: {e}", flush=True)
        db.rollback()
        raise e

    print("[SUCCESS] Database seeded successfully from improved datasets!", flush=True)
