from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import json

from backend.database.connection import get_db
from backend.database.models import User, Patient, Department, Doctor, DiseasePredictionLog, AuditLog
from backend.services.auth_service import get_current_user, RoleChecker
from backend.machine_learning.disease_predictor import predict_disease

router = APIRouter(prefix="/api/patients", tags=["Disease Diagnosis"])

class VitalsInput(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Age of the patient")
    bmi: float = Field(..., ge=5.0, le=100.0, description="Body Mass Index")
    blood_glucose: int = Field(..., ge=10, le=1000, description="Blood Glucose Level (mg/dL)")
    heart_rate: int = Field(..., ge=20, le=300, description="Heart Rate (BPM)")
    temperature: float = Field(..., ge=90.0, le=115.0, description="Body Temperature (°F)")
    systolic_bp: int = Field(..., ge=40, le=300, description="Systolic Blood Pressure (mmHg)")

class DiseasePredictionRequest(BaseModel):
    vitals: VitalsInput
    symptoms: Dict[str, int]

class DoctorRecommendationResponse(BaseModel):
    id: int
    name: str
    specialization: str
    room_number: str
    is_available: bool

class TopPredictionItem(BaseModel):
    disease: str
    probability: float

class ModelPredictionInfo(BaseModel):
    disease: str
    probability: float

class ModelComparisons(BaseModel):
    random_forest: ModelPredictionInfo
    gradient_boosting: ModelPredictionInfo
    xgboost: ModelPredictionInfo

class DiseasePredictionResponse(BaseModel):
    predicted_disease: str
    confidence_score: float
    top_predictions: List[TopPredictionItem]
    comparisons: ModelComparisons
    reasons: List[str]
    risk_level: str
    badge_color: str
    recommended_specialty: str
    mapped_db_dept: str
    suggested_tests: List[str]
    suggested_medicines: List[str]
    medicine_disclaimer: str
    is_emergency: bool
    recommended_doctors: List[DoctorRecommendationResponse]

@router.post("/predict-disease", response_model=DiseasePredictionResponse)
def run_disease_prediction(
    request: DiseasePredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Patient", "Admin"]))
):
    # 1. Resolve patient profile
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for the logged-in user account."
        )
        
    # 2. Extract vitals and symptoms dicts
    vitals_dict = request.vitals.dict()
    symptoms_dict = request.symptoms
    
    # 3. Call Machine Learning prediction pipeline
    try:
        pred_res = predict_disease(vitals_dict, symptoms_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in ML pipeline prediction: {str(e)}"
        )
        
    # 4. Resolve recommended doctors
    mapped_dept_name = pred_res["mapped_db_dept"]
    dept = db.query(Department).filter(Department.name == mapped_dept_name).first()
    
    recommended_docs = []
    if dept:
        docs = db.query(Doctor).filter(Doctor.department_id == dept.id, Doctor.is_available == True).all()
        recommended_docs = [
            {
                "id": d.id,
                "name": d.name,
                "specialization": d.specialization,
                "room_number": d.room_number,
                "is_available": d.is_available
            } for d in docs
        ]
        
    # 5. Log prediction in database
    prediction_log = DiseasePredictionLog(
        patient_id=patient.id,
        vitals=json.dumps(vitals_dict),
        symptoms=json.dumps(symptoms_dict),
        predicted_disease=pred_res["predicted_disease"],
        confidence_score=pred_res["confidence_score"],
        risk_level=pred_res["risk_level"]
    )
    db.add(prediction_log)
    
    # Audit log
    audit_log = AuditLog(
        user_id=current_user.id,
        action="Disease Prediction",
        details=f"Patient {patient.name} ran disease prediction. Predicted: {pred_res['predicted_disease']} ({pred_res['risk_level']} Risk)"
    )
    db.add(audit_log)
    db.commit()
    
    # 6. Build response
    response_data = {
        "predicted_disease": pred_res["predicted_disease"],
        "confidence_score": pred_res["confidence_score"],
        "top_predictions": pred_res["top_predictions"],
        "comparisons": pred_res["comparisons"],
        "reasons": pred_res["reasons"],
        "risk_level": pred_res["risk_level"],
        "badge_color": pred_res["badge_color"],
        "recommended_specialty": pred_res["recommended_specialty"],
        "mapped_db_dept": pred_res["mapped_db_dept"],
        "suggested_tests": pred_res["suggested_tests"],
        "suggested_medicines": pred_res["suggested_medicines"],
        "medicine_disclaimer": pred_res["medicine_disclaimer"],
        "is_emergency": pred_res["is_emergency"],
        "recommended_doctors": recommended_docs
    }
    
    return response_data
