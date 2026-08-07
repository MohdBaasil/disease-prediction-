from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
import time
from typing import Optional


from backend.database.connection import get_db
from backend.database.models import User, Queue, Doctor, Consultation, Patient ,Appointment
from backend.services.auth_service import RoleChecker

router = APIRouter(prefix="/api/dashboard", tags=["Dashboards"])

@router.get("/admin")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"]))
):
    today = datetime.datetime.utcnow().date()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    end_of_today = datetime.datetime.combine(today, datetime.time.max)

    # 1. KPI STATISTICS
    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_doctors = db.query(func.count(Doctor.id)).scalar() or 0
    total_receptionists = db.query(func.count(User.id)).filter(User.role == "Receptionist").scalar() or 0
    from backend.database.models import Receptionist, Department
    active_receptionists = db.query(func.count(Receptionist.id)).filter(Receptionist.is_active == True).scalar()
    if active_receptionists is None or active_receptionists == 0:
        active_receptionists = total_receptionists
    disabled_receptionists = max(0, total_receptionists - active_receptionists)
    
    total_departments = db.query(func.count(Department.id)).scalar() or 0
    active_departments = db.query(func.count(Department.id)).filter(Department.is_active == True).scalar() or 0
    inactive_departments = max(0, total_departments - active_departments)

    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    if active_users is None:
        active_users = total_users
    disabled_users = max(0, total_users - active_users)

    users_by_role = {
        "Admin": db.query(func.count(User.id)).filter(User.role == "Admin").scalar() or 0,
        "Doctor": db.query(func.count(User.id)).filter(User.role == "Doctor").scalar() or 0,
        "Receptionist": db.query(func.count(User.id)).filter(User.role == "Receptionist").scalar() or 0,
        "Patient": db.query(func.count(User.id)).filter(User.role == "Patient").scalar() or 0
    }
    total_appointments = db.query(func.count(Appointment.id)).scalar() or 0
    
    todays_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_time >= start_of_today,
        Appointment.appointment_time <= end_of_today
    ).scalar() or 0

    waiting_patients = db.query(func.count(Queue.id)).filter(
        Queue.status == "Waiting"
    ).scalar() or 0

    active_consultations = db.query(func.count(Queue.id)).filter(
        Queue.status == "Calling"
    ).scalar() or 0

    completed_consultations = db.query(func.count(Consultation.id)).scalar() or 0

    emergency_queue_count = db.query(func.count(Queue.id)).filter(
        Queue.status == "Waiting",
        Queue.priority_level.in_([1, 2])
    ).scalar() or 0

    # 2. RECENT PATIENTS (Latest 10 registrations)
    recent_patients_db = db.query(Patient).order_by(Patient.created_at.desc()).limit(10).all()
    recent_patients = [{
        "id": p.id,
        "name": p.name,
        "patient_code": p.patient_code or f"PAT-{p.id:06d}",
        "age": p.age,
        "gender": p.gender,
        "mobile_number": p.mobile_number,
        "email": p.email,
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in recent_patients_db]

    # 3. RECENT APPOINTMENTS (Latest 10 appointments)
    recent_appts_db = db.query(Appointment).order_by(Appointment.created_at.desc()).limit(10).all()
    recent_appointments = [{
        "id": a.id,
        "patient_name": a.patient.name if a.patient else "Unknown Patient",
        "patient_id": a.patient_id,
        "doctor_name": f"Dr. {a.doctor.name}" if a.doctor else "Unassigned",
        "doctor_id": a.doctor_id,
        "department_name": (a.department.name if a.department else (a.doctor.department.name if (a.doctor and a.doctor.department) else "General")),
        "appointment_time": a.appointment_time.strftime("%b %d, %Y - %I:%M %p"),
        "raw_time": a.appointment_time.isoformat(),
        "appointment_type": a.appointment_type or "Scheduled",
        "status": a.status
    } for a in recent_appts_db]

    # 4. RECENT CONSULTATIONS (Latest 10 completed/active consultations)
    recent_consults_db = db.query(Consultation).order_by(Consultation.created_at.desc()).limit(10).all()
    recent_consultations = [{
        "id": c.id,
        "patient_name": c.patient.name if c.patient else "Unknown Patient",
        "doctor_name": f"Dr. {c.doctor.name}" if c.doctor else "Doctor",
        "symptoms": c.symptoms,
        "diagnosis": c.diagnosis,
        "prescription": c.prescription,
        "outcome": c.consultation_outcome or "Discharge",
        "duration_minutes": c.duration_minutes or 15,
        "created_at": c.created_at.strftime("%b %d, %Y - %I:%M %p")
    } for c in recent_consults_db]

    # 5. AGGREGATED RECENT ACTIVITIES
    activities = []
    for p in recent_patients_db[:5]:
        activities.append({
            "type": "Patient Registered",
            "description": f"New patient '{p.name}' registered into hospital database.",
            "time": p.created_at.isoformat() if p.created_at else None
        })
    for a in recent_appts_db[:5]:
        activities.append({
            "type": "Appointment Booked",
            "description": f"Appointment scheduled for {a.patient.name if a.patient else 'Patient'} with Dr. {a.doctor.name if a.doctor else 'Doctor'}.",
            "time": a.created_at.isoformat() if a.created_at else None
        })
    for c in recent_consults_db[:5]:
        activities.append({
            "type": "Consultation Completed",
            "description": f"Dr. {c.doctor.name if c.doctor else 'Doctor'} completed consultation for {c.patient.name if c.patient else 'Patient'}.",
            "time": c.created_at.isoformat() if c.created_at else None
        })

    activities.sort(key=lambda x: x["time"] or "", reverse=True)

    return {
        "statistics": {
            "total_users": total_users,
            "active_users": active_users,
            "disabled_users": disabled_users,
            "users_by_role": users_by_role,
            "total_patients": total_patients,
            "total_doctors": total_doctors,
            "total_receptionists": total_receptionists,
            "active_receptionists": active_receptionists,
            "disabled_receptionists": disabled_receptionists,
            "total_departments": total_departments,
            "active_departments": active_departments,
            "inactive_departments": inactive_departments,
            "total_appointments": total_appointments,
            "todays_appointments": todays_appointments,
            "waiting_patients": waiting_patients,
            "active_consultations": active_consultations,
            "completed_consultations": completed_consultations,
            "emergency_queue_count": emergency_queue_count
        },
        "recent_patients": recent_patients,
        "recent_appointments": recent_appointments,
        "recent_consultations": recent_consultations,
        "recent_activities": activities
    }

@router.get("/receptionist")
def get_receptionist_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist"]))
):
    _t_start = time.time()
    print("=" * 70, flush=True)
    print(f"[RECEPTIONIST DASHBOARD] REQUEST ENTERED: {_t_start}", flush=True)

    today = datetime.datetime.utcnow().date()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    end_of_today = datetime.datetime.combine(today, datetime.time.max)

    # 1. STATISTICS CARDS
    appts_today = db.query(Appointment).filter(
        Appointment.appointment_time >= start_of_today,
        Appointment.appointment_time <= end_of_today
    ).all()
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — appts_today loaded ({len(appts_today)} rows)", flush=True)
    
    queues_today = db.query(Queue).filter(
        Queue.checked_in_time >= start_of_today,
        Queue.checked_in_time <= end_of_today
    ).all()
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — queues_today loaded ({len(queues_today)} rows)", flush=True)

    # Total appointments today = scheduled appointments + walk-in queues
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — BEFORE total_appointments_count", flush=True)
    total_appointments_count = len(appts_today) + len([q for q in queues_today if not any(a.patient_id == q.patient_id for a in appts_today)])
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — AFTER total_appointments_count", flush=True)

    # Walk-in patients today
    walkin_count = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_time >= start_of_today,
        Appointment.appointment_time <= end_of_today,
        Appointment.appointment_type == "Walk-in"
    ).scalar() or 0
    
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — BEFORE walkin_queues", flush=True)
    walkin_queues = len([q for q in queues_today if not any(a.patient_id == q.patient_id for a in appts_today)])
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — AFTER walkin_queues", flush=True)
    total_walkins = walkin_count + walkin_queues

    # Waiting Patients currently
    waiting_patients_count = db.query(func.count(Queue.id)).filter(
        Queue.status == "Waiting"
    ).scalar() or 0

    # Checked-in Patients today
    checked_in_count = db.query(func.count(Queue.id)).filter(
        Queue.checked_in_time >= start_of_today,
        Queue.status.in_(["Waiting", "Calling", "Completed", "Skipped"])
    ).scalar() or 0

    # Emergency waiting count
    emergency_waiting_count = db.query(func.count(Queue.id)).filter(
        Queue.status == "Waiting",
        Queue.priority_level.in_([1, 2])
    ).scalar() or 0

    # 2. TODAY'S APPOINTMENT LIST
    today_appointments_list = []
    patient_queue_map = {q.patient_id: q for q in queues_today}

    for app in appts_today:
        token = "TBD"
        status = app.status
        if app.patient_id in patient_queue_map:
            q_item = patient_queue_map[app.patient_id]
            token = q_item.token_number
            if q_item.status == "Calling":
                status = "In Consultation"
            elif q_item.status == "Completed":
                status = "Completed"
            elif q_item.status == "Skipped":
                status = "Skipped"
            elif q_item.status == "Waiting":
                status = "Checked-in"
        else:
            if app.status == "Scheduled" and app.appointment_time < datetime.datetime.utcnow() - datetime.timedelta(minutes=15):
                status = "Late"

        today_appointments_list.append({
            "id": app.id,
            "patient_name": app.patient.name if app.patient else "Unknown Patient",
            "patient_id": app.patient_id,
            "token_number": token,
            "appointment_time": app.appointment_time.strftime("%I:%M %p"),
            "raw_time": app.appointment_time.isoformat(),
            "doctor": f"Dr. {app.doctor.name}" if app.doctor else "Unassigned",
            "doctor_id": app.doctor_id,
            "department": (app.department.name if app.department else (app.doctor.department.name if (app.doctor and app.doctor.department) else "General")),
            "department_id": app.department_id or (app.doctor.department_id if app.doctor else None),
            "priority": getattr(app, "priority", 3) or 3,
            "reason": getattr(app, "reason", "") or "",
            "notes": getattr(app, "notes", "") or "",
            "status": status,
            "appointment_type": app.appointment_type or "Scheduled"
        })

    for q in queues_today:
        if not any(item["patient_id"] == q.patient_id for item in today_appointments_list):
            q_status = "Checked-in"
            if q.status == "Calling":
                q_status = "In Consultation"
            elif q.status == "Completed":
                q_status = "Completed"
            elif q.status == "Skipped":
                q_status = "Skipped"

            today_appointments_list.append({
                "id": f"q-{q.id}",
                "patient_name": q.patient.name if q.patient else "Walk-in Patient",
                "patient_id": q.patient_id,
                "token_number": q.token_number,
                "appointment_time": q.checked_in_time.strftime("%I:%M %p"),
                "raw_time": q.checked_in_time.isoformat(),
                "doctor": f"Dr. {q.doctor.name}" if q.doctor else "Any Physician",
                "doctor_id": q.doctor_id,
                "department": q.department.name if q.department else "General",
                "department_id": q.department_id,
                "priority": q.priority_level or 3,
                "reason": "Walk-in Desk Check-in",
                "notes": "",
                "status": q_status,
                "appointment_type": "Walk-in"
            })

    today_appointments_list.sort(key=lambda x: x["raw_time"])

    # 3. CURRENT QUEUE OVERVIEW (BY DOCTOR)
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — starting queue_overview doctor loop", flush=True)
    doctors = db.query(Doctor).all()
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — doctors loaded ({len(doctors)} rows)", flush=True)
    queue_overview = []
    
    for doc in doctors:
        calling_q = db.query(Queue).filter(
            Queue.doctor_id == doc.id,
            Queue.status == "Calling"
        ).first()
        
        waiting_q_count = db.query(func.count(Queue.id)).filter(
            (Queue.doctor_id == doc.id) | ((Queue.doctor_id == None) & (Queue.department_id == doc.department_id)),
            Queue.status == "Waiting"
        ).scalar() or 0

        queue_overview.append({
            "doctor_id": doc.id,
            "doctor_name": doc.name,
            "specialization": doc.specialization,
            "room_number": doc.room_number,
            "department_name": doc.department.name if doc.department else "General",
            "is_available": doc.is_available,
            "current_token": calling_q.token_number if calling_q else "None",
            "current_patient": calling_q.patient.name if (calling_q and calling_q.patient) else None,
            "waiting_count": waiting_q_count
        })
    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — queue_overview doctor loop DONE ({len(queue_overview)} entries)", flush=True)

    # 4. NOTIFICATIONS PANEL
    late_arrivals = []
    now_dt = datetime.datetime.utcnow()
    for app in appts_today:
        if app.status == "Scheduled" and app.patient_id not in patient_queue_map:
            if app.appointment_time < now_dt - datetime.timedelta(minutes=15):
                delay_mins = int((now_dt - app.appointment_time).total_seconds() / 60)
                late_arrivals.append({
                    "id": app.id,
                    "patient_name": app.patient.name if app.patient else "Patient",
                    "doctor_name": app.doctor.name if app.doctor else "Doctor",
                    "scheduled_time": app.appointment_time.strftime("%I:%M %p"),
                    "delay_minutes": delay_mins,
                    "message": f"{app.patient.name if app.patient else 'Patient'} is {delay_mins} mins late for appointment at {app.appointment_time.strftime('%I:%M %p')}"
                })

    cancelled_appointments = []
    cancelled_apps = db.query(Appointment).filter(
        Appointment.appointment_time >= start_of_today,
        Appointment.appointment_time <= end_of_today,
        Appointment.status == "Cancelled"
    ).all()
    
    for app in cancelled_apps:
        cancelled_appointments.append({
            "id": app.id,
            "patient_name": app.patient.name if app.patient else "Patient",
            "doctor_name": app.doctor.name if app.doctor else "Doctor",
            "time": app.appointment_time.strftime("%I:%M %p"),
            "message": f"Appointment for {app.patient.name if app.patient else 'Patient'} with Dr. {app.doctor.name if app.doctor else 'Doctor'} at {app.appointment_time.strftime('%I:%M %p')} was cancelled."
        })

    queue_alerts = []
    if emergency_waiting_count > 0:
        queue_alerts.append({
            "id": "alert-emerg",
            "type": "Emergency",
            "severity": "high",
            "title": "Emergency Patient Waiting",
            "message": f"There are {emergency_waiting_count} emergency/urgent patient(s) waiting in queue."
        })

    high_wait_queues = db.query(Queue).filter(
        Queue.status == "Waiting",
        Queue.estimated_wait_time > 30
    ).count()
    if high_wait_queues > 0:
        queue_alerts.append({
            "id": "alert-wait",
            "type": "WaitTime",
            "severity": "medium",
            "title": "Extended Waiting Time Alert",
            "message": f"{high_wait_queues} patient(s) have estimated wait times exceeding 30 minutes."
        })

    skipped_count = db.query(Queue).filter(
        Queue.status == "Skipped",
        Queue.checked_in_time >= start_of_today
    ).count()
    if skipped_count > 0:
        queue_alerts.append({
            "id": "alert-skipped",
            "type": "SkippedTokens",
            "severity": "info",
            "title": "Skipped Patients Pending",
            "message": f"{skipped_count} patient token(s) were skipped and require re-queueing or receptionist action."
        })

    print(f"[RECEPTIONIST DASHBOARD] T+{time.time()-_t_start:.3f}s — RETURNING response", flush=True)
    print("=" * 70, flush=True)
    return {
        "receptionist_info": {
            "username": current_user.username,
            "name": current_user.username.title(),
            "role": current_user.role,
            "current_date": today.strftime("%A, %B %d, %Y")
        },
        "statistics": {
            "total_appointments_today": total_appointments_count,
            "walkin_patients_today": total_walkins,
            "waiting_patients": waiting_patients_count,
            "checked_in_patients_today": checked_in_count,
            "emergency_waiting": emergency_waiting_count
        },
        "today_appointments": today_appointments_list,
        "queue_overview": queue_overview,
        "notifications": {
            "late_arrivals": late_arrivals,
            "cancelled_appointments": cancelled_appointments,
            "queue_alerts": queue_alerts
        }
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

    # 4. Disposition counts today
    discharged_count = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_of_today,
        Consultation.consultation_outcome == "Discharge"
    ).scalar() or 0

    followups_count = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_of_today,
        Consultation.consultation_outcome == "Follow-up"
    ).scalar() or 0

    admissions_count = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_of_today,
        Consultation.consultation_outcome == "Admit"
    ).scalar() or 0

    referrals_count = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_of_today,
        Consultation.consultation_outcome == "Refer"
    ).scalar() or 0

    # 5. Average consultation duration for this doctor today
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
        "discharged_today": discharged_count,
        "followups_today": followups_count,
        "admissions_today": admissions_count,
        "referrals_today": referrals_count,
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
