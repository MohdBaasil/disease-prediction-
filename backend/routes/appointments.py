from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pydantic import BaseModel

from backend.database.connection import get_db
from backend.database.models import Appointment, Patient, Doctor, User
from backend.database.schemas import AppointmentCreate, AppointmentResponse
from backend.services.auth_service import get_current_user, RoleChecker

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

class RescheduleRequest(BaseModel):
    appointment_time: datetime

@router.get("", response_model=List[AppointmentResponse])
def get_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        return db.query(Appointment).filter(Appointment.patient_id == patient.id).order_by(Appointment.appointment_time.desc()).all()
    elif current_user.role == "Doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor:
            return []
        return db.query(Appointment).filter(Appointment.doctor_id == doctor.id).order_by(Appointment.appointment_time.desc()).all()
    else:
        return db.query(Appointment).order_by(Appointment.appointment_time.desc()).all()

@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def book_appointment(
    req: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    patient_id = req.patient_id
    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            raise HTTPException(status_code=400, detail="Patient profile not found")
        patient_id = patient.id

    new_app = Appointment(
        patient_id=patient_id,
        doctor_id=req.doctor_id,
        appointment_type=req.appointment_type,
        appointment_time=req.appointment_time,
        status="Scheduled"
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return new_app

@router.put("/{id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or app.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Permission denied")

    app.status = "Cancelled"
    db.commit()
    db.refresh(app)
    return app

@router.put("/{id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    id: int,
    req: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or app.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Permission denied")

    app.appointment_time = req.appointment_time
    app.status = "Scheduled"
    db.commit()
    db.refresh(app)
    return app
