from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
import datetime

from backend.database.connection import get_db
from backend.database.models import Receptionist, User, AuditLog
from backend.database.schemas import (
    ReceptionistCreate,
    ReceptionistResponse,
    ReceptionistUpdate,
    ReceptionistStatusUpdate,
    ReceptionistResetPassword
)
from backend.services.auth_service import get_password_hash, RoleChecker

router = APIRouter(prefix="/api/receptionists", tags=["Receptionists"])

admin_only = RoleChecker(["Admin"])

def format_receptionist_response(rec: Receptionist) -> dict:
    return {
        "id": rec.id,
        "user_id": rec.user_id,
        "username": rec.user.username if rec.user else "",
        "name": rec.name,
        "email": rec.email,
        "phone": rec.phone,
        "is_active": rec.is_active if rec.is_active is not None else True,
        "created_at": rec.created_at or datetime.datetime.utcnow(),
        "updated_at": rec.updated_at or rec.created_at,
        "last_login": rec.last_login
    }

@router.get("", response_model=List[ReceptionistResponse])
def get_receptionists(
    search: Optional[str] = Query(None, description="Search by name, username, email, or phone"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(search, str):
        search = None
    if not isinstance(is_active, bool):
        is_active = None
    if not isinstance(page, int):
        page = 1
    if not isinstance(limit, int):
        limit = 50

    query = db.query(Receptionist).join(User, Receptionist.user_id == User.id)

    if is_active is not None:
        query = query.filter(Receptionist.is_active == is_active)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Receptionist.name.ilike(search_fmt),
                Receptionist.email.ilike(search_fmt),
                Receptionist.phone.ilike(search_fmt),
                User.username.ilike(search_fmt)
            )
        )

    # Sort newest first
    query = query.order_by(Receptionist.created_at.desc())

    # Pagination
    offset = (page - 1) * limit
    receptionists = query.offset(offset).limit(limit).all()

    return [format_receptionist_response(r) for r in receptionists]

@router.post("", response_model=ReceptionistResponse, status_code=status.HTTP_201_CREATED)
def create_receptionist(
    rec_in: ReceptionistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    # Required fields check
    if not rec_in.name or not rec_in.name.strip():
        raise HTTPException(status_code=400, detail="Full name is required.")
    if not rec_in.username or not rec_in.username.strip():
        raise HTTPException(status_code=400, detail="Username is required.")
    if not rec_in.password or len(rec_in.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    username_clean = rec_in.username.strip()
    email_clean = rec_in.email.strip() if rec_in.email else None
    phone_clean = rec_in.phone.strip() if rec_in.phone else None

    # Duplicate username check
    existing_user = db.query(User).filter(User.username == username_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{username_clean}' is already taken."
        )

    # Duplicate email check
    if email_clean:
        existing_email = db.query(Receptionist).filter(Receptionist.email == email_clean).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{email_clean}' is already in use by another staff member."
            )

    # Duplicate phone check
    if phone_clean:
        existing_phone = db.query(Receptionist).filter(Receptionist.phone == phone_clean).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Phone number '{phone_clean}' is already registered."
            )

    # Create User
    hashed = get_password_hash(rec_in.password)
    user = User(
        username=username_clean,
        hashed_password=hashed,
        role="Receptionist"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create Receptionist
    receptionist = Receptionist(
        user_id=user.id,
        name=rec_in.name.strip(),
        email=email_clean,
        phone=phone_clean,
        is_active=rec_in.is_active if rec_in.is_active is not None else True
    )
    db.add(receptionist)
    db.commit()
    db.refresh(receptionist)

    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="Create Receptionist",
        details=f"Created receptionist profile '{receptionist.name}' (username: {user.username})"
    )
    db.add(log)
    db.commit()

    return format_receptionist_response(receptionist)

@router.put("/{receptionist_id}", response_model=ReceptionistResponse)
def update_receptionist(
    receptionist_id: int,
    rec_update: ReceptionistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    rec = db.query(Receptionist).filter(Receptionist.id == receptionist_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receptionist not found.")

    user = db.query(User).filter(User.id == rec.user_id).first()

    # Validate Username Uniqueness if updated
    if rec_update.username and rec_update.username.strip() != user.username:
        new_username = rec_update.username.strip()
        existing_user = db.query(User).filter(User.username == new_username, User.id != user.id).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{new_username}' is already taken."
            )
        user.username = new_username

    # Validate Email Uniqueness if updated
    if rec_update.email is not None:
        new_email = rec_update.email.strip() if rec_update.email else None
        if new_email and new_email != rec.email:
            existing_email = db.query(Receptionist).filter(Receptionist.email == new_email, Receptionist.id != receptionist_id).first()
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{new_email}' is already registered."
                )
        rec.email = new_email

    # Validate Phone Uniqueness if updated
    if rec_update.phone is not None:
        new_phone = rec_update.phone.strip() if rec_update.phone else None
        if new_phone and new_phone != rec.phone:
            existing_phone = db.query(Receptionist).filter(Receptionist.phone == new_phone, Receptionist.id != receptionist_id).first()
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Phone number '{new_phone}' is already registered."
                )
        rec.phone = new_phone

    if rec_update.name:
        rec.name = rec_update.name.strip()

    if rec_update.is_active is not None:
        rec.is_active = rec_update.is_active

    rec.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rec)

    log = AuditLog(
        user_id=current_user.id,
        action="Update Receptionist",
        details=f"Updated receptionist profile for '{rec.name}' (ID: {receptionist_id})"
    )
    db.add(log)
    db.commit()

    return format_receptionist_response(rec)

@router.put("/{receptionist_id}/status", response_model=ReceptionistResponse)
def toggle_receptionist_status(
    receptionist_id: int,
    is_active: bool = Query(True, description="Set True to enable, False to disable receptionist"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(is_active, bool):
        is_active = True

    rec = db.query(Receptionist).filter(Receptionist.id == receptionist_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receptionist not found.")

    rec.is_active = is_active
    rec.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rec)

    log = AuditLog(
        user_id=current_user.id,
        action="Toggle Receptionist Status",
        details=f"Receptionist '{rec.name}' status changed to active={is_active}"
    )
    db.add(log)
    db.commit()

    return format_receptionist_response(rec)

@router.put("/{receptionist_id}/reset-password", response_model=ReceptionistResponse)
def reset_receptionist_password(
    receptionist_id: int,
    req: ReceptionistResetPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    rec = db.query(Receptionist).filter(Receptionist.id == receptionist_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receptionist not found.")

    if not req.password or len(req.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    user = db.query(User).filter(User.id == rec.user_id).first()
    if user:
        user.hashed_password = get_password_hash(req.password.strip())

    rec.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rec)

    log = AuditLog(
        user_id=current_user.id,
        action="Reset Receptionist Password",
        details=f"Reset password for receptionist '{rec.name}' (ID: {receptionist_id})"
    )
    db.add(log)
    db.commit()

    return format_receptionist_response(rec)
