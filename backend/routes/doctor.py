from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional

from backend.database.connection import get_db
from backend.database.models import Doctor, User, Department, Queue, AuditLog
from backend.database.schemas import (
    DoctorCreate,
    DoctorResponse,
    DoctorUpdate,
    DoctorScheduleUpdate,
    DoctorStatusUpdate
)
from backend.services.auth_service import get_password_hash, RoleChecker, get_current_user

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])

admin_only = RoleChecker(["Admin"])
admin_or_doctor = RoleChecker(["Admin", "Doctor"])

@router.get("/me", response_model=DoctorResponse)
def get_current_doctor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor profile not found for this user account.")
    return doc

@router.get("", response_model=List[DoctorResponse])
def get_doctors(
    search: Optional[str] = Query(None, description="Search by name, specialization, room, email or username"),
    department_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="Filter by status_text: Available, Busy, On Leave, Inactive"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_available: Optional[bool] = Query(None, description="Filter by availability"),
    db: Session = Depends(get_db)
):
    if not isinstance(search, str):
        search = None
    if not isinstance(department_id, int):
        department_id = None
    if not isinstance(status, str):
        status = None
    if not isinstance(is_active, bool):
        is_active = None
    if not isinstance(is_available, bool):
        is_available = None

    query = db.query(Doctor).join(User, Doctor.user_id == User.id)

    if department_id is not None:
        query = query.filter(Doctor.department_id == department_id)

    if is_active is not None:
        query = query.filter(Doctor.is_active == is_active)

    if is_available is not None:
        query = query.filter(Doctor.is_available == is_available)

    if status and status != "All":
        query = query.filter(Doctor.status_text == status)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Doctor.name.ilike(search_fmt),
                Doctor.specialization.ilike(search_fmt),
                Doctor.room_number.ilike(search_fmt),
                Doctor.email.ilike(search_fmt),
                User.username.ilike(search_fmt)
            )
        )

    return query.order_by(Doctor.id.asc()).all()

@router.get("/active", response_model=List[DoctorResponse])
def get_active_doctors(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    if not isinstance(department_id, int):
        department_id = None

    query = db.query(Doctor).filter(Doctor.is_active == True, Doctor.is_available == True)
    if department_id is not None:
        query = query.filter(Doctor.department_id == department_id)
    return query.order_by(Doctor.name.asc()).all()

@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor_by_id(doctor_id: int, db: Session = Depends(get_db)):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    return doc

@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(
    doc_in: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    # Validate duplicate username
    existing_user = db.query(User).filter(User.username == doc_in.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{doc_in.username}' is already taken."
        )

    # Validate duplicate email if provided
    if doc_in.email:
        existing_email = db.query(Doctor).filter(Doctor.email == doc_in.email.strip()).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Doctor with email '{doc_in.email}' already exists."
            )

    # Validate department
    dept = db.query(Department).filter(Department.id == doc_in.department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department not found."
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
        email=doc_in.email.strip() if doc_in.email else None,
        is_available=doc_in.is_available,
        is_active=doc_in.is_active,
        status_text=doc_in.status_text or "Available",
        working_days=doc_in.working_days or "Mon,Tue,Wed,Thu,Fri",
        working_hours_start=doc_in.working_hours_start or "09:00",
        working_hours_end=doc_in.working_hours_end or "17:00",
        avg_consultation_time=doc_in.avg_consultation_time or 15
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="Create Doctor",
        details=f"Created doctor profile for Dr. {doctor.name} (ID: {doctor.id}, username: {user.username})"
    )
    db.add(log)
    db.commit()

    return doctor

@router.put("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(
    doctor_id: int,
    doc_update: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_doctor)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    if current_user.role == "Doctor" and doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own doctor profile."
        )

    # Check Email uniqueness if updated
    if doc_update.email and doc_update.email.strip() != doc.email:
        existing_email = db.query(Doctor).filter(
            Doctor.email == doc_update.email.strip(),
            Doctor.id != doctor_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{doc_update.email}' is already in use by another physician."
            )

    # Check Department
    if doc_update.department_id is not None:
        dept = db.query(Department).filter(Department.id == doc_update.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Department not found.")

    # Update Username/Password if provided by Admin
    if current_user.role == "Admin":
        user = db.query(User).filter(User.id == doc.user_id).first()
        if user:
            if doc_update.username and doc_update.username != user.username:
                existing_user = db.query(User).filter(User.username == doc_update.username, User.id != user.id).first()
                if existing_user:
                    raise HTTPException(status_code=400, detail="Username already exists.")
                user.username = doc_update.username
            if doc_update.password:
                user.hashed_password = get_password_hash(doc_update.password)

    # Apply updates
    update_data = doc_update.model_dump(exclude_unset=True, exclude={"username", "password"})
    for key, value in update_data.items():
        setattr(doc, key, value)

    db.commit()
    db.refresh(doc)

    log = AuditLog(
        user_id=current_user.id,
        action="Update Doctor",
        details=f"Updated doctor profile for Dr. {doc.name} (ID: {doctor_id})"
    )
    db.add(log)
    db.commit()

    return doc

@router.put("/{doctor_id}/schedule", response_model=DoctorResponse)
def update_doctor_schedule(
    doctor_id: int,
    req: DoctorScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_doctor)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    if current_user.role == "Doctor" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied.")

    doc.working_days = req.working_days
    doc.working_hours_start = req.working_hours_start
    doc.working_hours_end = req.working_hours_end
    doc.avg_consultation_time = req.avg_consultation_time

    db.commit()
    db.refresh(doc)

    log = AuditLog(
        user_id=current_user.id,
        action="Update Doctor Schedule",
        details=f"Updated schedule for Dr. {doc.name} (Days: {req.working_days}, Hours: {req.working_hours_start}-{req.working_hours_end})"
    )
    db.add(log)
    db.commit()

    return doc

@router.put("/{doctor_id}/availability", response_model=DoctorResponse)
def update_doctor_availability(
    doctor_id: int,
    req: DoctorStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_doctor)
):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    if current_user.role == "Doctor" and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied.")

    if req.is_available is not None:
        doc.is_available = req.is_available
    if req.status_text is not None:
        doc.status_text = req.status_text
    if req.is_active is not None:
        doc.is_active = req.is_active

    db.commit()
    db.refresh(doc)

    log = AuditLog(
        user_id=current_user.id,
        action="Update Doctor Availability",
        details=f"Updated availability for Dr. {doc.name} (available: {doc.is_available}, status: {doc.status_text})"
    )
    db.add(log)
    db.commit()

    return doc

@router.put("/{doctor_id}/status", response_model=DoctorResponse)
@router.delete("/{doctor_id}", response_model=DoctorResponse)
def toggle_doctor_active_status(
    doctor_id: int,
    is_active: bool = Query(False, description="Set True to enable, False to disable doctor"),
    force: bool = Query(False, description="Force disable even if doctor has active consultations"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(is_active, bool):
        is_active = False
    if not isinstance(force, bool):
        force = False

    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found.")

    # Disabling doctor check
    if not is_active:
        active_patients_count = db.query(func.count(Queue.id)).filter(
            Queue.doctor_id == doctor_id,
            Queue.status.in_(["Waiting", "Calling"])
        ).scalar() or 0

        if active_patients_count > 0 and not force:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dr. {doc.name} currently has {active_patients_count} active patient(s) waiting/in consultation. Please reassign patients or pass force=true to disable anyway."
            )

        doc.is_active = False
        doc.is_available = False
        doc.status_text = "Inactive"
    else:
        doc.is_active = True
        doc.is_available = True
        doc.status_text = "Available"

    db.commit()
    db.refresh(doc)

    log = AuditLog(
        user_id=current_user.id,
        action="Toggle Doctor Active Status",
        details=f"Dr. {doc.name} (ID: {doctor_id}) active status set to {is_active} (forced={force})"
    )
    db.add(log)
    db.commit()

    return doc
