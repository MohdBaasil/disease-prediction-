from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
import datetime
from pydantic import BaseModel

from backend.database.connection import get_db
from backend.database.models import Appointment, Patient, Doctor, Department, User, Queue, AuditLog
from backend.database.schemas import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentReschedule,
    AppointmentCheckIn,
    AppointmentResponse,
    DoctorAvailabilityResponse,
    TimeSlot
)
from backend.services.auth_service import get_current_user, RoleChecker
from backend.services.queue_service import add_patient_to_queue
from backend.services.notification_service import send_patient_notification
from backend.utils.websocket import manager

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])

def check_doctor_double_booking(
    db: Session,
    doctor_id: int,
    appointment_time: datetime.datetime,
    exclude_appointment_id: Optional[int] = None,
    slot_minutes: int = 15
):
    """
    Checks if a doctor is already booked within the specified slot duration (default 15 minutes).
    Raises HTTPException 409 if a conflict exists.
    """
    time_start = appointment_time - datetime.timedelta(minutes=slot_minutes - 1)
    time_end = appointment_time + datetime.timedelta(minutes=slot_minutes - 1)

    query = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status.in_(["Scheduled", "Checked-in", "In Consultation"]),
        Appointment.appointment_time >= time_start,
        Appointment.appointment_time <= time_end
    )

    if exclude_appointment_id:
        query = query.filter(Appointment.id != exclude_appointment_id)

    conflict = query.first()
    if conflict:
        doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        doc_name = f"Dr. {doc.name}" if doc else f"Doctor ID {doctor_id}"
        time_str = conflict.appointment_time.strftime("%I:%M %p")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{doc_name} is already booked at {time_str}. Please select a different time slot or doctor."
        )

def check_patient_duplicate_booking(
    db: Session,
    patient_id: int,
    appointment_time: datetime.datetime,
    exclude_appointment_id: Optional[int] = None,
    slot_minutes: int = 15
):
    """
    Checks if a patient already has an active appointment at or around the specified time.
    Raises HTTPException 409 if a conflict exists.
    """
    time_start = appointment_time - datetime.timedelta(minutes=slot_minutes - 1)
    time_end = appointment_time + datetime.timedelta(minutes=slot_minutes - 1)

    query = db.query(Appointment).filter(
        Appointment.patient_id == patient_id,
        Appointment.status.in_(["Scheduled", "Checked-in", "In Consultation"]),
        Appointment.appointment_time >= time_start,
        Appointment.appointment_time <= time_end
    )

    if exclude_appointment_id:
        query = query.filter(Appointment.id != exclude_appointment_id)

    conflict = query.first()
    if conflict:
        time_str = conflict.appointment_time.strftime("%I:%M %p")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient already has an active appointment scheduled for {time_str}."
        )

@router.get("", response_model=List[AppointmentResponse])
def get_appointments(
    search: Optional[str] = Query(None, description="Search by patient name, mobile, doctor name or department"),
    doctor_id: Optional[int] = Query(None),
    patient_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    date: Optional[str] = Query(None, description="Filter by YYYY-MM-DD date"),
    status: Optional[str] = Query(None, description="Filter by status e.g. Scheduled, Checked-in, Completed, Cancelled"),
    appointment_type: Optional[str] = Query(None, description="Walk-in or Scheduled"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Appointment).join(Patient, Appointment.patient_id == Patient.id).join(Doctor, Appointment.doctor_id == Doctor.id)

    # Role Scoping
    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        query = query.filter(Appointment.patient_id == patient.id)
    elif current_user.role == "Doctor":
        doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doc:
            return []
        query = query.filter(Appointment.doctor_id == doc.id)

    # Filtering
    if doctor_id:
        query = query.filter(Appointment.doctor_id == doctor_id)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if department_id:
        query = query.filter(
            or_(
                Appointment.department_id == department_id,
                Doctor.department_id == department_id
            )
        )
    if status and status != "All":
        query = query.filter(Appointment.status == status)
    if appointment_type:
        query = query.filter(Appointment.appointment_type == appointment_type)

    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.datetime.combine(target_date, datetime.time.min)
            end_dt = datetime.datetime.combine(target_date, datetime.time.max)
            query = query.filter(Appointment.appointment_time >= start_dt, Appointment.appointment_time <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Patient.name.ilike(search_fmt),
                Patient.mobile_number.ilike(search_fmt),
                Doctor.name.ilike(search_fmt),
                Appointment.reason.ilike(search_fmt)
            )
        )

    return query.order_by(Appointment.appointment_time.desc()).all()

@router.get("/today", response_model=List[AppointmentResponse])
def get_today_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor"]))
):
    today = datetime.datetime.utcnow().date()
    start_dt = datetime.datetime.combine(today, datetime.time.min)
    end_dt = datetime.datetime.combine(today, datetime.time.max)

    query = db.query(Appointment).filter(
        Appointment.appointment_time >= start_dt,
        Appointment.appointment_time <= end_dt
    )

    if current_user.role == "Doctor":
        doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if doc:
            query = query.filter(Appointment.doctor_id == doc.id)

    return query.order_by(Appointment.appointment_time.asc()).all()

@router.get("/doctor-availability", response_model=DoctorAvailabilityResponse)
def get_doctor_availability(
    doctor_id: int = Query(..., description="Doctor ID"),
    date: Optional[str] = Query(None, description="Date YYYY-MM-DD, defaults to today"),
    db: Session = Depends(get_db)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    target_date = datetime.datetime.utcnow().date()
    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    start_of_day = datetime.datetime.combine(target_date, datetime.time(9, 0))   # 09:00 AM
    end_of_day = datetime.datetime.combine(target_date, datetime.time(17, 0))    # 05:00 PM

    # Fetch existing appointments for doctor on target date
    start_dt = datetime.datetime.combine(target_date, datetime.time.min)
    end_dt = datetime.datetime.combine(target_date, datetime.time.max)

    booked_appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status.in_(["Scheduled", "Checked-in", "In Consultation"]),
        Appointment.appointment_time >= start_dt,
        Appointment.appointment_time <= end_dt
    ).all()

    booked_map = {}
    for app in booked_appointments:
        slot_key = app.appointment_time.strftime("%H:%M")
        booked_map[slot_key] = app

    slots: List[TimeSlot] = []
    curr = start_of_day
    available_count = 0

    while curr < end_of_day:
        slot_key = curr.strftime("%H:%M")
        display_time = curr.strftime("%I:%M %p")
        is_booked = slot_key in booked_map

        app_item = booked_map.get(slot_key)
        booking_id = app_item.id if app_item else None
        p_name = app_item.patient.name if (app_item and app_item.patient) else None

        slots.append(TimeSlot(
            time=display_time,
            datetime_iso=curr.isoformat(),
            available=not is_booked,
            booking_id=booking_id,
            patient_name=p_name
        ))

        if not is_booked:
            available_count += 1

        curr += datetime.timedelta(minutes=15)

    return DoctorAvailabilityResponse(
        doctor_id=doc.id,
        doctor_name=f"Dr. {doc.name}",
        date=target_date.strftime("%Y-%m-%d"),
        is_available=doc.is_available,
        total_slots=len(slots),
        available_slots_count=available_count,
        slots=slots
    )

@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    req: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    # Resolve Patient ID if user is a Patient
    patient_id = req.patient_id
    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            raise HTTPException(status_code=400, detail="Patient profile not found for logged-in user.")
        patient_id = patient.id

    # Validate Patient
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Validate Doctor
    doctor = db.query(Doctor).filter(Doctor.id == req.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    # Department ID resolution
    dept_id = req.department_id or doctor.department_id

    # Double Booking & Duplicate Checks
    check_doctor_double_booking(db, req.doctor_id, req.appointment_time)
    check_patient_duplicate_booking(db, patient_id, req.appointment_time)

    # Create Appointment
    new_app = Appointment(
        patient_id=patient_id,
        doctor_id=req.doctor_id,
        department_id=dept_id,
        appointment_type=req.appointment_type or "Scheduled",
        appointment_time=req.appointment_time,
        priority=req.priority or 3,
        reason=req.reason,
        notes=req.notes,
        status="Scheduled"
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Appointment Created",
        details=f"Appointment #{new_app.id} created for Patient #{patient_id} with Dr. #{req.doctor_id} at {req.appointment_time}"
    )
    db.add(audit)
    db.commit()

    # Real-time WebSocket Broadcast
    await manager.broadcast({
        "event": "appointment_created",
        "appointment_id": new_app.id,
        "patient_id": patient_id,
        "doctor_id": req.doctor_id,
        "department_id": dept_id
    })

    return new_app

@router.get("/{id}", response_model=AppointmentResponse)
def get_appointment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or app.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Permission denied.")

    return app

@router.put("/{id}", response_model=AppointmentResponse)
async def update_appointment(
    id: int,
    req: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor"]))
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Re-verify collision if doctor or time changed
    target_doctor_id = req.doctor_id or app.doctor_id
    target_time = req.appointment_time or app.appointment_time
    target_patient_id = req.patient_id or app.patient_id

    if req.doctor_id or req.appointment_time:
        check_doctor_double_booking(db, target_doctor_id, target_time, exclude_appointment_id=app.id)

    if req.patient_id or req.appointment_time:
        check_patient_duplicate_booking(db, target_patient_id, target_time, exclude_appointment_id=app.id)

    # Apply updates
    if req.patient_id:
        app.patient_id = req.patient_id
    if req.doctor_id:
        app.doctor_id = req.doctor_id
    if req.department_id:
        app.department_id = req.department_id
    if req.appointment_type:
        app.appointment_type = req.appointment_type
    if req.appointment_time:
        app.appointment_time = req.appointment_time
    if req.priority is not None:
        app.priority = req.priority
    if req.reason is not None:
        app.reason = req.reason
    if req.notes is not None:
        app.notes = req.notes
    if req.status:
        app.status = req.status

    db.commit()
    db.refresh(app)

    await manager.broadcast({
        "event": "appointment_updated",
        "appointment_id": app.id,
        "status": app.status
    })

    return app

@router.put("/{id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or app.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Permission denied.")

    app.status = "Cancelled"
    db.commit()
    db.refresh(app)

    # Real-time WebSocket Broadcast
    await manager.broadcast({
        "event": "appointment_cancelled",
        "appointment_id": app.id
    })

    return app

@router.put("/{id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    id: int,
    req: RescheduleRequest if 'RescheduleRequest' in globals() else AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if current_user.role == "Patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient or app.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Permission denied.")

    # Enforce collision checks
    check_doctor_double_booking(db, app.doctor_id, req.appointment_time, exclude_appointment_id=app.id)
    check_patient_duplicate_booking(db, app.patient_id, req.appointment_time, exclude_appointment_id=app.id)

    app.appointment_time = req.appointment_time
    app.status = "Scheduled"
    db.commit()
    db.refresh(app)

    await manager.broadcast({
        "event": "appointment_rescheduled",
        "appointment_id": app.id,
        "new_time": app.appointment_time.isoformat()
    })

    return app

@router.post("/{id}/check-in", response_model=AppointmentResponse)
async def check_in_appointment(
    id: int,
    req: Optional[AppointmentCheckIn] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist"]))
):
    app = db.query(Appointment).filter(Appointment.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if app.status == "Cancelled":
        raise HTTPException(status_code=400, detail="Cannot check in a cancelled appointment.")

    priority_level = (req.priority_level if req and req.priority_level else None) or app.priority or 3

    # Generate Queue Token
    dept_id = app.department_id or (app.doctor.department_id if app.doctor else 1)
    
    queue_entry = add_patient_to_queue(
        db=db,
        patient_id=app.patient_id,
        department_id=dept_id,
        priority_level=priority_level,
        doctor_id=app.doctor_id
    )

    app.status = "Checked-in"
    db.commit()
    db.refresh(app)

    # Send Notification
    send_patient_notification(
        db=db,
        patient_id=app.patient_id,
        notification_type="AppointmentCheckedIn",
        message=f"You have been checked in for your appointment. Your token is {queue_entry.token_number}."
    )

    await manager.broadcast({
        "event": "queue_update",
        "department_id": dept_id,
        "doctor_id": app.doctor_id,
        "token_number": queue_entry.token_number
    })

    return app
