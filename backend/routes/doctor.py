from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.connection import get_db
from backend.database.models import Doctor, User, Department, AuditLog
from backend.database.schemas import DoctorCreate, DoctorResponse, DoctorUpdate
from backend.services.auth_service import get_password_hash, RoleChecker, get_current_user

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])

@router.get("/me", response_model=DoctorResponse)
def get_current_doctor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor profile not found for this user account")
    return doc

# Dependency shortcut for role checking
admin_only = RoleChecker(["Admin"])
admin_or_receptionist = RoleChecker(["Admin", "Receptionist"])

@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(
    doc_in: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    # Check if username exists
    existing_user = db.query(User).filter(User.username == doc_in.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Check department
    dept = db.query(Department).filter(Department.id == doc_in.department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department not found"
        )

    # Create User
    hashed_password = get_password_hash(doc_in.password)
    user = User(
        username=doc_in.username,
        hashed_password=hashed_password,
        role="Doctor"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create Doctor
    doctor = Doctor(
        user_id=user.id,
        department_id=doc_in.department_id,
        name=doc_in.name,
        specialization=doc_in.specialization,
        room_number=doc_in.room_number,
        is_available=doc_in.is_available
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="Create Doctor",
        details=f"Created doctor profile for {doctor.name} (user_id: {user.id})"
    )
    db.add(log)
    db.commit()

    return doctor

@router.get("", response_model=List[DoctorResponse])
def get_doctors(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Doctor)
    if department_id is not None:
        query = query.filter(Doctor.department_id == department_id)
    return query.all()

@router.get("/active", response_model=List[DoctorResponse])
def get_active_doctors(db: Session = Depends(get_db)):
    return db.query(Doctor).filter(Doctor.is_available == True).all()

@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor_by_id(doctor_id: int, db: Session = Depends(get_db)):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc

@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(
    doctor_id: int,
    doc_update: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Doctor"]))
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    # Standard security check: Doctors can only update their own profile, Admins can update any
    if current_user.role == "Doctor" and doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )
        
    # Update fields
    update_data = doc_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        set_attr = True
        if key == "department_id" and value is not None:
            dept = db.query(Department).filter(Department.id == value).first()
            if not dept:
                raise HTTPException(status_code=400, detail="New department not found")
        if set_attr:
            setattr(doc, key, value)
            
    db.commit()
    db.refresh(doc)
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="Update Doctor",
        details=f"Updated doctor profile (id: {doctor_id})"
    )
    db.add(log)
    db.commit()
    
    return doc
