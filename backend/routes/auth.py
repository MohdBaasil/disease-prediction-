from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from backend.database.connection import get_db
from backend.database.models import User, Patient, AuditLog
from backend.database.schemas import UserCreate, UserResponse, Token, UserLogin
from backend.services.auth_service import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if username exists
    existing_user = db.query(User).filter(User.username == user_in.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Restrict general registration to Patient and Receptionist. Doctors are created by Admin or Doctor endpoints.
    if user_in.role not in ["Patient", "Receptionist", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role configuration for self-registration"
        )

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        hashed_password=hashed_password,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If role is Patient, also create the patient profile automatically
    if new_user.role == "Patient":
        # Create default patient details matching the user
        new_patient = Patient(
            user_id=new_user.id,
            name=new_user.username,  # default name
            age=30,                  # default
            gender="Other",          # default
            mobile_number=""         # default
        )
        db.add(new_patient)
        db.commit()

    # Log audit entry
    log = AuditLog(
        user_id=new_user.id,
        action="Register",
        details=f"User {new_user.username} registered with role {new_user.role}"
    )
    db.add(log)
    db.commit()

    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = None
    patient = None
    
    # 1. Check if username is an email address
    if "@" in form_data.username:
        patient = db.query(Patient).filter(Patient.email == form_data.username).first()
        
    # 2. Check if username is a numeric Patient ID
    elif form_data.username.isdigit():
        patient = db.query(Patient).filter(Patient.id == int(form_data.username)).first()
        
    # If patient profile was found, load the linked User
    if patient and patient.user_id:
        user = db.query(User).filter(User.id == patient.user_id).first()
        
    # 3. Fallback: Lookup by User.username directly (e.g. Doctor, Receptionist, Admin, or Patient Username)
    if not user:
        user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    
    # Audit log
    log = AuditLog(
        user_id=user.id,
        action="Login",
        details=f"User {user.username} logged in successfully"
    )
    db.add(log)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
