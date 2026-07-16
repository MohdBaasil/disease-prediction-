from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
from typing import Optional

from backend.database.connection import get_db
from backend.database.models import User, Queue, Doctor, Consultation, Patient
from backend.services.auth_service import RoleChecker

router = APIRouter(prefix="/api/dashboard", tags=["Dashboards"])

@router.get("/receptionist")
def get_receptionist_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist"]))
):
    today = datetime.datetime.utcnow().date()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    
    # 1. Total waiting patients today
    waiting_count = db.query(func.count(Queue.id)).filter(
        Queue.status == "Waiting"
    ).scalar() or 0

    # 2. Emergency patients currently waiting
    emergency_waiting = db.query(func.count(Queue.id)).filter(
        Queue.status == "Waiting",
        Queue.priority_level.in_([1, 2])
    ).scalar() or 0

    # 3. Active/available doctors
    available_docs = db.query(func.count(Doctor.id)).filter(
        Doctor.is_available == True
    ).scalar() or 0

    # 4. Average wait time today (completed queues)
    avg_wait = db.query(func.avg(Queue.call_time - Queue.checked_in_time)).filter(
        Queue.status == "Completed",
        Queue.checked_in_time >= start_of_today
    ).scalar()

    avg_wait_mins = 0.0
    if avg_wait:
        if isinstance(avg_wait, datetime.timedelta):
            avg_wait_mins = avg_wait.total_seconds() / 60.0
        else:
            try:
                avg_wait_mins = float(avg_wait) * 24.0 * 60.0  # SQLite calculation
            except:
                avg_wait_mins = 15.0

    return {
        "waiting_patients": waiting_count,
        "emergency_waiting": emergency_waiting,
        "available_doctors": available_docs,
        "average_wait_time_minutes": round(avg_wait_mins, 1)
    }

@router.get("/doctor/{doctor_id}")
def get_doctor_dashboard(
    doctor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Doctor"]))
):
    # Verify doctor
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    if current_user.role == "Doctor" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized doctor access")

    today = datetime.datetime.utcnow().date()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)

    # 1. Current patient details (Calling status)
    current_patient_queue = db.query(Queue).filter(
        Queue.doctor_id == doctor_id,
        Queue.status == "Calling"
    ).first()
    
    current_patient = None
    if current_patient_queue:
        current_patient = {
            "queue_id": current_patient_queue.id,
            "token_number": current_patient_queue.token_number,
            "patient_id": current_patient_queue.patient_id,
            "name": current_patient_queue.patient.name,
            "age": current_patient_queue.patient.age,
            "gender": current_patient_queue.patient.gender,
            "priority_level": current_patient_queue.priority_level,
            "call_time": current_patient_queue.call_time
        }

    # 2. Upcoming patients in this doctor's department (Waiting status)
    upcoming_queue = db.query(Queue).filter(
        Queue.department_id == doc.department_id,
        Queue.status == "Waiting"
    ).order_by(Queue.position.asc()).all()
    
    upcoming = [{
        "queue_id": item.id,
        "token_number": item.token_number,
        "patient_id": item.patient_id,
        "name": item.patient.name,
        "priority_level": item.priority_level,
        "position": item.position,
        "estimated_wait_time": item.estimated_wait_time
    } for item in upcoming_queue]

    # 3. Completed consultations today
    completed_count = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_of_today
    ).scalar() or 0

    # 4. Average consultation duration for this doctor today
    avg_duration = db.query(func.avg(Consultation.duration_minutes)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_of_today
    ).scalar() or 0.0

    return {
        "doctor_name": doc.name,
        "room_number": doc.room_number,
        "is_available": doc.is_available,
        "current_patient": current_patient,
        "upcoming_patients": upcoming,
        "completed_today": completed_count,
        "average_consultation_time_minutes": round(float(avg_duration), 1)
    }

@router.get("/patient/{patient_id}")
def get_patient_dashboard(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    if current_user.role == "Patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized patient access")

    # 1. Active queues (Waiting or Calling or Skipped)
    active_queues = db.query(Queue).filter(
        Queue.patient_id == patient_id,
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).all()
    
    my_tokens = []
    for q in active_queues:
        # Determine how many patients are waiting ahead of this patient
        ahead_count = db.query(func.count(Queue.id)).filter(
            Queue.department_id == q.department_id,
            Queue.status == "Waiting",
            Queue.position < q.position
        ).scalar() if q.position else 0

        my_tokens.append({
            "queue_id": q.id,
            "token_number": q.token_number,
            "department_name": q.department.name,
            "department_id": q.department_id,
            "doctor_name": q.doctor.name if q.doctor else "Any Doctor",
            "doctor_id": q.doctor_id,
            "room_number": q.doctor.room_number if q.doctor else "TBD",
            "status": q.status,
            "position": q.position,
            "patients_ahead": ahead_count,
            "estimated_wait_time": q.estimated_wait_time,
            "checked_in_time": q.checked_in_time
        })

    # 2. Consultation history
    history = db.query(Consultation).filter(
        Consultation.patient_id == patient_id
    ).order_by(Consultation.created_at.desc()).all()
    
    past_appointments = [{
        "id": c.id,
        "doctor_name": c.doctor.name,
        "department_name": c.doctor.department.name,
        "date": c.created_at,
        "symptoms": c.symptoms,
        "diagnosis": c.diagnosis,
        "prescription": c.prescription
    } for c in history]

    return {
        "patient_name": patient.name,
        "mobile_number": patient.mobile_number,
        "active_tokens": my_tokens,
        "appointment_history": past_appointments
    }
