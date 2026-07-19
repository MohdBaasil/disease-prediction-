from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from pydantic import BaseModel
from datetime import datetime
from backend.database.connection import get_db
from backend.database.models import Patient, User, AuditLog, Consultation, Visit, PrescriptionItem, MedicalReport, Notification
from backend.database.schemas import (
    PatientCreate, PatientResponse, ConsultationResponse, PatientProfileUpdate,
    VisitResponse, PrescriptionItemResponse, MedicalReportResponse, NotificationResponse
)
from backend.services.auth_service import get_password_hash, RoleChecker, get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/patients", tags=["Patients"])

@router.get("/me", response_model=PatientResponse)
def get_current_patient_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found for this user account")
    return patient

# RBAC dependencies
receptionist_or_admin = RoleChecker(["Admin", "Receptionist"])

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def register_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    # Determine user linkage
    user_id = None
    
    # Check if a user account should be created for this patient (online self-registration)
    if patient_in.username and patient_in.password:
        existing_user = db.query(User).filter(User.username == patient_in.username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken for patient account"
            )
        hashed_password = get_password_hash(patient_in.password)
        new_user = User(
            username=patient_in.username,
            hashed_password=hashed_password,
            role="Patient"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        user_id = new_user.id
        
    # If not registering with username/password, authentication is required
    else:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to register patient walk-in profile"
            )
        if current_user.role not in ["Admin", "Receptionist", "Patient"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to register a patient profile"
            )

        # If the user is self-registering as a patient, associate with their active user account
        if current_user.role == "Patient":
            # Check if this user already has a patient profile
            existing_patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
            if existing_patient:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already registered a patient profile"
                )
            user_id = current_user.id

    patient = Patient(
        user_id=user_id,
        name=patient_in.name,
        age=patient_in.age,
        gender=patient_in.gender,
        mobile_number=patient_in.mobile_number
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Audit log
    log = AuditLog(
        user_id=current_user.id if current_user else patient.user_id,
        action="Register Patient",
        details=f"Registered patient {patient.name} (id: {patient.id})"
    )
    db.add(log)
    db.commit()

    return patient

@router.get("", response_model=List[PatientResponse])
def get_patients(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor"]))
):
    query = db.query(Patient)
    if search:
        query = query.filter(
            (Patient.name.ilike(f"%{search}%")) | 
            (Patient.mobile_number.like(f"%{search}%"))
        )
    return query.all()

@router.get("/by-mobile/{mobile_number}", response_model=List[PatientResponse])
def get_patient_by_mobile(
    mobile_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor"]))
):
    return db.query(Patient).filter(Patient.mobile_number == mobile_number).all()

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor", "Patient"]))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Check permissions: Patients can only view their own profile
    if current_user.role == "Patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    return patient

@router.get("/{patient_id}/consultations", response_model=List[ConsultationResponse])
def get_patient_consultation_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor", "Patient"]))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Check permissions: Patients can only view their own consultations
    if current_user.role == "Patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    return db.query(Consultation).filter(Consultation.patient_id == patient_id).order_by(Consultation.created_at.desc()).all()

# --- Patient Dashboard Endpoints ---

class MedicineHistoryResponse(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None
    prescribed_date: datetime
    doctor_name: str

@router.put("/me/profile", response_model=PatientResponse)
def update_patient_profile(
    profile_in: PatientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found for logged-in user account.")

    update_data = profile_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if isinstance(value, str) and value.strip() == "":
            value = None
        setattr(patient, key, value)
    
    try:
        db.commit()
        db.refresh(patient)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to save profile changes: {str(e)}")
    
    log = AuditLog(
        user_id=current_user.id,
        action="Update Patient Profile",
        details=f"Patient {patient.name} updated profile details"
    )
    db.add(log)
    db.commit()
    
    return patient

@router.get("/me/visits", response_model=List[VisitResponse])
def get_my_visits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Visit).filter(Visit.patient_id == patient.id).order_by(Visit.visit_date.desc()).all()

@router.get("/me/prescriptions", response_model=List[MedicineHistoryResponse])
def get_my_prescribed_medicines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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

@router.get("/me/reports", response_model=List[MedicalReportResponse])
def get_my_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(MedicalReport).filter(MedicalReport.patient_id == patient.id).order_by(MedicalReport.upload_date.desc()).all()

@router.get("/me/notifications", response_model=List[NotificationResponse])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return []
    return db.query(Notification).filter(Notification.patient_id == patient.id).order_by(Notification.created_at.desc()).all()

from fastapi.responses import StreamingResponse
from backend.services.report_service import generate_prescription_pdf, generate_lab_report_pdf

@router.get("/me/prescriptions/{visit_id}/pdf")
def download_my_prescription_pdf(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
        
    # Security: check if patient owns this visit
    if visit.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    try:
        pdf_stream = generate_prescription_pdf(db, visit_id)
        filename = f"Prescription_RX-{visit_id}.pdf"
        return StreamingResponse(
            pdf_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

@router.get("/me/reports/{report_id}/pdf")
def download_my_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    report = db.query(MedicalReport).filter(MedicalReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Security: check if patient owns this report
    if report.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    try:
        pdf_stream = generate_lab_report_pdf(db, report_id)
        filename = f"LabReport_LAB-{report_id}.pdf"
        return StreamingResponse(
            pdf_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
