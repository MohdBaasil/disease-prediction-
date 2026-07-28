from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from pydantic import BaseModel
from datetime import datetime
from backend.database.connection import get_db
from backend.database.models import Patient, User, AuditLog, Consultation, Visit, PrescriptionItem, MedicalReport, Notification
from backend.database.schemas import (
    PatientCreate, PatientResponse, ConsultationResponse, PatientProfileUpdate,
    VisitResponse, PrescriptionItemResponse, MedicalReportResponse, NotificationResponse,
    DuplicateCheckRequest, DuplicateCheckResponse
)
from backend.services.auth_service import get_password_hash, RoleChecker, get_current_user, get_current_user_optional
import re

router = APIRouter(prefix="/api/patients", tags=["Patients"])

def generate_patient_code(db: Session) -> str:
    current_year = datetime.utcnow().year
    count = db.query(Patient).count() + 1
    code = f"PAT-{current_year}-{count:06d}"
    
    # Ensure uniqueness
    while db.query(Patient).filter(Patient.patient_code == code).first() is not None:
        count += 1
        code = f"PAT-{current_year}-{count:06d}"
    return code

def validate_patient_fields(patient_data: dict):
    # Name validation
    name = patient_data.get("name")
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Patient Full Name is required.")
        
    # Mobile validation
    mobile = patient_data.get("mobile_number")
    if not mobile or not re.search(r'\d{7,15}', mobile.replace(" ", "").replace("-", "")):
        raise HTTPException(status_code=400, detail="A valid Mobile Number (7-15 digits) is required.")

    # Email validation (optional)
    email = patient_data.get("email")
    if email and email.strip():
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email.strip()):
            raise HTTPException(status_code=400, detail="Invalid Email Address format.")

    # DOB & Age validation
    dob_str = patient_data.get("dob")
    calculated_age = patient_data.get("age")
    if dob_str and dob_str.strip():
        try:
            dob_date = datetime.strptime(dob_str.strip(), "%Y-%m-%d").date()
            today = datetime.utcnow().date()
            if dob_date > today:
                raise HTTPException(status_code=400, detail="Date of Birth cannot be in the future.")
            
            # Auto-calculate age from DOB if DOB is provided
            years = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
            calculated_age = years
        except ValueError as ve:
            if isinstance(ve, HTTPException):
                raise ve
            raise HTTPException(status_code=400, detail="Invalid Date of Birth format. Please use YYYY-MM-DD.")
            
    if calculated_age is None or calculated_age < 0 or calculated_age > 130:
        raise HTTPException(status_code=400, detail="Valid Age (0-130) or Date of Birth is required.")

    return calculated_age

def check_patient_duplicates(db: Session, mobile: str, email: Optional[str] = None, national_id: Optional[str] = None, exclude_id: Optional[int] = None):
    matches = []
    existing = None

    if mobile and mobile.strip():
        m_match = db.query(Patient).filter(
            Patient.mobile_number == mobile.strip(),
            Patient.id != exclude_id if exclude_id else True
        ).first()
        if m_match:
            matches.append("Mobile Number")
            existing = existing or m_match

    if email and email.strip():
        e_match = db.query(Patient).filter(
            Patient.email == email.strip(),
            Patient.id != exclude_id if exclude_id else True
        ).first()
        if e_match:
            matches.append("Email Address")
            existing = existing or e_match

    if national_id and national_id.strip():
        n_match = db.query(Patient).filter(
            Patient.national_id == national_id.strip(),
            Patient.id != exclude_id if exclude_id else True
        ).first()
        if n_match:
            matches.append("National ID")
            existing = existing or n_match

    is_duplicate = len(matches) > 0
    message = "No duplicate records found."
    if is_duplicate and existing:
        matched_fields = ", ".join(matches)
        pat_code = existing.patient_code or f"ID: {existing.id}"
        message = f"Duplicate record detected for {matched_fields}! Matches existing patient '{existing.name}' ({pat_code})."

    return is_duplicate, matches, message, existing

@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
def check_duplicate_api(
    req: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Doctor"]))
):
    is_dup, matches, msg, existing = check_patient_duplicates(
        db=db,
        mobile=req.mobile_number,
        email=req.email,
        national_id=req.national_id,
        exclude_id=req.exclude_patient_id
    )
    return DuplicateCheckResponse(
        is_duplicate=is_dup,
        matches=matches,
        message=msg,
        existing_patient=existing
    )

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
    patient_dict = patient_in.model_dump()
    calculated_age = validate_patient_fields(patient_dict)

    # Check duplicates
    is_dup, matches, dup_msg, existing = check_patient_duplicates(
        db=db,
        mobile=patient_in.mobile_number,
        email=patient_in.email,
        national_id=patient_in.national_id
    )
    if is_dup:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=dup_msg)

    # Determine user linkage
    user_id = None
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

        if current_user.role == "Patient":
            existing_patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
            if existing_patient:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already registered a patient profile"
                )
            user_id = current_user.id

    # Auto-generate Patient Code if not supplied
    patient_code = patient_in.patient_code or generate_patient_code(db)

    # Combine emergency contact fields if legacy emergency_contact is empty
    emerg_contact_summary = patient_in.emergency_contact
    if not emerg_contact_summary and patient_in.emergency_contact_phone:
        parts = [p for p in [patient_in.emergency_contact_name, f"({patient_in.emergency_contact_relationship})" if patient_in.emergency_contact_relationship else None, patient_in.emergency_contact_phone] if p]
        emerg_contact_summary = " ".join(parts)

    patient = Patient(
        patient_code=patient_code,
        user_id=user_id,
        name=patient_in.name.strip(),
        dob=patient_in.dob.strip() if patient_in.dob else None,
        email=patient_in.email.strip() if patient_in.email else None,
        age=calculated_age,
        gender=patient_in.gender,
        blood_group=patient_in.blood_group,
        mobile_number=patient_in.mobile_number.strip(),
        address=patient_in.address,
        emergency_contact=emerg_contact_summary,
        emergency_contact_name=patient_in.emergency_contact_name,
        emergency_contact_relationship=patient_in.emergency_contact_relationship,
        emergency_contact_phone=patient_in.emergency_contact_phone,
        allergies=patient_in.allergies,
        existing_conditions=patient_in.existing_conditions,
        national_id=patient_in.national_id.strip() if patient_in.national_id else None,
        insurance_provider=patient_in.insurance_provider,
        insurance_number=patient_in.insurance_number,
        profile_photo=patient_in.profile_photo
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    # Audit log
    log = AuditLog(
        user_id=current_user.id if current_user else patient.user_id,
        action="Register Patient",
        details=f"Registered patient {patient.name} (Code: {patient.patient_code}, ID: {patient.id})"
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
        s_term = search.strip()
        query = query.filter(
            (Patient.patient_code.ilike(f"%{s_term}%")) |
            (Patient.name.ilike(f"%{s_term}%")) | 
            (Patient.mobile_number.like(f"%{s_term}%")) |
            (Patient.national_id.ilike(f"%{s_term}%"))
        )
    return query.order_by(Patient.id.desc()).all()

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
        
    if current_user.role == "Patient" and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    return patient

@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient_by_id(
    patient_id: int,
    patient_in: PatientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist"]))
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found")

    update_data = patient_in.model_dump(exclude_unset=True)

    # Validate duplicate if mobile/email/national_id is changing
    mob = update_data.get("mobile_number", patient.mobile_number)
    em = update_data.get("email", patient.email)
    nid = update_data.get("national_id", patient.national_id)
    
    is_dup, matches, dup_msg, existing = check_patient_duplicates(
        db=db,
        mobile=mob,
        email=em,
        national_id=nid,
        exclude_id=patient_id
    )
    if is_dup:
        raise HTTPException(status_code=400, detail=dup_msg)

    # Recalculate age if DOB is updated
    if "dob" in update_data and update_data["dob"]:
        try:
            dob_date = datetime.strptime(update_data["dob"].strip(), "%Y-%m-%d").date()
            today = datetime.utcnow().date()
            if dob_date > today:
                raise HTTPException(status_code=400, detail="Date of Birth cannot be in the future.")
            update_data["age"] = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid DOB format YYYY-MM-DD")

    for key, value in update_data.items():
        if isinstance(value, str) and value.strip() == "":
            value = None
        setattr(patient, key, value)

    try:
        db.commit()
        db.refresh(patient)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update patient record: {str(e)}")

    log = AuditLog(
        user_id=current_user.id,
        action="Update Patient",
        details=f"Updated details for patient {patient.name} ({patient.patient_code or patient.id})"
    )
    db.add(log)
    db.commit()

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
    visit_map = {v.id: v for v in visits}
    
    items = db.query(PrescriptionItem).filter(PrescriptionItem.visit_id.in_(visit_map.keys())).all() if visit_map else []
    
    history = []
    for item in items:
        visit = visit_map.get(item.visit_id)
        if not visit:
            continue
        history.append({
            "medicine_name": item.medicine_name,
            "dosage": item.dosage,
            "frequency": item.frequency,
            "duration": item.duration,
            "instructions": item.instructions,
            "prescribed_date": visit.visit_date,
            "doctor_name": visit.doctor.name if visit and visit.doctor else "Unknown Doctor"
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
