from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
import datetime
from typing import Optional, List, Dict
import json

from backend.database.connection import get_db
from backend.database.models import (
    User, Patient, Doctor, Department, Appointment, Queue, Consultation, PrescriptionItem, PredictionHistory, Visit
)
from backend.services.auth_service import RoleChecker

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

admin_only = RoleChecker(["Admin"])
doctor_only = RoleChecker(["Doctor"])
admin_or_doctor = RoleChecker(["Admin", "Doctor"])

def get_date_filter(filter_type: str, start: Optional[str] = None, end: Optional[str] = None):
    now = datetime.datetime.utcnow()
    
    if filter_type == "today":
        start_date = datetime.datetime.combine(now.date(), datetime.time.min)
        end_date = datetime.datetime.combine(now.date(), datetime.time.max)
    elif filter_type == "week":
        start_date = now - datetime.timedelta(days=now.weekday())
        start_date = datetime.datetime.combine(start_date.date(), datetime.time.min)
        end_date = now
    elif filter_type == "month":
        start_date = datetime.datetime(now.year, now.month, 1)
        end_date = now
    elif filter_type == "6months":
        start_date = now - datetime.timedelta(days=180)
        end_date = now
    elif filter_type == "year":
        start_date = datetime.datetime(now.year, 1, 1)
        end_date = now
    elif filter_type == "custom" and start:
        try:
            start_date = datetime.datetime.fromisoformat(start)
            if end:
                end_date = datetime.datetime.fromisoformat(end)
                if len(end) <= 10:
                    end_date = datetime.datetime.combine(end_date.date(), datetime.time.max)
            else:
                end_date = now
        except Exception:
            start_date = now - datetime.timedelta(days=30)
            end_date = now
    else:
        # Default: last 30 days
        start_date = now - datetime.timedelta(days=30)
        end_date = now
        
    return start_date, end_date

@router.get("/admin/analytics")
def get_admin_analytics(
    filter_type: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    start_date, end_date = get_date_filter(filter_type, start, end)
    
    today = datetime.datetime.utcnow().date()
    today_start = datetime.datetime.combine(today, datetime.time.min)
    today_end = datetime.datetime.combine(today, datetime.time.max)

    # 1. Total Patients
    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    # 2. Total Doctors
    total_doctors = db.query(func.count(Doctor.id)).scalar() or 0
    # 3. Total Receptionists
    total_receptionists = db.query(func.count(User.id)).filter(User.role == "Receptionist").scalar() or 0
    # 4. Total Appointments (respect date filter)
    total_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_time >= start_date,
        Appointment.appointment_time <= end_date
    ).scalar() or 0
    # 5. Today's Appointments
    todays_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.appointment_time >= today_start,
        Appointment.appointment_time <= today_end
    ).scalar() or 0
    # 6. Total Consultations (respect date filter)
    total_consultations = db.query(func.count(Consultation.id)).filter(
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 0
    # 7. Total Prescriptions (respect date filter)
    total_prescriptions = db.query(func.count(PrescriptionItem.id)).join(Visit).filter(
        Visit.visit_date >= start_date,
        Visit.visit_date <= end_date
    ).scalar() or 0
    # 8. Total AI Predictions (respect date filter)
    total_predictions = db.query(func.count(PredictionHistory.id)).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).scalar() or 0
    # 9. Active Queue Count
    active_queue = db.query(func.count(Queue.id)).filter(
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).scalar() or 0
    # 10. High Risk Patients
    high_risk_patients = db.query(func.count(PredictionHistory.id)).filter(
        PredictionHistory.risk_level.in_(["High", "Critical"]),
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).scalar() or 0
    
    # 11. Average Daily Patients (unique patients checked-in/registered per day)
    daily_patient_counts = db.query(
        func.count(func.distinct(Queue.patient_id)).label('count'),
        func.strftime('%Y-%m-%d', Queue.checked_in_time).label('day')
    ).filter(
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).group_by('day').all()
    
    avg_daily_patients = 0.0
    if daily_patient_counts:
        total_days_count = sum(d.count for d in daily_patient_counts)
        avg_daily_patients = round(total_days_count / len(daily_patient_counts), 1)
    else:
        avg_daily_patients = round(total_patients / 30.0, 1) if total_patients > 0 else 0.0

    # 12. Average Waiting Time (SQLite epoch diff)
    avg_wait = db.query(
        func.avg(func.strftime('%s', Queue.call_time) - func.strftime('%s', Queue.checked_in_time))
    ).filter(
        Queue.status == "Completed",
        Queue.call_time != None,
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).scalar()
    
    avg_wait_mins = round(float(avg_wait) / 60.0, 1) if avg_wait is not None else 14.5

    return {
        "total_patients": total_patients,
        "total_doctors": total_doctors,
        "total_receptionists": total_receptionists,
        "total_appointments": total_appointments,
        "todays_appointments": todays_appointments,
        "total_consultations": total_consultations,
        "total_prescriptions": total_prescriptions,
        "total_predictions": total_predictions,
        "active_queue_count": active_queue,
        "high_risk_patients": high_risk_patients,
        "avg_daily_patients": avg_daily_patients,
        "avg_waiting_time_minutes": avg_wait_mins
    }

@router.get("/admin/charts")
def get_admin_charts(
    filter_type: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    start_date, end_date = get_date_filter(filter_type, start, end)
    today = datetime.datetime.utcnow().date()
    today_start = datetime.datetime.combine(today, datetime.time.min)

    # 1. Monthly Patient Registration
    registrations = db.query(
        func.strftime('%Y-%m', Patient.created_at).label('month'),
        func.count(Patient.id).label('count')
    ).filter(
        Patient.created_at >= start_date,
        Patient.created_at <= end_date
    ).group_by('month').order_by('month').all()
    
    # 2. Monthly Appointment Trend
    appointments = db.query(
        func.strftime('%Y-%m', Appointment.appointment_time).label('month'),
        func.count(Appointment.id).label('count')
    ).filter(
        Appointment.appointment_time >= start_date,
        Appointment.appointment_time <= end_date
    ).group_by('month').order_by('month').all()

    # 3. Most Common Predicted Diseases
    common_diseases = db.query(
        PredictionHistory.predicted_disease,
        func.count(PredictionHistory.id).label('count')
    ).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).group_by(PredictionHistory.predicted_disease).order_by(func.count(PredictionHistory.id).desc()).limit(10).all()

    # 4. Department-wise Patient Distribution
    dept_dist = db.query(
        Department.name,
        func.count(Queue.id).label('count')
    ).join(Queue, Queue.department_id == Department.id).filter(
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).group_by(Department.name).all()

    # 5. Doctor Workload (Doctor Name, Patients Handled, Today's Consultations)
    workload_range = db.query(
        Doctor.id,
        Doctor.name,
        func.count(Consultation.id).label('handled')
    ).join(Consultation, Consultation.doctor_id == Doctor.id).filter(
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).group_by(Doctor.id).order_by(func.count(Consultation.id).desc()).limit(10).all()
    
    workload_today = db.query(
        Doctor.id,
        func.count(Consultation.id).label('today_count')
    ).join(Consultation, Consultation.doctor_id == Doctor.id).filter(
        Consultation.created_at >= today_start
    ).group_by(Doctor.id).all()
    workload_today_dict = {w.id: w.today_count for w in workload_today}
    
    doctor_workload = [{
        "doctor_name": w.name,
        "patients_handled": w.handled,
        "todays_consultations": workload_today_dict.get(w.id, 0)
    } for w in workload_range]

    # 6. Prediction Risk Distribution
    risk_dist = db.query(
        PredictionHistory.risk_level,
        func.count(PredictionHistory.id).label('count')
    ).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).group_by(PredictionHistory.risk_level).all()

    # 7. Queue Analytics
    avg_wait = db.query(
        func.avg(func.strftime('%s', Queue.call_time) - func.strftime('%s', Queue.checked_in_time))
    ).filter(
        Queue.status == "Completed",
        Queue.call_time != None,
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).scalar()
    avg_wait_mins = round(float(avg_wait) / 60.0, 1) if avg_wait is not None else 14.5

    avg_consult_duration = db.query(func.avg(Consultation.duration_minutes)).filter(
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 15.0

    current_queue_len = db.query(func.count(Queue.id)).filter(
        Queue.status.in_(["Waiting", "Calling"])
    ).scalar() or 0

    completed_today = db.query(func.count(Queue.id)).filter(
        Queue.status == "Completed",
        Queue.completion_time >= today_start
    ).scalar() or 0

    return {
        "monthly_patient_registration": [{"month": r.month, "count": r.count} for r in registrations],
        "monthly_appointment_trend": [{"month": a.month, "count": a.count} for a in appointments],
        "most_common_predicted_diseases": [{"disease": c.predicted_disease, "count": c.count} for c in common_diseases],
        "department_patient_distribution": [{"department": d.name, "count": d.count} for d in dept_dist],
        "doctor_workload": doctor_workload,
        "prediction_risk_distribution": [{"risk_level": r.risk_level, "count": r.count} for r in risk_dist],
        "queue_analytics": {
            "average_waiting_time_minutes": avg_wait_mins,
            "average_consultation_time_minutes": round(float(avg_consult_duration), 1),
            "current_queue_length": current_queue_len,
            "completed_tokens_today": completed_today
        }
    }

@router.get("/admin/high-risk-patients")
def get_admin_high_risk_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    high_risk = db.query(
        PredictionHistory
    ).filter(
        PredictionHistory.risk_level.in_(["High", "Critical"])
    ).order_by(PredictionHistory.prediction_time.desc()).limit(20).all()
    
    high_risk_patients = []
    for ph in high_risk:
        doctor_name = "Not Assigned"
        appt = db.query(Appointment).filter(
            Appointment.patient_id == ph.patient_id,
            Appointment.status == "Scheduled"
        ).order_by(Appointment.appointment_time.desc()).first()
        
        if appt and appt.doctor:
            doctor_name = f"Dr. {appt.doctor.name}"
        else:
            visit = db.query(Visit).filter(
                Visit.patient_id == ph.patient_id
            ).order_by(Visit.visit_date.desc()).first()
            if visit and visit.doctor:
                doctor_name = f"Dr. {visit.doctor.name}"
                
        high_risk_patients.append({
            "id": ph.id,
            "patient_name": ph.patient.name if ph.patient else "Unknown",
            "predicted_disease": ph.predicted_disease,
            "risk_level": ph.risk_level,
            "assigned_doctor": doctor_name,
            "prediction_time": ph.prediction_time
        })
        
    return high_risk_patients

@router.get("/admin/recent-activities")
def get_admin_recent_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    activities = []
    
    # 1. New Patients
    new_patients = db.query(Patient).order_by(Patient.created_at.desc()).limit(10).all()
    for p in new_patients:
        activities.append({
            "type": "New Patient Registered",
            "description": f"Patient '{p.name}' registered to portal.",
            "time": p.created_at
        })
        
    # 2. Appointments
    new_appts = db.query(Appointment).order_by(Appointment.created_at.desc()).limit(10).all()
    for a in new_appts:
        activities.append({
            "type": "Appointment Booked",
            "description": f"Appointment scheduled with Dr. {a.doctor.name if a.doctor else 'Unknown'} for {a.patient.name if a.patient else 'Unknown'}.",
            "time": a.created_at
        })
        
    # 3. Consultations
    new_consults = db.query(Consultation).order_by(Consultation.created_at.desc()).limit(10).all()
    for c in new_consults:
        activities.append({
            "type": "Consultation Completed",
            "description": f"Dr. {c.doctor.name if c.doctor else 'Unknown'} completed consultation for {c.patient.name if c.patient else 'Unknown'}.",
            "time": c.created_at
        })
        
    # 4. Prescriptions
    new_prescs = db.query(PrescriptionItem).join(Visit).order_by(Visit.visit_date.desc()).limit(10).all()
    for pr in new_prescs:
        activities.append({
            "type": "Prescription Added",
            "description": f"Prescribed {pr.medicine_name} to {pr.visit.patient.name if pr.visit.patient else 'Patient'}.",
            "time": pr.visit.visit_date
        })
        
    # 5. AI Predictions
    new_predictions = db.query(PredictionHistory).order_by(PredictionHistory.prediction_time.desc()).limit(10).all()
    for pred in new_predictions:
        activities.append({
            "type": "AI Prediction Generated",
            "description": f"Predicted '{pred.predicted_disease}' ({pred.risk_level} Risk) for {pred.patient.name if pred.patient else 'Patient'}.",
            "time": pred.prediction_time
        })
        
    activities.sort(key=lambda x: x["time"], reverse=True)
    return activities[:15]

@router.get("/doctor/analytics")
def get_doctor_analytics(
    doctor_id: int,
    filter_type: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(doctor_only)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized doctor access")

    start_date, end_date = get_date_filter(filter_type, start, end)
    today = datetime.datetime.utcnow().date()
    today_start = datetime.datetime.combine(today, datetime.time.min)
    today_end = datetime.datetime.combine(today, datetime.time.max)

    todays_patients = db.query(func.count(func.distinct(Queue.patient_id))).filter(
        Queue.department_id == doc.department_id,
        Queue.checked_in_time >= today_start
    ).scalar() or 0

    todays_consultations = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= today_start,
        Consultation.created_at <= today_end
    ).scalar() or 0

    pending_consultations = db.query(func.count(Queue.id)).filter(
        Queue.doctor_id == doctor_id,
        Queue.status.in_(["Waiting", "Calling"])
    ).scalar() or 0

    completed_consultations = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 0

    avg_duration = db.query(func.avg(Consultation.duration_minutes)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 0.0

    patients_waiting = db.query(func.count(Queue.id)).filter(
        Queue.department_id == doc.department_id,
        Queue.status == "Waiting"
    ).scalar() or 0

    predictions_reviewed = db.query(func.count(PredictionHistory.id)).join(Patient).join(
        Consultation, Consultation.patient_id == Patient.id
    ).filter(
        Consultation.doctor_id == doctor_id,
        PredictionHistory.prediction_time <= Consultation.created_at,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 0

    return {
        "todays_patients": todays_patients,
        "todays_consultations": todays_consultations,
        "pending_consultations": pending_consultations,
        "completed_consultations": completed_consultations,
        "average_consultation_time_minutes": round(float(avg_duration), 1),
        "patients_waiting": patients_waiting,
        "ai_predictions_reviewed": predictions_reviewed
    }

@router.get("/doctor/charts")
def get_doctor_charts(
    doctor_id: int,
    filter_type: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(doctor_only)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized doctor access")

    start_date, end_date = get_date_filter(filter_type, start, end)

    daily_trend = db.query(
        func.strftime('%Y-%m-%d', Consultation.created_at).label('date'),
        func.count(Consultation.id).label('count')
    ).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).group_by('date').order_by('date').all()

    weekly_trend = db.query(
        func.strftime('%w', Consultation.created_at).label('day_of_week'),
        func.count(Consultation.id).label('count')
    ).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).group_by('day_of_week').all()
    
    days_map = {"0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday", "6": "Saturday"}
    weekly_data = {days_map[str(d)]: 0 for d in range(7)}
    for row in weekly_trend:
        name = days_map.get(str(row.day_of_week))
        if name:
            weekly_data[name] = row.count

    common_diseases = db.query(
        Consultation.diagnosis,
        func.count(Consultation.id).label('count')
    ).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).group_by(Consultation.diagnosis).order_by(func.count(Consultation.id).desc()).limit(10).all()

    ages = db.query(Patient.age).join(Consultation, Consultation.patient_id == Patient.id).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).all()
    
    age_buckets = {"0-18": 0, "19-35": 0, "36-50": 0, "51-65": 0, "66+": 0}
    for row in ages:
        a = row.age
        if a <= 18:
            age_buckets["0-18"] += 1
        elif a <= 35:
            age_buckets["19-35"] += 1
        elif a <= 50:
            age_buckets["36-50"] += 1
        elif a <= 65:
            age_buckets["51-65"] += 1
        else:
            age_buckets["66+"] += 1

    risk_dist = db.query(
        PredictionHistory.risk_level,
        func.count(PredictionHistory.id).label('count')
    ).join(Patient).join(Consultation, Consultation.patient_id == Patient.id).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).group_by(PredictionHistory.risk_level).all()

    dept_total_patients = db.query(func.count(Queue.id)).filter(
        Queue.department_id == doc.department_id,
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).scalar() or 0

    dept_completed_consults = db.query(func.count(Consultation.id)).join(Doctor).filter(
        Doctor.department_id == doc.department_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 0

    return {
        "daily_consultation_trend": [{"date": r.date, "count": r.count} for r in daily_trend],
        "weekly_consultation_trend": [{"day": day, "count": count} for day, count in weekly_data.items()],
        "most_common_diseases": [{"disease": c.diagnosis, "count": c.count} for c in common_diseases],
        "patient_age_distribution": [{"age_group": bucket, "count": count} for bucket, count in age_buckets.items()],
        "prediction_risk_distribution": [{"risk_level": r.risk_level, "count": r.count} for r in risk_dist],
        "department_statistics": {
            "total_department_patients": dept_total_patients,
            "total_department_completed_consultations": dept_completed_consults
        }
    }

@router.get("/doctor/insights")
def get_doctor_insights(
    doctor_id: int,
    filter_type: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(doctor_only)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized doctor access")

    start_date, end_date = get_date_filter(filter_type, start, end)
    today = datetime.datetime.utcnow().date()
    today_start = datetime.datetime.combine(today, datetime.time.min)

    seen_today = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= today_start
    ).scalar() or 0

    week_start = datetime.datetime.utcnow() - datetime.timedelta(days=datetime.datetime.utcnow().weekday())
    week_start = datetime.datetime.combine(week_start.date(), datetime.time.min)
    seen_week = db.query(func.count(Consultation.id)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= week_start
    ).scalar() or 0

    avg_duration = db.query(func.avg(Consultation.duration_minutes)).filter(
        Consultation.doctor_id == doctor_id,
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).scalar() or 0.0

    avg_wait = db.query(
        func.avg(func.strftime('%s', Queue.call_time) - func.strftime('%s', Queue.checked_in_time))
    ).filter(
        Queue.doctor_id == doctor_id,
        Queue.status == "Completed",
        Queue.call_time != None,
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).scalar()
    avg_wait_mins = round(float(avg_wait) / 60.0, 1) if avg_wait is not None else 12.0

    completed_today = db.query(func.count(Queue.id)).filter(
        Queue.doctor_id == doctor_id,
        Queue.status == "Completed",
        Queue.completion_time >= today_start
    ).scalar() or 0
    
    skipped_today = db.query(func.count(Queue.id)).filter(
        Queue.doctor_id == doctor_id,
        Queue.status == "Skipped",
        Queue.checked_in_time >= today_start
    ).scalar() or 0
    
    total_assigned = completed_today + skipped_today
    completion_rate = 100.0
    if total_assigned > 0:
        completion_rate = round((completed_today / total_assigned) * 100.0, 1)

    return {
        "patients_seen_today": seen_today,
        "patients_seen_this_week": seen_week,
        "average_consultation_duration_minutes": round(float(avg_duration), 1),
        "average_waiting_time_minutes": avg_wait_mins,
        "consultation_completion_rate_percentage": completion_rate
    }

@router.get("/predictions/analytics")
def get_predictions_analytics(
    filter_type: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_doctor)
):
    start_date, end_date = get_date_filter(filter_type, start, end)
    today = datetime.datetime.utcnow().date()
    today_start = datetime.datetime.combine(today, datetime.time.min)

    total_preds = db.query(func.count(PredictionHistory.id)).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).scalar() or 0

    preds_today = db.query(func.count(PredictionHistory.id)).filter(
        PredictionHistory.prediction_time >= today_start
    ).scalar() or 0

    top_diseases = db.query(
        PredictionHistory.predicted_disease,
        func.count(PredictionHistory.id).label('count')
    ).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).group_by(PredictionHistory.predicted_disease).order_by(func.count(PredictionHistory.id).desc()).limit(10).all()

    disease_freq = db.query(
        PredictionHistory.predicted_disease,
        func.count(PredictionHistory.id).label('count')
    ).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).group_by(PredictionHistory.predicted_disease).all()

    risk_dist = db.query(
        PredictionHistory.risk_level,
        func.count(PredictionHistory.id).label('count')
    ).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).group_by(PredictionHistory.risk_level).all()

    confidences = db.query(PredictionHistory.confidence).filter(
        PredictionHistory.prediction_time >= start_date,
        PredictionHistory.prediction_time <= end_date
    ).all()
    
    buckets = {
        "90%-100%": 0,
        "80%-89%": 0,
        "70%-79%": 0,
        "60%-69%": 0,
        "<60%": 0
    }
    avg_conf = 0.0
    if confidences:
        total_conf = 0.0
        for row in confidences:
            c = row.confidence
            total_conf += c
            if c >= 0.90:
                buckets["90%-100%"] += 1
            elif c >= 0.80:
                buckets["80%-89%"] += 1
            elif c >= 0.70:
                buckets["70%-79%"] += 1
            elif c >= 0.60:
                buckets["60%-69%"] += 1
            else:
                buckets["<60%"] += 1
        avg_conf = round(total_conf / len(confidences), 3)

    return {
        "total_predictions": total_preds,
        "predictions_today": preds_today,
        "top_predicted_diseases": [{"disease": d.predicted_disease, "count": d.count} for d in top_diseases],
        "disease_frequency": {d.predicted_disease: d.count for d in disease_freq},
        "risk_distribution": {r.risk_level: r.count for r in risk_dist},
        "confidence_distribution": buckets,
        "average_confidence": avg_conf
    }
