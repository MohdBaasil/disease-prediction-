from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
import datetime

from backend.database.connection import get_db
from backend.database.models import User, Doctor, Receptionist, Patient, Department, AuditLog
from backend.database.schemas import (
    UserCreate,
    UserResponse,
    UserUpdate,
    UserStatusUpdate,
    UserResetPassword
)
from backend.services.auth_service import RoleChecker, get_password_hash

router = APIRouter(prefix="/api/users", tags=["User Management"])

admin_only = RoleChecker(["Admin"])

VALID_ROLES = ["Admin", "Doctor", "Receptionist", "Patient"]

def build_user_response(user: User, db: Session) -> dict:
    name = None
    email = user.email
    is_active = user.is_active if user.is_active is not None else True
    profile_info = {}

    if user.role == "Doctor" and user.doctor:
        name = user.doctor.name
        email = user.doctor.email or email
        profile_info = {
            "doctor_id": user.doctor.id,
            "specialization": user.doctor.specialization,
            "room_number": user.doctor.room_number,
            "department_name": user.doctor.department.name if user.doctor.department else "Unassigned",
            "is_available": user.doctor.is_available
        }
    elif user.role == "Receptionist" and user.receptionist:
        name = user.receptionist.name
        email = user.receptionist.email or email
        profile_info = {
            "receptionist_id": user.receptionist.id,
            "phone": user.receptionist.phone
        }
    elif user.role == "Patient" and user.patient:
        name = user.patient.name
        email = user.patient.email or email
        profile_info = {
            "patient_id": user.patient.id,
            "patient_code": user.patient.patient_code or f"PAT-{user.patient.id:06d}",
            "gender": user.patient.gender
        }
    else:
        name = user.username

    return {
        "id": user.id,
        "username": user.username,
        "email": email,
        "name": name or user.username,
        "role": user.role,
        "is_active": is_active,
        "created_at": user.created_at or datetime.datetime.utcnow(),
        "updated_at": user.updated_at or user.created_at,
        "last_login": user.last_login,
        "profile_info": profile_info
    }

@router.get("", response_model=List[UserResponse])
def get_users(
    search: Optional[str] = Query(None, description="Search by username, email, or profile name"),
    role: Optional[str] = Query(None, description="Filter by role (Admin, Doctor, Receptionist, Patient)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(search, str):
        search = None
    if not isinstance(role, str) or role.capitalize() not in VALID_ROLES and role != "all":
        role = None
    elif role and role != "all":
        role = role.capitalize()
    if not isinstance(is_active, bool):
        is_active = None

    query = db.query(User)

    if role and role != "all":
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.outerjoin(Doctor, User.id == Doctor.user_id)\
                     .outerjoin(Receptionist, User.id == Receptionist.user_id)\
                     .outerjoin(Patient, User.id == Patient.user_id)\
                     .filter(
                         or_(
                             User.username.ilike(search_fmt),
                             User.email.ilike(search_fmt),
                             Doctor.name.ilike(search_fmt),
                             Doctor.email.ilike(search_fmt),
                             Receptionist.name.ilike(search_fmt),
                             Receptionist.email.ilike(search_fmt),
                             Patient.name.ilike(search_fmt)
                         )
                     )

    users = query.order_by(User.created_at.desc()).all()
    return [build_user_response(u, db) for u in users]

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return build_user_response(user, db)

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not user_in.username or not user_in.username.strip():
        raise HTTPException(status_code=400, detail="Username is required.")
    if not user_in.password or len(user_in.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    
    role_clean = user_in.role.capitalize() if user_in.role else "Patient"
    if role_clean not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{user_in.role}'. Allowed roles: {', '.join(VALID_ROLES)}")

    username_clean = user_in.username.strip()
    email_clean = user_in.email.strip() if user_in.email else None
    name_clean = user_in.name.strip() if user_in.name else username_clean

    # Validate unique username
    existing_user = db.query(User).filter(func.lower(User.username) == username_clean.lower()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail=f"Username '{username_clean}' is already taken.")

    # Validate unique email if provided
    if email_clean:
        existing_email = db.query(User).filter(func.lower(User.email) == email_clean.lower()).first()
        if not existing_email:
            existing_email = db.query(Doctor).filter(func.lower(Doctor.email) == email_clean.lower()).first()
        if not existing_email:
            existing_email = db.query(Receptionist).filter(func.lower(Receptionist.email) == email_clean.lower()).first()
        if existing_email:
            raise HTTPException(status_code=400, detail=f"Email '{email_clean}' is already in use.")

    # Create User
    new_user = User(
        username=username_clean,
        hashed_password=get_password_hash(user_in.password),
        role=role_clean,
        email=email_clean,
        is_active=user_in.is_active if user_in.is_active is not None else True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Automatically create linked profiles based on role
    if role_clean == "Doctor":
        dept = db.query(Department).filter(Department.is_active == True).first()
        dept_id = dept.id if dept else 1
        new_doc = Doctor(
            user_id=new_user.id,
            name=name_clean,
            specialization="General Medicine",
            room_number="101",
            email=email_clean,
            department_id=dept_id,
            is_active=new_user.is_active
        )
        db.add(new_doc)
        db.commit()

    elif role_clean == "Receptionist":
        new_rec = Receptionist(
            user_id=new_user.id,
            name=name_clean,
            email=email_clean,
            is_active=new_user.is_active
        )
        db.add(new_rec)
        db.commit()

    elif role_clean == "Patient":
        existing_patient = db.query(Patient).filter(Patient.user_id == new_user.id).first()
        if not existing_patient:
            new_patient = Patient(
                user_id=new_user.id,
                name=name_clean,
                email=email_clean,
                gender="Other",
                age=30
            )
            db.add(new_patient)
            db.commit()

    log = AuditLog(
        user_id=current_user.id,
        action="Create User",
        details=f"Created {role_clean} user '{new_user.username}' (ID: {new_user.id})"
    )
    db.add(log)
    db.commit()

    return build_user_response(new_user, db)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_update.username and user_update.username.strip() != user.username:
        new_uname = user_update.username.strip()
        existing = db.query(User).filter(func.lower(User.username) == new_uname.lower(), User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Username '{new_uname}' is already taken.")
        user.username = new_uname

    if user_update.email is not None and user_update.email.strip() != (user.email or ""):
        new_email = user_update.email.strip() if user_update.email.strip() else None
        if new_email:
            existing = db.query(User).filter(func.lower(User.email) == new_email.lower(), User.id != user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Email '{new_email}' is already in use.")
        user.email = new_email

    if user_update.role and user_update.role.capitalize() in VALID_ROLES:
        user.role = user_update.role.capitalize()

    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    user.updated_at = datetime.datetime.utcnow()

    # Synchronize linked profile details
    new_name = user_update.name.strip() if user_update.name else None

    if user.role == "Doctor":
        if not user.doctor:
            dept = db.query(Department).filter(Department.is_active == True).first()
            dept_id = dept.id if dept else 1
            user.doctor = Doctor(user_id=user.id, name=new_name or user.username, specialization="General Medicine", room_number="101", department_id=dept_id)
        if new_name:
            user.doctor.name = new_name
        if user_update.email is not None:
            user.doctor.email = user.email
        if user_update.is_active is not None:
            user.doctor.is_active = user.is_active

    elif user.role == "Receptionist":
        if not user.receptionist:
            user.receptionist = Receptionist(user_id=user.id, name=new_name or user.username)
        if new_name:
            user.receptionist.name = new_name
        if user_update.email is not None:
            user.receptionist.email = user.email
        if user_update.is_active is not None:
            user.receptionist.is_active = user.is_active

    elif user.role == "Patient" and user.patient:
        if new_name:
            user.patient.name = new_name
        if user_update.email is not None:
            user.patient.email = user.email

    db.commit()
    db.refresh(user)

    log = AuditLog(
        user_id=current_user.id,
        action="Update User",
        details=f"Updated user '{user.username}' (Role: {user.role})"
    )
    db.add(log)
    db.commit()

    return build_user_response(user, db)

@router.put("/{user_id}/status", response_model=UserResponse)
def toggle_user_status(
    user_id: int,
    is_active: bool = Query(True, description="Set True to enable, False to disable user account"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(is_active, bool):
        is_active = True

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = is_active
    user.updated_at = datetime.datetime.utcnow()

    # Sync to linked profiles
    if user.doctor:
        user.doctor.is_active = is_active
    if user.receptionist:
        user.receptionist.is_active = is_active

    db.commit()
    db.refresh(user)

    log = AuditLog(
        user_id=current_user.id,
        action="Toggle User Status",
        details=f"User '{user.username}' status set to is_active={is_active}"
    )
    db.add(log)
    db.commit()

    return build_user_response(user, db)

@router.put("/{user_id}/reset-password", response_model=UserResponse)
def reset_user_password(
    user_id: int,
    req: UserResetPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = get_password_hash(req.password)
    user.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(user)

    log = AuditLog(
        user_id=current_user.id,
        action="Reset User Password",
        details=f"Reset password for user '{user.username}' (ID: {user_id})"
    )
    db.add(log)
    db.commit()

    return build_user_response(user, db)
