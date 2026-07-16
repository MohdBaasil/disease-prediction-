from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database.connection import get_db
from backend.database.models import Notification, User
from backend.database.schemas import NotificationResponse
from backend.services.auth_service import RoleChecker

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
def get_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin"]))
):
    return db.query(Notification).order_by(Notification.created_at.desc()).all()

@router.get("/patient/{patient_id}", response_model=List[NotificationResponse])
def get_patient_notifications(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist", "Patient"]))
):
    # Verify patient permissions: patients can only view their own notifications
    if current_user.role == "Patient":
        from backend.database.models import Patient
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient or patient.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Permission denied")
            
    return db.query(Notification).filter(Notification.patient_id == patient_id).order_by(Notification.created_at.desc()).all()
