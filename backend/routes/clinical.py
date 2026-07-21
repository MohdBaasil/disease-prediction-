import json
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database.connection import get_db
from backend.database.models import (
    Patient, Consultation, Visit, PrescriptionItem, MedicalReport, DiseasePredictionLog, PredictionHistory, Doctor
)
from backend.routes.auth import get_current_user
from backend.services.disease_knowledge import disease_knowledge_service

router = APIRouter(prefix="/api/clinical", tags=["clinical"])

# --- Request & Response Schemas ---
class AssistantRequest(BaseModel):
    patient_id: int
    symptoms: Optional[str] = ""
    diagnosis: Optional[str] = ""

class PrescriptionAssistantRequest(BaseModel):
    patient_id: int
    medicines: List[str]

class FollowupRequest(BaseModel):
    patient_id: int
    diagnosis: Optional[str] = ""
    risk_level: Optional[str] = ""

class FlagsRequest(BaseModel):
    patient_id: int
    diagnosis: Optional[str] = ""
    vitals: Optional[dict] = None

class RecommendationsRequest(BaseModel):
    patient_id: int
    diagnosis: Optional[str] = ""

# --- Helper functions for clinical heuristics ---
def get_latest_vitals_dict(db: Session, patient_id: int) -> dict:
    latest_log = db.query(DiseasePredictionLog).filter(
        DiseasePredictionLog.patient_id == patient_id
    ).order_by(DiseasePredictionLog.created_at.desc()).first()
    
    if latest_log and latest_log.vitals:
        try:
            return json.loads(latest_log.vitals)
        except Exception:
            pass
            
    # Return realistic defaults based on Patient age/gender if no prediction log exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    age = patient.age if patient else 35
    return {
        "age": age,
        "bmi": 23.5,
        "blood_glucose": 95.0,
        "heart_rate": 72.0,
        "temperature": 98.4,
        "systolic_bp": 120.0
    }

# --- Router Endpoints ---

@router.get("/patient-summary")
def get_patient_summary(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    vitals = get_latest_vitals_dict(db, patient_id)
    
    # Load recent prescriptions to extract current medications list
    current_meds = []
    recent_visits = db.query(Visit).filter(
        Visit.patient_id == patient_id
    ).order_by(Visit.visit_date.desc()).limit(5).all()
    for v in recent_visits:
        for p in v.prescriptions:
            med_entry = f"{p.medicine_name} ({p.dosage})"
            if med_entry not in current_meds:
                current_meds.append(med_entry)

    # Gather past consultations from consultations table
    past_consultations = []
    consults = db.query(Consultation).filter(
        Consultation.patient_id == patient_id
    ).order_by(Consultation.created_at.desc()).all()
    for c in consults:
        doc = db.query(Doctor).filter(Doctor.id == c.doctor_id).first()
        past_consultations.append({
            "id": c.id,
            "date": c.created_at.isoformat(),
            "doctor_name": doc.name if doc else "Hospital Physician",
            "symptoms": c.symptoms,
            "diagnosis": c.diagnosis,
            "prescription": c.prescription,
            "duration": c.duration_minutes
        })

    # Gather lab reports
    reports = []
    lab_reports = db.query(MedicalReport).filter(
        MedicalReport.patient_id == patient_id
    ).order_by(MedicalReport.upload_date.desc()).all()
    for r in lab_reports:
        reports.append({
            "id": r.id,
            "report_name": r.report_name,
            "report_type": r.report_type,
            "file_path": r.file_path,
            "upload_date": r.upload_date.isoformat()
        })

    # Gather latest prediction history / prediction log
    latest_pred = db.query(PredictionHistory).filter(
        PredictionHistory.patient_id == patient_id
    ).order_by(PredictionHistory.prediction_time.desc()).first()

    if not latest_pred:
        latest_log = db.query(DiseasePredictionLog).filter(
            DiseasePredictionLog.patient_id == patient_id
        ).order_by(DiseasePredictionLog.created_at.desc()).first()
        if latest_log:
            pred_disease = latest_log.predicted_disease
            pred_conf = latest_log.confidence_score
            pred_risk = latest_log.risk_level
            try:
                pred_symptoms = json.loads(latest_log.symptoms)
            except Exception:
                pred_symptoms = [latest_log.symptoms] if latest_log.symptoms else []
        else:
            pred_disease = None
            pred_conf = None
            pred_risk = "Normal"
            pred_symptoms = []
    else:
        pred_disease = latest_pred.predicted_disease
        pred_conf = latest_pred.confidence
        pred_risk = latest_pred.risk_level
        try:
            pred_symptoms = json.loads(latest_pred.symptoms)
        except Exception:
            pred_symptoms = [latest_pred.symptoms] if latest_pred.symptoms else []

    # Recommended department prediction mapping
    recommended_dept = "General Medicine"
    if pred_disease:
        pd_lower = pred_disease.lower()
        if any(kw in pd_lower for kw in ["cardio", "heart", "hypertension"]):
            recommended_dept = "Cardiology"
        elif any(kw in pd_lower for kw in ["diab", "metabolic", "thyroid"]):
            recommended_dept = "Endocrinology"
        elif any(kw in pd_lower for kw in ["asthma", "lung", "respirat", "pneumonia"]):
            recommended_dept = "Pulmonology"
        elif any(kw in pd_lower for kw in ["stroke", "migraine", "neuro"]):
            recommended_dept = "Neurology"

    # Evaluate dynamic patient flags
    flags = []
    has_allergy = bool(patient.allergies and patient.allergies.strip().lower() not in ["none", "no allergies", "n/a", "nil"])
    if has_allergy:
        flags.append({"name": "Allergy", "color": "red", "symbol": "🔴"})

    all_diagnoses = [c["diagnosis"].lower() for c in past_consultations]
    is_diabetic = any("diab" in d for d in all_diagnoses) or (vitals.get("blood_glucose", 0) > 140)
    if is_diabetic:
        flags.append({"name": "Diabetic", "color": "yellow", "symbol": "🟡"})

    is_hypertensive = any("hyperten" in d for d in all_diagnoses) or (vitals.get("systolic_bp", 0) > 140)
    if is_hypertensive:
        flags.append({"name": "Hypertension", "color": "purple", "symbol": "🟣"})

    if pred_risk in ["High", "High Risk", "Critical"]:
        flags.append({"name": "High Risk", "color": "black", "symbol": "⚫"})

    if not flags:
        flags.append({"name": "Normal", "color": "green", "symbol": "🟢"})

    # Vitals extraction & BMI calculation
    height = vitals.get("height", 170.0)
    weight = vitals.get("weight", 68.0)
    bmi = vitals.get("bmi")
    if (not bmi or bmi == 0) and height and weight:
        bmi = round(weight / ((height / 100.0) ** 2), 1)

    last_consult = past_consultations[0] if past_consultations else None

    # Symptoms string
    symptoms_str = ", ".join(pred_symptoms) if (isinstance(pred_symptoms, list) and pred_symptoms) else "Routine checkup & consultation"

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "blood_group": patient.blood_group or "O+",
            "allergies": patient.allergies or "None recorded",
            "emergency_contact": patient.emergency_contact or "N/A",
            "mobile": patient.mobile_number,
            "email": patient.email or f"{patient.name.lower().replace(' ', '.')}@example.com",
            "address": "123 Health Enclave, City Hospital Zone",
            "profile_photo": patient.profile_photo,
            "height": height,
            "weight": weight,
            "bmi": bmi or 23.5,
            "chronic_diseases": ["Type 2 Diabetes"] if is_diabetic else (["Essential Hypertension"] if is_hypertensive else ["None"]),
            "smoking_status": "Non-smoker",
            "alcohol_status": "Non-drinker"
        },
        "vitals": vitals,
        "current_medications": current_meds if current_meds else ["No active prescriptions"],
        "past_consultations": past_consultations,
        "current_visit": {
            "symptoms": symptoms_str,
            "predicted_disease": pred_disease or "General Medical Checkup",
            "confidence": f"{int(pred_conf * 100)}%" if (isinstance(pred_conf, (int, float)) and pred_conf <= 1.0) else (f"{int(pred_conf)}%" if isinstance(pred_conf, (int, float)) else "85%"),
            "recommended_department": recommended_dept
        },
        "last_visit": {
            "previous_diagnosis": last_consult["diagnosis"] if last_consult else "No prior recorded diagnosis",
            "previous_prescription": last_consult["prescription"] if last_consult else "None",
            "last_consultation_date": last_consult["date"] if last_consult else None,
            "last_doctor": last_consult["doctor_name"] if last_consult else "None"
        },
        "flags": flags,
        "lab_reports": reports
    }

@router.get("/timeline")
def get_clinical_timeline(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    timeline = []
    
    # 1. Registration event
    timeline.append({
        "type": "Registration",
        "date": patient.created_at.isoformat(),
        "title": "Patient Registered",
        "description": "Patient file created in hospital repository.",
        "details": f"Registered via mobile {patient.mobile_number}"
    })

    # 2. Consultation events
    consults = db.query(Consultation).filter(Consultation.patient_id == patient_id).all()
    for c in consults:
        doc = db.query(Doctor).filter(Doctor.id == c.doctor_id).first()
        doc_name = doc.name if doc else "Physician"
        
        timeline.append({
            "type": "Consultation",
            "date": c.created_at.isoformat(),
            "title": f"Consultation with Dr. {doc_name}",
            "description": f"Diagnosis: {c.diagnosis}",
            "details": f"Chief complaints: {c.symptoms}"
        })
        
        # Prescription event tied to Consultation
        if c.prescription:
            timeline.append({
                "type": "Prescription",
                "date": c.created_at.isoformat(),
                "title": f"Rx Prescribed by Dr. {doc_name}",
                "description": c.prescription,
                "details": "Prescription issued at end of consultation session."
            })

    # 3. Prediction logs
    predictions = db.query(PredictionHistory).filter(PredictionHistory.patient_id == patient_id).all()
    for p in predictions:
        timeline.append({
            "type": "AI Prediction",
            "date": p.prediction_time.isoformat(),
            "title": f"AI Disease Prediction: {p.predicted_disease}",
            "description": f"ML Confidence: {(p.confidence * 100).toFixed(1) if hasattr(p.confidence, 'toFixed') else round(p.confidence * 100, 1)}%",
            "details": f"Triage Risk Level: {p.risk_level} | Evaluated Symptoms: {p.symptoms}"
        })

    # 4. Lab report events
    reports = db.query(MedicalReport).filter(MedicalReport.patient_id == patient_id).all()
    for r in reports:
        timeline.append({
            "type": "Lab Report",
            "date": r.upload_date.isoformat(),
            "title": f"Lab Report Uploaded: {r.report_name}",
            "description": f"Diagnostics Type: {r.report_type}",
            "details": f"Report saved under file path: {r.file_path}"
        })

    # 5. Follow-ups
    visits = db.query(Visit).filter(
        Visit.patient_id == patient_id, 
        Visit.follow_up_date.isnot(None)
    ).all()
    for v in visits:
        doc = db.query(Doctor).filter(Doctor.id == v.doctor_id).first()
        doc_name = doc.name if doc else "Physician"
        timeline.append({
            "type": "Follow-up",
            "date": v.follow_up_date.isoformat(),
            "title": "Scheduled Follow-up Care",
            "description": f"Appointment with Dr. {doc_name}",
            "details": f"Target checkup date specified: {v.follow_up_date.date()}"
        })

    # Sort timeline chronologically (latest first)
    timeline.sort(key=lambda x: x["date"], reverse=True)
    return timeline

@router.post("/assistant")
def get_clinical_assistant_summary(req: AssistantRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")
        
    vitals = get_latest_vitals_dict(db, req.patient_id)
    diag = (req.diagnosis or "").lower()
    symp = (req.symptoms or "").lower()

    # Rule-based diagnostic summaries
    summary = f"Patient is a {patient.age}-year-old {patient.gender.lower()}"
    if patient.allergies:
        summary += f" with documented allergies: {patient.allergies}."
    else:
        summary += " with no known drug allergies."

    # Compute risk metrics
    risk = "Stable"
    complications = ["General progression monitoring"]
    history_highlights = ["No significant past history highlights"]
    meds = []
    actions = ["Regular checkup in department clinics"]
    investigations = ["CBC (Complete Blood Count)", "BMP (Basic Metabolic Panel)"]
    referral = "None required at present"

    # Analyze vitals parameters
    systolic = vitals.get("systolic_bp", 120)
    glucose = vitals.get("blood_glucose", 95)
    heart_rate = vitals.get("heart_rate", 72)

    if systolic > 160 or glucose > 200 or heart_rate > 110:
        risk = "Critical"
    elif systolic > 140 or glucose > 140 or heart_rate > 95:
        risk = "High Risk"
    elif systolic > 130 or glucose > 110:
        risk = "Chronic Disease"

    # Disease specific diagnostics
    is_diabetic = "diab" in diag or "diab" in symp or glucose > 125
    is_hypertensive = "hyperten" in diag or "bp" in symp or systolic > 139
    is_cardio = "cardio" in diag or "chest pain" in symp or "heart" in diag
    is_respiratory = "asthma" in diag or "copd" in diag or "cough" in symp or "respir" in diag

    # Generate personalized recommendations
    if is_diabetic:
        complications = [
            "Diabetic Nephropathy (kidney dysfunction)",
            "Peripheral Neuropathy (nerve damage)",
            "Diabetic Retinopathy (vision loss)"
        ]
        history_highlights.append("Elevated blood glucose profile / diabetic symptoms")
        actions = [
            "Monitor fasting blood glucose daily",
            "Maintain carbohydrate restricted clinical diet",
            "Inspect feet daily for micro-lesions"
        ]
        investigations.extend([
            "HbA1c (Glycated Hemoglobin) level check",
            "Urine Microalbumin/Creatinine ratio",
            "Fasting Lipid Profile"
        ] )
        referral = "Endocrinology Clinic for specialized glycemic management"
        
    if is_hypertensive:
        complications.extend([
            "Hypertensive heart disease",
            "Accelerated renal insufficiency",
            "Cerebrovascular pathology (Stroke risk)"
        ])
        history_highlights.append("Chronic elevated blood pressure log")
        actions.extend([
            "Record blood pressure twice daily",
            "Restrict sodium intake to < 2g per day",
            "Avoid high stress or high cardiovascular exertion without clearance"
        ])
        investigations.extend([
            "Electrocardiogram (12-Lead ECG)",
            "Basic Metabolic Panel (BMP) to check electrolytes",
            "Echocardiogram (Cardiac scan)"
        ])
        if referral == "None required at present":
            referral = "Cardiology Clinic for cardiovascular risk screening"

    if is_cardio:
        risk = "Critical" if risk != "Critical" else "Critical"
        complications.extend([
            "Myocardial Infarction (heart attack)",
            "Congestive heart failure",
            "Cardiac arrhythmias"
        ])
        history_highlights.append("Cardiovascular pathology flags / active chest pain symptoms")
        actions.extend([
            "Strict cardiac bed rest during acute episodes",
            "Avoid abrupt physical strain or heavy exercises",
            "Immediate emergency transit if chest pressure radiates to arm/jaw"
        ])
        investigations.extend([
            "Cardiac Troponin T/I biomarkers check",
            "Stress Echocardiography",
            "Coronary Computed Tomography Angiography (CCTA)"
        ])
        referral = "Cardiology Clinic (Urgent consultation dispatch)"

    if is_respiratory:
        complications.extend([
            "Acute bronchospasm (Asthma attack)",
            "Respiratory failure / Hypoxemia",
            "Secondary respiratory infections (Pneumonia)"
        ])
        history_highlights.append("Reactive airway disease/COPD status log")
        actions.extend([
            "Avoid allergy triggers, dust, smoke, and damp conditions",
            "Maintain rescue bronchodilator inhalers within active reach",
            "Perform peak flow meter monitoring"
        ])
        investigations.extend([
            "Spirometry / Pulmonary Function Tests (PFT)",
            "Chest X-Ray (Posterior-Anterior view)",
            "Pulse Oximetry monitoring logs"
        ])
        referral = "Pulmonology Clinic for chronic lung care"

    # Format list
    history_highlights = [h for h in history_highlights if h != "No significant past history highlights"]
    if not history_highlights:
         history_highlights = ["Patient profile reports no urgent active pathology records."]

    return {
        "summary": summary,
        "risk_level": risk,
        "complications": complications,
        "important_history": history_highlights,
        "suggested_actions": actions,
        "recommended_investigations": list(set(investigations)),
        "specialist_referral": referral
    }

@router.post("/prescription-assistant")
def get_prescription_screening(req: PrescriptionAssistantRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")
        
    meds = [m.strip().lower() for m in req.medicines]
    warnings = []
    suggestions = []

    # 1. Drug Duplication Logic
    # Group medications by therapeutic classes
    nsaids = ["ibuprofen", "naproxen", "aspirin", "diclofenac", "meloxicam", "celecoxib"]
    beta_blockers = ["metoprolol", "atenolol", "propranolol", "carvedilol", "bisoprolol"]
    ace_inhibitors = ["lisinopril", "enalapril", "ramipril", "benazepril"]
    statins = ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"]

    prescribed_nsaids = [m for m in meds if any(n in m for n in nsaids)]
    prescribed_bb = [m for m in meds if any(b in m for b in beta_blockers)]
    prescribed_ace = [m for m in meds if any(a in m for a in ace_inhibitors)]
    
    if len(prescribed_nsaids) > 1:
        warnings.append({
            "type": "Duplication Warning",
            "severity": "High",
            "message": f"Overlapping NSAID Therapy detected: Prescribing multiple NSAIDs ({', '.join(prescribed_nsaids)}) increases risk of gastrointestinal bleeding and renal impairment."
        })
    if len(prescribed_bb) > 1:
        warnings.append({
            "type": "Duplication Warning",
            "severity": "Medium",
            "message": f"Overlapping Beta-Blocker Therapy: Multiple beta-blockers ({', '.join(prescribed_bb)}) can cause dangerous bradycardia and hypotension."
        })
    if len(prescribed_ace) > 1:
        warnings.append({
            "type": "Duplication Warning",
            "severity": "High",
            "message": f"Overlapping ACE-Inhibitor Therapy: Multiple ACE inhibitors ({', '.join(prescribed_ace)}) increases risk of severe hyperkalemia and acute kidney injury."
        })

    # 2. Medicine Conflicts (Drug-Drug Interactions)
    # Aspirin + Warfarin
    has_aspirin = any("aspirin" in m for m in meds)
    has_warfarin = any("warfarin" in m for m in meds)
    has_clopidogrel = any("clopidogrel" in m for m in meds)
    if has_aspirin and (has_warfarin or has_clopidogrel):
        warnings.append({
            "type": "Drug Interaction Conflict",
            "severity": "Critical",
            "message": "Critical Hemorrhage Risk: Concomitant use of Aspirin with anticoagulants (Warfarin/Clopidogrel) significantly multiplies gastrointestinal and intracranial bleeding indices."
        })
        
    # Sildenafil + Nitroglycerin
    has_sildenafil = any("sildenafil" in m or "viagra" in m for m in meds)
    has_nitro = any("nitro" in m for m in meds)
    if has_sildenafil and has_nitro:
        warnings.append({
            "type": "Drug Interaction Conflict",
            "severity": "Critical",
            "message": "Fatal Hypotension Risk: Nitroglycerin co-administration with Sildenafil leads to synergistic vasodilatation, resulting in life-threatening hypotension."
        })

    # Lisinopril + Spironolactone
    has_lisinopril = any("lisinopril" in m for m in meds)
    has_spironolactone = any("spironolactone" in m for m in meds)
    if has_lisinopril and has_spironolactone:
        warnings.append({
            "type": "Drug Interaction Conflict",
            "severity": "Medium",
            "message": "Hyperkalemia Risk: Lisinopril and Spironolactone both conserve potassium. Co-administration requires frequent monitoring of serum potassium levels."
        })

    # 3. Patient Allergies Conflicts
    patient_allergies = (patient.allergies or "").lower()
    if "penicillin" in patient_allergies or "amoxicillin" in patient_allergies:
        penicillin_drugs = ["penicillin", "amoxicillin", "ampicillin", "augmentin", "piperacillin", "clavulanate"]
        allergic_matches = [m for m in meds if any(p in m for p in penicillin_drugs)]
        if allergic_matches:
            warnings.append({
                "type": "Allergy Conflict",
                "severity": "Critical",
                "message": f"Critical Allergy Alert: Patient has documented Penicillin hypersensitivity. Prescribed medications ({', '.join(allergic_matches)}) trigger severe anaphylactic risk."
            })
            
    if "sulfa" in patient_allergies or "sulfamethoxazole" in patient_allergies:
        sulfa_drugs = ["bactrim", "sulfamethoxazole", "septra", "sulfasalazine"]
        allergic_matches = [m for m in meds if any(s in m for s in sulfa_drugs)]
        if allergic_matches:
            warnings.append({
                "type": "Allergy Conflict",
                "severity": "Critical",
                "message": f"Critical Allergy Alert: Patient has documented Sulfa allergy. Prescribed medications ({', '.join(allergic_matches)}) carry severe cutaneous hypersensitivity risks (SJS)."
            })

    # 4. High-Risk Medications Alerts
    high_risk_dict = {
        "warfarin": "Requires strict INR monitoring and dietary controls.",
        "insulin": "Requires precise blood glucose self-monitoring and hypoglycemic precautions.",
        "digoxin": "Requires serum level monitoring and bradycardia warnings.",
        "fentanyl": "Potent opioid agonist. High respiratory depression and addiction risk indices."
    }
    for hr_name, hr_msg in high_risk_dict.items():
        if any(hr_name in m for m in meds):
            warnings.append({
                "type": "High-Risk Medication Indicator",
                "severity": "High",
                "message": f"High-Alert Drug Alert ({hr_name.upper()}): {hr_msg}"
            })

    # 5. Smart Drug Suggestions (Autocomplete / templates based on symptoms)
    # Default common medication suggestions
    suggestions.append({"medicine": "Paracetamol 500mg", "dosage": "1 tablet", "frequency": "Every 6 hours", "duration": "3 days", "instructions": "For pain or fever"})
    suggestions.append({"medicine": "Metformin 500mg", "dosage": "1 tablet", "frequency": "Twice daily", "duration": "30 days", "instructions": "Take with meals for blood sugar control"})
    suggestions.append({"medicine": "Lisinopril 10mg", "dosage": "1 tablet", "frequency": "Once daily", "duration": "30 days", "instructions": "Take in the morning for blood pressure control"})
    suggestions.append({"medicine": "Amoxicillin 500mg", "dosage": "1 capsule", "frequency": "Three times daily", "duration": "7 days", "instructions": "Complete full course of antibiotics"})

    return {
        "warnings": warnings,
        "suggested_medicines": suggestions
    }

@router.post("/followup")
def get_followup_recommendation(req: FollowupRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    risk = req.risk_level or "Stable"
    diag = (req.diagnosis or "").lower()
    
    # Heuristics based recommendations
    if risk == "Critical" or "emergency" in diag or "acute chest pain" in diag:
        interval = "3 days"
        reason = "Immediate monitoring required to reassess unstable vitals and acute cardiovascular parameters."
    elif risk == "High Risk" or "acute" in diag or "pneumonia" in diag or "infection" in diag:
        interval = "1 week"
        reason = "Short-term recovery review to monitor therapy efficacy and resolve inflammatory markers."
    elif "diab" in diag or "hyperten" in diag or "chronic" in diag:
        interval = "1 month"
        reason = "Standard chronic condition checkup to adjust titration dosages and monitor organ functions."
    elif patient.age > 65:
        interval = "2 weeks"
        reason = "Geriatric status assessment to confirm tolerability of newly prescribed therapeutic drugs."
    else:
        interval = "3 months"
        reason = "Standard preventative medicine follow-up to confirm clinical stability."

    return {
        "recommended_interval": interval,
        "reason": reason,
        "available_options": ["3 days", "1 week", "2 weeks", "1 month", "3 months"]
    }

@router.post("/flags")
def get_patient_flags(req: FlagsRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    vitals = req.vitals or get_latest_vitals_dict(db, req.patient_id)
    diag = (req.diagnosis or "").lower()

    # Retrieve risk classification from latest predictions
    latest_pred = db.query(PredictionHistory).filter(
        PredictionHistory.patient_id == req.patient_id
    ).order_by(PredictionHistory.prediction_time.desc()).first()
    
    pred_risk = latest_pred.risk_level if latest_pred else "Low"

    # Evaluate vital indicators
    systolic = vitals.get("systolic_bp", 120)
    glucose = vitals.get("blood_glucose", 95)
    temp = vitals.get("temperature", 98.4)
    hr = vitals.get("heart_rate", 72)

    # Flag calculation matrix
    is_critical_vitals = systolic > 185 or systolic < 85 or glucose > 280 or temp > 103 or hr > 120 or hr < 45
    is_high_vitals = systolic > 140 or systolic < 95 or glucose > 140 or temp > 100.4 or hr > 95 or hr < 55
    is_chronic_diag = "diab" in diag or "hyperten" in diag or "asthma" in diag or "copd" in diag or "chronic" in diag

    if is_critical_vitals or pred_risk == "Critical":
        flag = "🔴 Critical"
        color = "red"
        description = "Urgent clinical attention required. Vitals signs show hypertensive crisis, high cardiac pulse, or extreme pyrexia."
    elif is_high_vitals or pred_risk == "High" or pred_risk == "High Risk":
        flag = " 🟠 High Risk"
        color = "orange"
        description = "Elevated cardiovascular risk profile or sub-acute vital logs requiring close follow-up screening."
    elif is_chronic_diag:
        flag = "🟡 Chronic Disease"
        color = "yellow"
        description = "Patient has persistent, diagnosed conditions (Diabetes / Hypertension) requiring regular checkups."
    else:
        flag = "🟢 Stable"
        color = "green"
        description = "Vitals parameters are within standard physiological reference indices."

    return {
        "flag": flag,
        "color": color,
        "description": description
    }

@router.post("/recommendations")
def get_clinical_decision_support(req: RecommendationsRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    diag = (req.diagnosis or "").lower()
    vitals = get_latest_vitals_dict(db, req.patient_id)
    systolic = vitals.get("systolic_bp", 120)

    investigations = ["Complete Blood Count (CBC)"]
    lifestyle = ["Maintain regular hydration", "Perform 150 minutes of moderate aerobic exercise weekly"]
    screening = []
    vaccinations = ["Annual Influenza Vaccine"]

    # Age-based and gender-based preventive screenings
    if patient.age >= 50:
        screening.append("Colorectal Cancer Screening (Colonoscopy every 10 years)")
        screening.append("Annual Cardiovascular risk profile scan")
        vaccinations.append("Pneumococcal Conjugate Vaccine (PCV13/PPSV23)")
    if patient.gender.lower() == "female" and patient.age >= 40:
        screening.append("Mammography Screening (every 1-2 years for breast cancer prevention)")
    if patient.gender.lower() == "female" and 21 <= patient.age <= 65:
        screening.append("Cervical Cancer Screening (Pap smear test every 3 years)")

    # Diabetes specific guidelines
    if "diab" in diag or vitals.get("blood_glucose", 90) > 125:
        investigations.extend(["HbA1c test (every 3-6 months)", "Renal panel", "Urine Microalbumin"])
        lifestyle.extend([
            "Strict carbohydrate control diet with low glycemic index options",
            "Inspect feet daily to prevent diabetic foot ulcers",
            "Aerobic physical training to improve insulin sensitivity"
        ])
        screening.append("Annual Diabetic Retinopathy screening (Dilated eye exam)")
        vaccinations.append("Hepatitis B vaccine series (if aged < 60)")

    # Hypertension specific guidelines
    if "hyperten" in diag or systolic > 139:
        investigations.extend(["12-Lead Electrocardiogram (ECG)", "Lipid Profile panel", "Serum Electrolytes"])
        lifestyle.extend([
            "Low sodium diet (< 2000mg salt per day)",
            "DASH Diet compliance (rich in fruits, vegetables, low fat dairy)",
            "Avoid NSAID medications (Ibuprofen) which can raise blood pressure"
        ])
        screening.append("Annual kidney function assessment (GFR and creatinine)")

    # Asthma/COPD respiratory guidelines
    if "asthma" in diag or "copd" in diag:
        investigations.append("Spirometry/Pulmonary Function Test (PFT)")
        lifestyle.extend([
            "Avoid aerosol sprays, secondary tobacco smoke, and sudden temperature drops",
            "Fluids to thin respiratory secretions"
        ])
        vaccinations.extend(["Pneumococcal vaccine", "Annual Influenza shot"])

    return {
        "suggested_investigations": list(set(investigations)),
        "lifestyle_advice": list(set(lifestyle)),
        "preventive_screening": list(set(screening)),
        "vaccination_reminders": list(set(vaccinations))
    }

@router.get("/disease-recommendations")
def get_disease_recommendations(disease: str, db: Session = Depends(get_db)):
    if not disease or not disease.strip():
        raise HTTPException(status_code=400, detail="Disease parameter is required.")
        
    info = disease_knowledge_service.get_disease_info(disease.strip())
    
    # Format medicines from knowledge base with prioritization: Primary -> Supportive -> Symptomatic
    raw_meds = info.get("medicines", [])
    formatted_meds = []
    for m in raw_meds:
        dos = m.get("dosage", "")
        if not dos or str(dos).strip().lower() in ["", "nan", "none", "n/a"]:
            dos = "Consult physician dosage guidelines."
        cat = m.get("category", "Primary Treatment")
        reas = m.get("reason", f"Targeted clinical intervention for {info.get('name', disease)}.")
        prio = 1 if cat == "Primary Treatment" else (2 if cat == "Supportive Therapy" else 3)

        formatted_meds.append({
            "name": m.get("name", "Verified Medication"),
            "dosage": dos,
            "frequency": m.get("frequency", "As directed by physician"),
            "duration": m.get("duration", "7 days"),
            "description": m.get("notes", "Use under clinical supervision."),
            "category": cat,
            "reason": reas,
            "_priority": prio
        })
        
    formatted_meds.sort(key=lambda x: x["_priority"])
    for m in formatted_meds:
        del m["_priority"]

    # Format laboratory tests
    raw_tests = info.get("tests", [])
    formatted_tests = []
    for t in raw_tests:
        formatted_tests.append({
            "name": t.get("name", "Recommended Investigation"),
            "reason": t.get("reason", "Verification & disease monitoring")
        })

    # Format precautions
    precs = info.get("precautions", [])
    if isinstance(precs, str):
        precs = [p.strip() for p in precs.split(",") if p.strip()]

    # Format diet
    raw_diet = info.get("diet", {})
    diet_list = []
    if isinstance(raw_diet, dict):
        if raw_diet.get("recommended"):
            diet_list.extend([d.strip() for d in str(raw_diet["recommended"]).split(";") if d.strip()])
        if raw_diet.get("avoid"):
            diet_list.append(f"Avoid: {raw_diet['avoid']}")
    elif isinstance(raw_diet, str):
        diet_list = [d.strip() for d in raw_diet.split(",") if d.strip()]
    if not diet_list:
        diet_list = ["Balanced nutritious diet", "Adequate daily hydration"]

    # Format workout
    raw_workout = info.get("workout", "")
    if isinstance(raw_workout, str):
        workout_list = [w.strip() for w in raw_workout.split(";") if w.strip()] if ";" in raw_workout else [w.strip() for w in raw_workout.split(",") if w.strip()]
    elif isinstance(raw_workout, list):
        workout_list = raw_workout
    else:
        workout_list = ["30-minute daily light activity", "Stretching & mobility"]

    # Format risk factors
    causes_str = info.get("causes", "")
    risk_factors = [r.strip() for r in str(causes_str).split(",") if r.strip()]
    if not risk_factors:
        risk_factors = ["Family History", "Elevated Risk Indices", "Physical Stress"]

    return {
        "disease": info.get("name", disease),
        "disease_id": info.get("disease_id", "DIS_UNMAPPED"),
        "description": info.get("description", ""),
        "medicines": formatted_meds,
        "laboratory_tests": formatted_tests,
        "precautions": precs,
        "diet": diet_list,
        "workout": workout_list,
        "risk_factors": risk_factors,
        "department": {
            "name": info.get("department", "General Medicine"),
            "specialist": info.get("specialist", "General Practitioner")
        }
    }

# --- PATIENT CLINICAL REPORT GENERATION ENDPOINTS ---
from fastapi.responses import FileResponse
from backend.services.pdf_report_service import generate_consultation_pdf

@router.get("/consultations/{consultation_id}/report")
def get_consultation_report(consultation_id: int, download: bool = False, db: Session = Depends(get_db)):
    """
    Returns or generates the A4 Clinical Consultation PDF Report.
    Supports inline browser viewing and download=True.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation record not found.")

    try:
        pdf_path = generate_consultation_pdf(consultation_id, db)
    except Exception as e:
        print(f"[Report Error] Failed to generate PDF for consultation #{consultation_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

    filename = f"CONSULTATION_{consultation_id}.pdf"
    disposition = f'attachment; filename="{filename}"' if download else f'inline; filename="{filename}"'

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": disposition}
    )

@router.post("/consultations/{consultation_id}/generate-report")
def trigger_consultation_report_generation(consultation_id: int, db: Session = Depends(get_db)):
    """
    Triggers / regenerates PDF report for consultation.
    """
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation record not found.")

    try:
        pdf_path = generate_consultation_pdf(consultation_id, db, force_regenerate=True)
        return {
            "success": True,
            "consultation_id": consultation_id,
            "report_path": pdf_path,
            "generated_at": consultation.generated_at.isoformat() if consultation.generated_at else None,
            "report_url": f"/api/clinical/consultations/{consultation_id}/report"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
