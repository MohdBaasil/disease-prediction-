from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Union
from pydantic import BaseModel, Field
import datetime
import json

from backend.database.connection import get_db
from backend.database.models import Patient, User, Appointment, Queue, Visit, PrescriptionItem, MedicalReport, Notification, PredictionHistory
from backend.database.schemas import (
    PatientResponse, AppointmentResponse, QueueResponse, VisitResponse, 
    MedicalReportResponse, NotificationResponse, PatientProfileUpdate
)
from backend.services.auth_service import get_current_user, RoleChecker
from backend.routes.patient import MedicineHistoryResponse

router = APIRouter(prefix="/api/patient", tags=["Patient Portal"])

@router.get("/profile", response_model=PatientResponse)
def get_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient

@router.put("/profile", response_model=PatientResponse)
def update_patient_profile(
    profile_in: PatientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    update_data = profile_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(patient, key, value)
    
    db.commit()
    db.refresh(patient)
    return patient

@router.get("/dashboard")
def get_patient_portal_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    # 1. Active queues (Waiting or Calling or Skipped)
    active_queues = db.query(Queue).filter(
        Queue.patient_id == patient.id,
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).all()
    
    my_tokens = []
    for q in active_queues:
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

    # 2. Upcoming Scheduled Appointment
    upcoming_appointment = db.query(Appointment).filter(
        Appointment.patient_id == patient.id,
        Appointment.status == "Scheduled",
        Appointment.appointment_time >= datetime.datetime.utcnow()
    ).order_by(Appointment.appointment_time.asc()).first()

    # 3. Health Score calculation
    visit_count = db.query(func.count(Visit.id)).filter(Visit.patient_id == patient.id).scalar() or 0
    has_allergies = patient.allergies and patient.allergies.strip().lower() != "none"
    health_score = max(50, 100 - (visit_count * 5) - (15 if has_allergies else 0))

    return {
        "patient_name": patient.name,
        "patient_id": patient.id,
        "mobile_number": patient.mobile_number,
        "active_tokens": my_tokens,
        "upcoming_appointment": {
            "doctor_name": upcoming_appointment.doctor.name,
            "department_name": upcoming_appointment.doctor.department.name,
            "appointment_time": upcoming_appointment.appointment_time,
            "status": upcoming_appointment.status,
            "room_number": upcoming_appointment.doctor.room_number
        } if upcoming_appointment else None,
        "health_score": health_score
    }

@router.get("/appointments", response_model=List[AppointmentResponse])
def get_patient_portal_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Appointment).filter(Appointment.patient_id == patient.id).order_by(Appointment.appointment_time.desc()).all()

@router.get("/queue", response_model=List[QueueResponse])
def get_patient_portal_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Queue).filter(
        Queue.patient_id == patient.id,
        Queue.status.in_(["Waiting", "Calling", "Skipped"])
    ).all()

@router.get("/history", response_model=List[VisitResponse])
def get_patient_portal_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Visit).filter(Visit.patient_id == patient.id).order_by(Visit.visit_date.desc()).all()

@router.get("/prescriptions", response_model=List[MedicineHistoryResponse])
def get_patient_portal_prescriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    
    visits = db.query(Visit).filter(Visit.patient_id == patient.id).all()
    visit_ids = [v.id for v in visits]
    items = db.query(PrescriptionItem).filter(PrescriptionItem.visit_id.in_(visit_ids)).all() if visit_ids else []
    
    history = []
    for item in items:
        visit = next(v for v in visits if v.id == item.visit_id)
        history.append({
            "medicine_name": item.medicine_name,
            "dosage": item.dosage,
            "frequency": item.frequency,
            "duration": item.duration,
            "instructions": item.instructions,
            "prescribed_date": visit.visit_date,
            "doctor_name": visit.doctor.name if visit.doctor else "Unknown Doctor"
        })
    return history

@router.get("/lab-reports", response_model=List[MedicalReportResponse])
def get_patient_portal_lab_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(MedicalReport).filter(MedicalReport.patient_id == patient.id).order_by(MedicalReport.upload_date.desc()).all()

@router.get("/notifications", response_model=List[NotificationResponse])
def get_patient_portal_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Notification).filter(Notification.patient_id == patient.id).order_by(Notification.created_at.desc()).all()


class VitalsInput(BaseModel):
    age: int = Field(..., ge=0, le=120)
    bmi: float = Field(..., ge=5.0, le=100.0)
    blood_glucose: int = Field(..., ge=10, le=1000)
    heart_rate: int = Field(..., ge=20, le=300)
    temperature: float = Field(..., ge=90.0, le=115.0)
    systolic_bp: int = Field(..., ge=40, le=300)

class PatientPredictionRequest(BaseModel):
    vitals: VitalsInput
    symptoms: Union[Dict[str, int], List[str]]


from backend.machine_learning.disease_predictor import predict_disease
from backend.services.disease_knowledge import disease_knowledge_service

@router.get("/symptoms", response_model=List[str])
def get_all_symptoms(
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    return disease_knowledge_service.symptoms

@router.post("/predict")
def run_patient_prediction(
    request: PatientPredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    SYMPTOM_MODEL_MAPPING = {
        "frequent_urination": ["frequent urination", "frequent_urination"],
        "increased_thirst": ["increased thirst", "increased_thirst"],
        "family_history_diabetes": ["family history of diabetes", "family_history_diabetes"],
        "shortness_of_breath": ["shortness of breath", "shortness_of_breath"],
        "wheezing": ["wheezing"],
        "chest_tightness": ["chest tightness", "chest_tightness"],
        "coughing": ["cough", "coughing"],
        "throbbing_headache": ["headache", "throbbing headache", "throbbing_headache"],
        "nausea": ["nausea"],
        "light_sensitivity": ["light sensitivity", "light_sensitivity", "light/sound sensitivity"],
        "chest_pain": ["chest pain", "chest_pain"],
        "pain_radiating_arm_jaw": ["pain radiating to arm or jaw", "pain_radiating_arm_jaw", "pain radiating to left arm, shoulders, or jaw"],
        "sweating": ["sweating"],
        "sudden_numbness_weakness": ["sudden numbness or weakness", "sudden_numbness_weakness", "sudden numbness or unilateral weakness in limbs"],
        "trouble_speaking": ["trouble speaking", "trouble_speaking", "aphasia / difficulty speaking or slurring words"],
        "confusion": ["confusion", "sudden onset confusion or spatial disorientation"],
        "drooping_face": ["drooping face", "drooping_face", "facial drooping or asymmetry"],
        "shivering": ["shivering", "chills / shivering / rigors"],
        "rapid_breathing": ["rapid breathing", "rapid_breathing", "rapid respiration rate (tachypnea)"]
    }

    # Map input symptoms
    mapped_symptoms = {}
    for key in SYMPTOM_MODEL_MAPPING.keys():
        mapped_symptoms[key] = 0

    selected_symptom_list = []
    if isinstance(request.symptoms, list):
        selected_symptom_list = request.symptoms
        for sym_name in request.symptoms:
            normalized_name = str(sym_name).strip().lower()
            for key, aliases in SYMPTOM_MODEL_MAPPING.items():
                if normalized_name == key or normalized_name in [a.lower() for a in aliases]:
                    mapped_symptoms[key] = 1
    else:
        # If it is a dictionary, use it directly
        for key in SYMPTOM_MODEL_MAPPING.keys():
            val = int(request.symptoms.get(key, 0))
            mapped_symptoms[key] = val
            if val == 1:
                selected_symptom_list.append(key.replace("_", " ").title())

    vitals_dict = {
        "age": request.vitals.age,
        "bmi": request.vitals.bmi,
        "blood_glucose": request.vitals.blood_glucose,
        "heart_rate": request.vitals.heart_rate,
        "temperature": request.vitals.temperature,
        "systolic_bp": request.vitals.systolic_bp
    }

    # Run prediction
    try:
        pred_res = predict_disease(vitals_dict, mapped_symptoms)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service failure: {str(e)}")

    # Lookup details from cached service
    disease_info = disease_knowledge_service.get_disease_info(pred_res["predicted_disease"])

    # Save to history table
    new_log = PredictionHistory(
        patient_id=patient.id,
        predicted_disease=pred_res["predicted_disease"],
        confidence=pred_res["confidence_score"],
        risk_level=pred_res["risk_level"],
        symptoms=json.dumps(selected_symptom_list),
        prediction_time=datetime.datetime.utcnow(),
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    return {
        "id": new_log.id,
        "predicted_disease": pred_res["predicted_disease"],
        "confidence_score": pred_res["confidence_score"],
        "risk_level": pred_res["risk_level"],
        "symptoms": selected_symptom_list,
        "prediction_time": new_log.prediction_time,
        "created_at": new_log.created_at,
        "details": disease_info
    }

@router.get("/predictions")
def get_my_predictions(
    search: Optional[str] = None,
    risk_level: Optional[str] = None,
    sort_by: str = "prediction_time",  # prediction_time, confidence
    sort_order: str = "desc",          # asc, desc
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    
    query = db.query(PredictionHistory).filter(PredictionHistory.patient_id == patient.id)
    
    if search:
        query = query.filter(PredictionHistory.predicted_disease.ilike(f"%{search}%"))
    if risk_level:
        query = query.filter(PredictionHistory.risk_level.ilike(risk_level))
        
    sort_attr = getattr(PredictionHistory, sort_by, PredictionHistory.prediction_time)
    if sort_order == "desc":
        query = query.order_by(sort_attr.desc())
    else:
        query = query.order_by(sort_attr.asc())
        
    results = query.all()
    
    predictions = []
    for r in results:
        try:
            syms = json.loads(r.symptoms)
        except Exception:
            syms = []
            
        predictions.append({
            "id": r.id,
            "predicted_disease": r.predicted_disease,
            "confidence": r.confidence,
            "risk_level": r.risk_level,
            "symptoms": syms,
            "prediction_time": r.prediction_time,
            "created_at": r.created_at,
            "consultation_status": "Scheduled" if db.query(Appointment).filter(
                Appointment.patient_id == patient.id,
                Appointment.status == "Scheduled",
                Appointment.appointment_time >= r.prediction_time
            ).first() else "Not Consulted"
        })
        
    return predictions

@router.get("/predictions/{prediction_id}")
def get_prediction_detail(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient"]))
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    prediction = db.query(PredictionHistory).filter(
        PredictionHistory.id == prediction_id,
        PredictionHistory.patient_id == patient.id
    ).first()
    
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction log not found")
        
    try:
        syms = json.loads(prediction.symptoms)
    except Exception:
        syms = []
        
    details = disease_knowledge_service.get_disease_info(prediction.predicted_disease)
    
    return {
        "id": prediction.id,
        "predicted_disease": prediction.predicted_disease,
        "confidence": prediction.confidence,
        "risk_level": prediction.risk_level,
        "symptoms": syms,
        "prediction_time": prediction.prediction_time,
        "created_at": prediction.created_at,
        "details": details
    }
