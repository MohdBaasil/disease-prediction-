from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.connection import get_db
from backend.database.models import Queue, Department, Doctor, Patient, User, AuditLog
from backend.database.schemas import QueueCreate, QueueResponse, ConsultationCreate, DepartmentResponse
from backend.services.queue_service import (
    add_patient_to_queue,
    call_next_patient,
    complete_consultation,
    skip_patient,
    reschedule_patient,
    reorder_queue
)
from backend.services.auth_service import RoleChecker
from backend.utils.websocket import manager
from backend.services.notification_service import send_patient_notification

router = APIRouter(prefix="/api/queue", tags=["Queue Operations"])

@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/check-in", response_model=QueueResponse)
async def check_in_patient(
    req: QueueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    try:
        entry = add_patient_to_queue(
            db=db,
            patient_id=req.patient_id,
            department_id=req.department_id,
            priority_level=req.priority_level,
            doctor_id=req.doctor_id
        )
        
        # Send Notification
        send_patient_notification(
            db=db,
            patient_id=entry.patient_id,
            notification_type="TokenGenerated",
            message=f"Hello {entry.patient.name}, your token is {entry.token_number}. Estimated waiting time: {entry.estimated_wait_time:.1f} mins."
        )

        # Broadcast update
        await manager.broadcast({
            "event": "queue_update",
            "department_id": entry.department_id,
            "doctor_id": entry.doctor_id
        })
        
        # Log Audit
        log = AuditLog(
            user_id=current_user.id,
            action="Queue Checkin",
            details=f"Token {entry.token_number} generated for Patient id: {entry.patient_id}"
        )
        db.add(log)
        db.commit()
        
        return entry
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/call-next", response_model=Optional[QueueResponse])
async def call_next(
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

    entry = call_next_patient(db, doctor_id)
    
    if not entry:
        return None
        
    # Send Notification (Patient is next)
    send_patient_notification(
        db=db,
        patient_id=entry.patient_id,
        notification_type="PatientNext",
        message=f"Hello {entry.patient.name}, you are next! Please proceed to room {doc.room_number} to see Dr. {doc.name}."
    )

    # Broadcast update
    await manager.broadcast({
        "event": "queue_update",
        "department_id": doc.department_id,
        "doctor_id": doctor_id
    })
    
    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="Call Patient",
        details=f"Dr. {doc.name} called Token {entry.token_number}"
    )
    db.add(log)
    db.commit()

    return entry

@router.post("/complete/{queue_id}", response_model=QueueResponse)
async def complete_patient(
    queue_id: int,
    consultation: ConsultationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Doctor"]))
):
    entry = db.query(Queue).filter(Queue.id == queue_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
        
    doc = db.query(Doctor).filter(Doctor.id == entry.doctor_id).first()
    if current_user.role == "Doctor" and (not doc or doc.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Unauthorized doctor access")
        
    completed_entry = complete_consultation(
        db=db,
        queue_id=queue_id,
        symptoms=consultation.symptoms,
        diagnosis=consultation.diagnosis,
        prescription=consultation.prescription,
        duration_minutes=consultation.duration_minutes,
        lab_requests=consultation.lab_requests,
        consultation_outcome=consultation.consultation_outcome,
        discharge_summary=consultation.discharge_summary,
        patient_instructions=consultation.patient_instructions,
        medical_certificate=consultation.medical_certificate,
        followup_date=consultation.followup_date,
        followup_time=consultation.followup_time,
        followup_reason=consultation.followup_reason,
        followup_priority=consultation.followup_priority,
        admission_reason=consultation.admission_reason,
        ward=consultation.ward,
        expected_stay=consultation.expected_stay,
        bed_number=consultation.bed_number,
        referral_department=consultation.referral_department,
        referral_doctor=consultation.referral_doctor,
        referral_reason=consultation.referral_reason,
        referral_notes=consultation.referral_notes
    )
    
    # Broadcast update
    await manager.broadcast({
        "event": "queue_update",
        "department_id": completed_entry.department_id,
        "doctor_id": completed_entry.doctor_id
    })
    
    # Audit
    log = AuditLog(
        user_id=current_user.id,
        action="Complete Consultation",
        details=f"Completed consultation for token {completed_entry.token_number}"
    )
    db.add(log)
    db.commit()
    
    return completed_entry

@router.post("/skip/{queue_id}", response_model=QueueResponse)
async def skip_current_patient(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Doctor"]))
):
    entry = db.query(Queue).filter(Queue.id == queue_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
        
    doc = db.query(Doctor).filter(Doctor.id == entry.doctor_id).first()
    if current_user.role == "Doctor" and (not doc or doc.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Unauthorized doctor access")
        
    skipped_entry = skip_patient(db, queue_id)
    
    # Send Notification (Appointment delayed / skipped)
    send_patient_notification(
        db=db,
        patient_id=skipped_entry.patient_id,
        notification_type="AppointmentDelayed",
        message=f"Hello {skipped_entry.patient.name}, you were not present when called. Your token {skipped_entry.token_number} has been skipped. Please contact the receptionist."
    )

    # Broadcast update
    await manager.broadcast({
        "event": "queue_update",
        "department_id": skipped_entry.department_id,
        "doctor_id": skipped_entry.doctor_id
    })
    
    # Audit
    log = AuditLog(
        user_id=current_user.id,
        action="Skip Patient",
        details=f"Skipped token {skipped_entry.token_number}"
    )
    db.add(log)
    db.commit()
    
    return skipped_entry

@router.post("/reschedule/{queue_id}", response_model=QueueResponse)
async def reschedule(
    queue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist"]))
):
    try:
        rescheduled_entry = reschedule_patient(db, queue_id)
        
        # Broadcast update
        await manager.broadcast({
            "event": "queue_update",
            "department_id": rescheduled_entry.department_id,
            "doctor_id": rescheduled_entry.doctor_id
        })
        
        # Audit
        log = AuditLog(
            user_id=current_user.id,
            action="Reschedule Patient",
            details=f"Rescheduled token {rescheduled_entry.token_number} back to waiting status"
        )
        db.add(log)
        db.commit()
        
        return rescheduled_entry
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/department/{department_id}", response_model=List[QueueResponse])
def get_department_queue(department_id: int, db: Session = Depends(get_db)):
    # Return all waiting, calling, and skipped patients in order
    return db.query(Queue).filter(
        Queue.department_id == department_id,
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).order_by(Queue.status == "Calling", Queue.position.asc()).all()

@router.get("/patient/{patient_id}", response_model=List[QueueResponse])
def get_patient_active_queue(patient_id: int, db: Session = Depends(get_db)):
    # Returns active queues for patient tracking
    return db.query(Queue).filter(
        Queue.patient_id == patient_id,
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).all()

@router.get("/doctor/{doctor_id}", response_model=List[QueueResponse])
def get_doctor_active_queue(doctor_id: int, db: Session = Depends(get_db)):
    # Returns patient list calling or waiting for this doctor specifically
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return db.query(Queue).filter(
        Queue.department_id == doc.department_id,
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).order_by(Queue.status == "Calling", Queue.position.asc()).all()
