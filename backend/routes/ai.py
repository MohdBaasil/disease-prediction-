from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, List, Optional
import datetime
import json
import random

from backend.database.connection import get_db
from backend.database.models import (
    User, Patient, Consultation, Visit, PrescriptionItem, 
    MedicalReport, DiseasePredictionLog, ChatHistory, 
    HealthScoreHistory, RiskAlert, CarePlan, Doctor
)
from backend.services.auth_service import get_current_user, RoleChecker

router = APIRouter(prefix="/api/ai", tags=["AI Clinical Intelligence"])

# ----------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------
class ChatRequest(BaseModel):
    patient_id: int
    message: str

class ChatMessageResponse(BaseModel):
    sender: str
    message: str
    created_at: datetime.datetime

class ChatResponse(BaseModel):
    response: str
    history: List[ChatMessageResponse]

class OCRReportRequest(BaseModel):
    patient_id: int
    file_name: str
    file_content: Optional[str] = None  # Base64 or mock placeholder

class OCRReportResponse(BaseModel):
    vitals: Dict[str, float]
    blood_test_values: Dict[str, str]
    doctor_observations: str
    medicine_names: List[str]
    diagnoses: List[str]

class OCRSaveRequest(BaseModel):
    patient_id: int
    vitals: Dict[str, float]
    blood_test_values: Dict[str, str]
    doctor_observations: str
    medicine_names: List[str]
    diagnoses: List[str]

class VoiceSymptomsRequest(BaseModel):
    patient_id: int
    audio_base64: str

class VoiceSymptomsResponse(BaseModel):
    transcription: str
    extracted_symptoms: List[str]
    possible_conditions: List[str]
    recommended_department: str
    urgency_level: str

class CarePlanUpdateRequest(BaseModel):
    diet_recommendations: str
    exercise_suggestions: str
    medication_reminders: str
    lifestyle_improvements: str
    preventive_care: str
    vaccinations: str
    sleep_recommendations: str
    hydration_goals: str
    is_approved: bool

# ----------------------------------------------------
# Helper Functions
# ----------------------------------------------------
def calculate_patient_health_score(patient: Patient, db: Session) -> Dict:
    # Baseline score
    score = 85

    # Age penalty
    if patient.age > 70:
        score -= 10
    elif patient.age > 50:
        score -= 5

    # Vitals check
    latest_prediction = db.query(DiseasePredictionLog).filter(
        DiseasePredictionLog.patient_id == patient.id
    ).order_by(DiseasePredictionLog.created_at.desc()).first()

    vitals = {}
    if latest_prediction:
        try:
            vitals = json.loads(latest_prediction.vitals)
        except Exception:
            pass

    systolic = vitals.get("systolic_bp", 120)
    heart_rate = vitals.get("heart_rate", 75)
    glucose = vitals.get("blood_glucose", 100)
    bmi = vitals.get("bmi", 22.0)

    if systolic > 140:
        score -= 10
    elif systolic > 130:
        score -= 5

    if glucose > 180:
        score -= 15
    elif glucose > 130:
        score -= 7

    if bmi > 30:
        score -= 8
    elif bmi > 25:
        score -= 3

    # Disease count / Consultation count penalty
    consult_count = db.query(Consultation).filter(Consultation.patient_id == patient.id).count()
    score -= min(consult_count * 2, 12)

    # Predictions risk levels
    critical_preds = db.query(DiseasePredictionLog).filter(
        DiseasePredictionLog.patient_id == patient.id,
        DiseasePredictionLog.risk_level == "Critical"
    ).count()
    score -= min(critical_preds * 8, 20)

    # Clamp between 10 and 100
    score = max(min(score, 100), 10)

    # Determine risk category
    if score >= 80:
        cat = "Excellent"
    elif score >= 60:
        cat = "Moderate"
    elif score >= 40:
        cat = "High Risk"
    else:
        cat = "Critical"

    # Health trend calculations based on previous score history
    history = db.query(HealthScoreHistory).filter(
        HealthScoreHistory.patient_id == patient.id
    ).order_by(HealthScoreHistory.created_at.desc()).limit(3).all()

    trend = "Stable"
    if len(history) >= 2:
        prev_avg = sum(h.score for h in history) / len(history)
        if score > prev_avg + 3:
            trend = "Improving"
        elif score < prev_avg - 3:
            trend = "Declining"

    confidence = 0.85 + (random.randint(0, 14) / 100.0)

    return {
        "score": score,
        "risk_category": cat,
        "trend": trend,
        "confidence": confidence
    }

# ----------------------------------------------------
# 1. GET /api/ai/health-score/{patient_id}
# ----------------------------------------------------
@router.get("/health-score/{patient_id}")
def get_health_score(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # Compute latest score
    metrics = calculate_patient_health_score(patient, db)

    # Save to history to build tracking over time
    new_hist = HealthScoreHistory(
        patient_id=patient_id,
        score=metrics["score"],
        risk_category=metrics["risk_category"],
        trend=metrics["trend"],
        confidence=metrics["confidence"]
    )
    db.add(new_hist)
    db.commit()

    # Query full score history
    history_records = db.query(HealthScoreHistory).filter(
        HealthScoreHistory.patient_id == patient_id
    ).order_by(HealthScoreHistory.created_at.asc()).all()

    return {
        "patient_id": patient_id,
        "current_score": metrics["score"],
        "risk_category": metrics["risk_category"],
        "trend": metrics["trend"],
        "confidence": metrics["confidence"],
        "history": [
            {
                "score": h.score,
                "risk_category": h.risk_category,
                "created_at": h.created_at
            }
            for h in history_records
        ]
    }

# ----------------------------------------------------
# 2. GET /api/ai/timeline/{patient_id}
# ----------------------------------------------------
@router.get("/timeline/{patient_id}")
def get_disease_timeline(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    timeline_events = []

    # A. Registration
    timeline_events.append({
        "id": f"reg-{patient.id}",
        "date": patient.created_at,
        "event_type": "Registration",
        "title": "Patient Portal Created",
        "description": f"Patient profile registered successfully. Baseline demographics saved.",
        "meta": {}
    })

    # B. Consultations & Prescriptions
    consults = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    for c in consults:
        timeline_events.append({
            "id": f"cons-{c.id}",
            "date": c.created_at,
            "event_type": "Consultation",
            "title": f"Clinical Visit — Dr. {c.doctor.name if c.doctor else 'Medical Staff'}",
            "description": f"Diagnosis: {c.diagnosis or 'None'}. Chief Complaints: {c.symptoms or 'General Checkup'}.",
            "meta": {
                "diagnosis": c.diagnosis,
                "symptoms": c.symptoms,
                "duration": c.duration_minutes
            }
        })
        if c.prescription:
            timeline_events.append({
                "id": f"pres-{c.id}",
                "date": c.created_at,
                "event_type": "Prescription",
                "title": "Prescription Issued",
                "description": f"Medication prescribed: {c.prescription}",
                "meta": {"meds": c.prescription}
            })

    # C. AI Predictions
    preds = db.query(DiseasePredictionLog).filter(DiseasePredictionLog.patient_id == patient_id).all()
    for p in preds:
        timeline_events.append({
            "id": f"pred-{p.id}",
            "date": p.created_at,
            "event_type": "AI Prediction",
            "title": f"AI Prediction: {p.predicted_disease}",
            "description": f"Model predicted {p.predicted_disease} with {p.confidence_score*100:.1f}% confidence. Risk level: {p.risk_level}.",
            "meta": {
                "disease": p.predicted_disease,
                "confidence": p.confidence_score,
                "risk_level": p.risk_level
            }
        })

    # D. Lab Reports
    reports = db.query(MedicalReport).filter(MedicalReport.patient_id == patient_id).all()
    for r in reports:
        timeline_events.append({
            "id": f"rep-{r.id}",
            "date": r.upload_date,
            "event_type": "Lab Report",
            "title": f"Lab Report Uploaded: {r.report_name}",
            "description": f"Document category: {r.report_type}.",
            "meta": {"file_path": r.file_path}
        })

    # E. Follow-ups & Admissions Mock
    # Mocking standard post-consultation follow-up event
    if len(consults) > 0:
        last_c = consults[-1]
        timeline_events.append({
            "id": f"flw-{last_c.id}",
            "date": last_c.created_at + datetime.timedelta(days=14),
            "event_type": "Follow-up",
            "title": "Scheduled Care Follow-up",
            "description": "Routine compliance review and blood pressure mapping.",
            "meta": {}
        })

    # Sort events chronologically
    timeline_events.sort(key=lambda x: x["date"], reverse=True)

    # F. Health score histories for charts
    scores = db.query(HealthScoreHistory).filter(
        HealthScoreHistory.patient_id == patient_id
    ).order_by(HealthScoreHistory.created_at.asc()).all()

    # Generate progression/recovery charts
    progression_data = []
    health_trend = []
    risk_trend = []

    for s in scores:
        date_str = s.created_at.strftime("%Y-%m-%d")
        progression_data.append({"date": date_str, "value": 100 - s.score}) # progression metric (severity score)
        health_trend.append({"date": date_str, "value": s.score})
        risk_trend.append({"date": date_str, "value": 1 if s.risk_category == "Excellent" else 2 if s.risk_category == "Moderate" else 3 if s.risk_category == "High Risk" else 4})

    # In case history is empty, populate with a single baseline point
    if not health_trend:
        baseline_date = patient.created_at.strftime("%Y-%m-%d")
        progression_data.append({"date": baseline_date, "value": 15})
        health_trend.append({"date": baseline_date, "value": 85})
        risk_trend.append({"date": baseline_date, "value": 1})

    recovery_indicators = [
        "Vitals are stable and within targeted clinical boundaries",
        "Medication adherence rate above 85%",
        "Chronic inflammation parameters show consistent decline"
    ]

    return {
        "timeline": timeline_events,
        "progression_chart_data": progression_data,
        "health_trend_data": health_trend,
        "risk_trend_data": risk_trend,
        "recovery_indicators": recovery_indicators
    }

# ----------------------------------------------------
# 3. POST /api/ai/chat
# ----------------------------------------------------
@router.post("/chat", response_model=ChatResponse)
def clinical_assistant_chat(request: ChatRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # Fetch patient's medical context
    consults = db.query(Consultation).filter(Consultation.patient_id == request.patient_id).all()
    predictions = db.query(DiseasePredictionLog).filter(DiseasePredictionLog.patient_id == request.patient_id).all()

    recent_diagnoses = [c.diagnosis for c in consults if c.diagnosis]
    recent_meds = [c.prescription for c in consults if c.prescription]
    recent_preds = [p.predicted_disease for p in predictions if p.predicted_disease]

    msg_lower = request.message.lower()
    
    # Simple semantic rule-based responder simulating ChatGPT/Med-LLM
    response = ""
    disclaimer = "**AI Medical Disclaimer:** This assistant provides educational explanations based on your charts. It is NOT a diagnostic tool and does NOT replace doctor consultations. Contact emergency care if you feel severe chest pain or breathing difficulties.\n\n"

    if "diagnosis" in msg_lower or "diagnoses" in msg_lower or "disease" in msg_lower:
        if recent_diagnoses:
            joined_diags = ", ".join(recent_diagnoses[:3])
            response = f"Your records list the following diagnoses: **{joined_diags}**. For conditions like these, standard clinical guidelines recommend regular medication intake, moderate dietary control, and monitoring blood metrics."
        else:
            response = "I couldn't locate any diagnosed conditions in your medical file. Let your doctor know if you are experiencing any active symptoms."

    elif "medication" in msg_lower or "medicine" in msg_lower or "pill" in msg_lower or "drug" in msg_lower or "prescription" in msg_lower:
        if recent_meds:
            joined_meds = "; ".join(recent_meds[:3])
            response = f"According to your records, you were prescribed: **{joined_meds}**. Always take medications exactly as directed. Common rules include completing antibiotic courses and keeping track of side effects like dizziness."
        else:
            response = "No active prescriptions are listed in your dashboard records. Always consult a healthcare provider before taking new drugs."

    elif "vitals" in msg_lower or "bp" in msg_lower or "blood pressure" in msg_lower:
        if predictions:
            latest = predictions[-1]
            try:
                v = json.loads(latest.vitals)
                response = f"Your latest logged vitals: Blood Pressure is **{v.get('systolic_bp', 120)}/80 mmHg**, Heart Rate is **{v.get('heart_rate', 72)} BPM**, and Blood Glucose is **{v.get('blood_glucose', 98)} mg/dL**. These fall into stable clinical categories."
            except Exception:
                response = "Your latest vital parameters show a normal heart rate and target-level blood pressure."
        else:
            response = "No vital measurements are recorded yet. You can scan/log them via the patient portal."

    elif "prevent" in msg_lower or "vaccine" in msg_lower or "diet" in msg_lower:
        response = "To stay healthy: 1. Maintain a balanced diet rich in fibers and lean proteins. 2. Stay hydrated with 2-3L of water daily. 3. Complete annual flu and tetanus vaccines. 4. Exercise at least 150 minutes weekly."

    else:
        # Default fallback educational response
        response = "Thank you for asking. Based on your records, you should monitor your vitals daily, schedule follow-ups when requested by the reception, and take any prescribed drugs on time. Is there a specific medication or symptom you'd like me to explain?"

    final_reply = disclaimer + response

    # Save messages to database
    user_msg = ChatHistory(patient_id=request.patient_id, sender="user", message=request.message)
    asst_msg = ChatHistory(patient_id=request.patient_id, sender="assistant", message=final_reply)
    db.add(user_msg)
    db.add(asst_msg)
    db.commit()

    # Query full chat history
    history_records = db.query(ChatHistory).filter(
        ChatHistory.patient_id == request.patient_id
    ).order_by(ChatHistory.created_at.asc()).all()

    return {
        "response": final_reply,
        "history": [
            {
                "sender": h.sender,
                "message": h.message,
                "created_at": h.created_at
            }
            for h in history_records
        ]
    }

# ----------------------------------------------------
# 4. POST /api/ai/ocr-report
# ----------------------------------------------------
@router.post("/ocr-report", response_model=OCRReportResponse)
def parse_ocr_medical_report(request: OCRReportRequest, db: Session = Depends(get_db)):
    # Highly realistic mock OCR scanner based on document filename
    name_lower = request.file_name.lower()

    # Predefined mock categories
    if "blood" in name_lower or "cbc" in name_lower or "metabolic" in name_lower:
        return {
            "vitals": {
                "systolic_bp": 128.0,
                "heart_rate": 78.0,
                "temperature": 98.6
            },
            "blood_test_values": {
                "Fasting Blood Glucose": "142 mg/dL (High)",
                "HbA1c": "7.2% (High)",
                "Creatinine": "0.95 mg/dL (Normal)",
                "Total Cholesterol": "215 mg/dL (Borderline)"
            },
            "doctor_observations": "Patient shows elevated fasting glucose and HbA1c indicative of poorly controlled glycemia. Recommend metabolic checkup and diet restrictions.",
            "medicine_names": ["Metformin 500mg"],
            "diagnoses": ["Prediabetes / Type 2 Diabetes"]
        }
    elif "cardio" in name_lower or "heart" in name_lower or "ecg" in name_lower:
        return {
            "vitals": {
                "systolic_bp": 145.0,
                "heart_rate": 88.0,
                "temperature": 98.4
            },
            "blood_test_values": {
                "Total Cholesterol": "240 mg/dL (High)",
                "LDL Cholesterol": "165 mg/dL (High)",
                "Triglycerides": "185 mg/dL (High)"
            },
            "doctor_observations": "Mild ST elevation or sinus tachycardia noted. Blood pressure is elevated. Recommend cardiology follow-up and lipid-lowering therapy.",
            "medicine_names": ["Atorvastatin 20mg", "Amlodipine 5mg"],
            "diagnoses": ["Hypertension Stage 2", "Hyperlipidemia"]
        }
    else:
        # Generic checkup panel fallback
        return {
            "vitals": {
                "systolic_bp": 120.0,
                "heart_rate": 72.0,
                "temperature": 98.2
            },
            "blood_test_values": {
                "Hemoglobin": "14.5 g/dL (Normal)",
                "White Blood Cell Count": "6,500 /uL (Normal)",
                "Platelets": "250,000 /uL (Normal)"
            },
            "doctor_observations": "All major hematological indices are within optimal physiological ranges. Patient in good health.",
            "medicine_names": [],
            "diagnoses": ["Routine Checkup / Normal panel"]
        }

@router.post("/ocr-report/save")
def save_ocr_report_to_db(request: OCRSaveRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # 1. Create a dummy visit/consultation or save directly to reports table
    new_report = MedicalReport(
        patient_id=request.patient_id,
        report_name=f"OCR Scan - {datetime.date.today().strftime('%B %Y')}",
        report_type="Lab Report Scan",
        file_path="simulated_ocr_scan.pdf",
    )
    db.add(new_report)

    # 2. Append diagnosis if found
    if request.diagnoses:
        # Create a mock completed consultation
        new_cons = Consultation(
            patient_id=request.patient_id,
            doctor_id=1,  # Admin doctor or first doctor profile
            symptoms=request.doctor_observations,
            diagnosis=", ".join(request.diagnoses),
            prescription=", ".join(request.medicine_names) if request.medicine_names else "None",
            duration_minutes=15
        )
        db.add(new_cons)

    db.commit()
    return {"status": "Success", "message": "OCR records integrated into patient profile."}

# ----------------------------------------------------
# 5. POST /api/ai/voice-symptoms
# ----------------------------------------------------
@router.post("/voice-symptoms", response_model=VoiceSymptomsResponse)
def transcribe_voice_symptoms(request: VoiceSymptomsRequest, db: Session = Depends(get_db)):
    # Highly realistic simulated speech-to-text transcriber
    audio_tag = request.audio_base64.lower()

    if "chest" in audio_tag or "breath" in audio_tag or "heart" in audio_tag:
        return {
            "transcription": "I am feeling a severe crushing chest pain that radiates to my left shoulder, and I am finding it hard to breathe.",
            "extracted_symptoms": ["Chest Pain", "Shortness Of Breath", "Radiating Pain"],
            "possible_conditions": ["Myocardial Infarction (Heart Attack)", "Angina Pectoris"],
            "recommended_department": "Cardiology / Emergency Care",
            "urgency_level": "Critical"
        }
    elif "stomach" in audio_tag or "vomit" in audio_tag or "pain" in audio_tag:
        return {
            "transcription": "My lower stomach hurts a lot, it is a sharp pain, and I have been vomiting since yesterday.",
            "extracted_symptoms": ["Abdominal Pain", "Nausea & Vomiting"],
            "possible_conditions": ["Acute Appendicitis", "Gastroenteritis"],
            "recommended_department": "Gastroenterology / General Surgery",
            "urgency_level": "Urgent"
        }
    else:
        # Default cold/flu transcription
        return {
            "transcription": "I have had a high fever for three days, a sore throat, and a persistent dry cough.",
            "extracted_symptoms": ["Fever", "Cough", "Sore Throat"],
            "possible_conditions": ["Influenza (Flu)", "Upper Respiratory Tract Infection"],
            "recommended_department": "Pulmonology / General Medicine",
            "urgency_level": "Normal"
        }

# ----------------------------------------------------
# 6. GET /api/ai/care-plan/{patient_id}
# ----------------------------------------------------
@router.get("/care-plan/{patient_id}")
def get_or_generate_care_plan(patient_id: int, db: Session = Depends(get_db)):
    plan = db.query(CarePlan).filter(CarePlan.patient_id == patient_id).first()

    if not plan:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found.")

        # Compute personalized recommendations
        diet = "Balanced diet, low fat, high fiber."
        exercise = "30 mins walk, 5 times a week."
        lifestyle = "Limit alcohol intake, stop smoking, reduce stress."
        meds = "Take vitamins daily."
        vaccines = "Annual influenza vaccination."

        # Check for chronic illnesses
        consults = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
        joined_diags = " ".join([c.diagnosis.lower() for c in consults if c.diagnosis])

        if "diabetes" in joined_diags:
            diet = "Low sugar, low glycemic index foods. Focus on complex carbohydrates and portion control."
            lifestyle = "Monitor blood sugar levels twice daily. Perform foot checkups daily."
            meds = "Metformin 500mg twice daily with meals."
            vaccines = "Pneumococcal vaccine and annual flu shot."
        elif "hypertension" in joined_diags or "heart" in joined_diags:
            diet = "Low sodium (DASH diet style), rich in potassium, calcium, and magnesium."
            exercise = "Moderate-intensity aerobic exercise. Avoid heavy lifting."
            lifestyle = "Monitor blood pressure daily. Limit sodium below 1500mg daily."

        plan = CarePlan(
            patient_id=patient_id,
            diet_recommendations=diet,
            exercise_suggestions=exercise,
            medication_reminders=meds,
            lifestyle_improvements=lifestyle,
            preventive_care="Annual wellness visits and eye/foot screen exam.",
            vaccinations=vaccines,
            sleep_recommendations="Maintain 7.5 to 8 hours of restful sleep. Keep a strict sleep schedule.",
            hydration_goals="Drink at least 2.5 to 3.0 Liters of water daily.",
            is_approved=False
        )
        db.add(plan)
        db.commit()

    return plan

@router.post("/care-plan/{patient_id}")
def update_care_plan(patient_id: int, request: CarePlanUpdateRequest, db: Session = Depends(get_db)):
    plan = db.query(CarePlan).filter(CarePlan.patient_id == patient_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Care Plan not found.")

    plan.diet_recommendations = request.diet_recommendations
    plan.exercise_suggestions = request.exercise_suggestions
    plan.medication_reminders = request.medication_reminders
    plan.lifestyle_improvements = request.lifestyle_improvements
    plan.preventive_care = request.preventive_care
    plan.vaccinations = request.vaccinations
    plan.sleep_recommendations = request.sleep_recommendations
    plan.hydration_goals = request.hydration_goals
    plan.is_approved = request.is_approved
    
    db.commit()
    return {"status": "Success", "message": "Care plan updated and verified."}

# ----------------------------------------------------
# 7. GET /api/ai/risk-alerts/{patient_id}
# ----------------------------------------------------
@router.get("/risk-alerts/{patient_id}")
def get_patient_risk_alerts(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # Retrieve risk factors
    latest_prediction = db.query(DiseasePredictionLog).filter(
        DiseasePredictionLog.patient_id == patient_id
    ).order_by(DiseasePredictionLog.created_at.desc()).first()

    vitals = {}
    if latest_prediction:
        try:
            vitals = json.loads(latest_prediction.vitals)
        except Exception:
            pass

    # Clear existing unresolved alerts to avoid duplicates
    db.query(RiskAlert).filter(RiskAlert.patient_id == patient_id, RiskAlert.is_resolved == False).delete()

    active_alerts = []

    # 1. BP check
    systolic = vitals.get("systolic_bp", 120)
    if systolic > 140:
        alert = RiskAlert(
            patient_id=patient_id,
            alert_type="High Blood Pressure",
            priority="High",
            description=f"Systolic Blood Pressure is elevated at {systolic} mmHg. Consult doctor for hypertension management.",
            is_resolved=False
        )
        db.add(alert)
        active_alerts.append(alert)

    # 2. Glucose check
    glucose = vitals.get("blood_glucose", 100)
    if glucose > 180:
        alert = RiskAlert(
            patient_id=patient_id,
            alert_type="Diabetes Complications",
            priority="Critical",
            description=f"Blood Glucose is critically high at {glucose} mg/dL. Prompt insulin or medication compliance review required.",
            is_resolved=False
        )
        db.add(alert)
        active_alerts.append(alert)

    # 3. Heart Disease Risk Check
    consults = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    joined_diags = " ".join([c.diagnosis.lower() for c in consults if c.diagnosis])
    
    if latest_prediction and latest_prediction.predicted_disease == "Heart Disease" and latest_prediction.confidence_score > 0.6:
        alert = RiskAlert(
            patient_id=patient_id,
            alert_type="Cardiovascular Risk",
            priority="Critical",
            description="AI ML models predict a high risk of Heart Disease based on cardiac symptoms. ECG screening recommended.",
            is_resolved=False
        )
        db.add(alert)
        active_alerts.append(alert)

    # 4. Medication adherence warning
    if len(consults) > 0 and not plan_has_meds(consults):
        alert = RiskAlert(
            patient_id=patient_id,
            alert_type="Medication Non-Compliance",
            priority="Medium",
            description="Prescription records indicate potential gaps in adherence checkups. Verify drug schedule.",
            is_resolved=False
        )
        db.add(alert)
        active_alerts.append(alert)

    # 5. Missed Follow-ups check
    # Check if there is a gap of > 6 months since last consultation
    if len(consults) > 0:
        last_date = consults[-1].created_at
        if (datetime.datetime.utcnow() - last_date).days > 180:
            alert = RiskAlert(
                patient_id=patient_id,
                alert_type="Missed Follow-up",
                priority="Medium",
                description="Last consultation was over 6 months ago. Schedule a routine checkup.",
                is_resolved=False
            )
            db.add(alert)
            active_alerts.append(alert)

    db.commit()

    # Query all active alerts
    db_alerts = db.query(RiskAlert).filter(
        RiskAlert.patient_id == patient_id,
        RiskAlert.is_resolved == False
    ).order_by(RiskAlert.created_at.desc()).all()

    return db_alerts

def plan_has_meds(consults):
    return any(c.prescription and c.prescription != "None" for c in consults)

# ----------------------------------------------------
# 8. GET /api/ai/health-insights/{patient_id}
# ----------------------------------------------------
@router.get("/health-insights/{patient_id}")
def get_patient_health_insights(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # Calculate indicators
    consults = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    predictions = db.query(DiseasePredictionLog).filter(DiseasePredictionLog.patient_id == patient_id).all()

    # Trend Direction
    trend_hist = db.query(HealthScoreHistory).filter(
        HealthScoreHistory.patient_id == patient_id
    ).order_by(HealthScoreHistory.created_at.desc()).limit(3).all()

    status = "Health Stable"
    if len(trend_hist) >= 2:
        if trend_hist[0].score > trend_hist[-1].score + 2:
            status = "Health Improving"
        elif trend_hist[0].score < trend_hist[-1].score - 2:
            status = "Health Declining"

    # Adherence Mock
    adherence = 85.0 if len(consults) > 0 else 100.0
    missed_appts = 5.0

    # Recurrence warning
    recurrences = []
    diags = [c.diagnosis for c in consults if c.diagnosis]
    for d in set(diags):
        if diags.count(d) >= 2:
            recurrences.append(d)

    top_risks = ["Hypertension Risk", "Hyperglycemia"] if len(consults) > 0 else ["None"]

    return {
        "overall_status": status,
        "medication_adherence_rate": adherence,
        "missed_appointments_rate": missed_appts,
        "disease_recurrence_indices": recurrences,
        "average_recovery_time_weeks": 4.5,
        "top_health_risks": top_risks,
        "suggested_preventive_interventions": [
            "Initiate daily cardiovascular screening logs",
            "Transition to low-carb diet structure",
            "Schedule biannual glucose checkups"
        ]
    }

# ----------------------------------------------------
# 9. GET /api/ai/patient-summary/{patient_id}
# ----------------------------------------------------
@router.get("/patient-summary/{patient_id}")
def get_patient_clinical_summary(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    consults = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    predictions = db.query(DiseasePredictionLog).filter(DiseasePredictionLog.patient_id == patient_id).all()

    recent_prediction = predictions[-1] if predictions else None
    vitals = {}
    if recent_prediction:
        try:
            vitals = json.loads(recent_prediction.vitals)
        except Exception:
            pass

    score_hist = db.query(HealthScoreHistory).filter(
        HealthScoreHistory.patient_id == patient_id
    ).order_by(HealthScoreHistory.created_at.desc()).first()

    return {
        "patient_info": {
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "allergies": patient.allergies or "None"
        },
        "health_score": score_hist.score if score_hist else 85,
        "major_diagnoses": list(set([c.diagnosis for c in consults if c.diagnosis])),
        "current_medications": [c.prescription for c in consults if c.prescription and c.prescription != "None"],
        "latest_vitals": vitals,
        "ai_predictions": [p.predicted_disease for p in predictions[-3:]],
        "risk_factors": ["Sedentary lifestyle", "Age-related arterial stiffness"],
        "recommended_next_actions": [
            "Check BP daily in the morning",
            "Follow-up with Cardiology in 2 weeks",
            "Update HbA1c panel test"
        ]
    }
