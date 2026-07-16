import sys
import os

# Adjust path to find backend
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.database.connection import SessionLocal
from backend.database.models import Patient, Visit, PrescriptionItem, MedicalReport, Appointment, User, Doctor, Department

db = SessionLocal()
try:
    print("--- Database Verification Report ---")
    depts = db.query(Department).all()
    print(f"Total Departments: {len(depts)}")
    for d in depts:
        print(f" - Dept: {d.name}, Code: {d.code}")

    docs = db.query(Doctor).all()
    print(f"Total Doctors: {len(docs)}")
    for d in docs:
        print(f" - Doctor ID: {d.id}, Name: {d.name}, UserID: {d.user_id}")

    patients = db.query(Patient).all()
    print(f"Total Patients: {len(patients)}")
    for p in patients:
        print(f" - Patient ID: {p.id}, Name: {p.name}, Email: {p.email}, Blood: {p.blood_group}, Allergies: {p.allergies}")

    visits = db.query(Visit).all()
    print(f"Total Visits: {len(visits)}")
    for v in visits:
        print(f" - Visit ID: {v.id}, Patient ID: {v.patient_id}, Dept: {v.department}, Diagnosis: {v.diagnosis}")

    prescriptions = db.query(PrescriptionItem).all()
    print(f"Total Prescriptions: {len(prescriptions)}")
    for pr in prescriptions:
        print(f" - Rx ID: {pr.id}, Visit ID: {pr.visit_id}, Medicine: {pr.medicine_name}, Dose: {pr.dosage}")

    reports = db.query(MedicalReport).all()
    print(f"Total Lab Reports: {len(reports)}")
    for r in reports:
        print(f" - Report ID: {r.id}, Patient ID: {r.patient_id}, Name: {r.report_name}, Path: {r.file_path}")

    appointments = db.query(Appointment).all()
    print(f"Total Appointments: {len(appointments)}")
    for a in appointments:
        print(f" - Appointment ID: {a.id}, Patient ID: {a.patient_id}, Time: {a.appointment_time}, Status: {a.status}")

finally:
    db.close()
