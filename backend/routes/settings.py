from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import datetime
import re

from backend.database.connection import get_db
from backend.database.models import SystemSettings, User, AuditLog
from backend.database.schemas import (
    SystemSettingsResponse,
    SystemSettingsUpdate
)
from backend.services.auth_service import RoleChecker

router = APIRouter(prefix="/api/settings", tags=["System Settings"])

admin_only = RoleChecker(["Admin"])

def get_or_create_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.get("", response_model=SystemSettingsResponse)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    settings = get_or_create_settings(db)
    return settings

@router.put("", response_model=SystemSettingsResponse)
def update_system_settings(
    settings_update: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    settings = get_or_create_settings(db)

    # 1. Hospital General Validations
    if settings_update.hospital_name is not None:
        if not settings_update.hospital_name.strip():
            raise HTTPException(status_code=400, detail="Hospital name cannot be empty.")
        settings.hospital_name = settings_update.hospital_name.strip()

    if settings_update.hospital_code is not None:
        if not settings_update.hospital_code.strip():
            raise HTTPException(status_code=400, detail="Hospital code cannot be empty.")
        settings.hospital_code = settings_update.hospital_code.strip().upper()

    if settings_update.hospital_address is not None:
        settings.hospital_address = settings_update.hospital_address.strip() if settings_update.hospital_address else None

    if settings_update.hospital_phone is not None:
        settings.hospital_phone = settings_update.hospital_phone.strip() if settings_update.hospital_phone else None

    if settings_update.hospital_email is not None:
        email_val = settings_update.hospital_email.strip() if settings_update.hospital_email else None
        if email_val and "@" not in email_val:
            raise HTTPException(status_code=400, detail="Invalid hospital email address format.")
        settings.hospital_email = email_val

    if settings_update.hospital_website is not None:
        settings.hospital_website = settings_update.hospital_website.strip() if settings_update.hospital_website else None

    if settings_update.hospital_logo is not None:
        settings.hospital_logo = settings_update.hospital_logo.strip() if settings_update.hospital_logo else None

    # 2. Appointment Validations
    if settings_update.appointment_duration_minutes is not None:
        if settings_update.appointment_duration_minutes <= 0:
            raise HTTPException(status_code=400, detail="Appointment duration must be greater than 0 minutes.")
        settings.appointment_duration_minutes = settings_update.appointment_duration_minutes

    if settings_update.booking_interval_minutes is not None:
        if settings_update.booking_interval_minutes <= 0:
            raise HTTPException(status_code=400, detail="Booking interval must be greater than 0 minutes.")
        settings.booking_interval_minutes = settings_update.booking_interval_minutes

    if settings_update.max_daily_appointments is not None:
        if settings_update.max_daily_appointments <= 0:
            raise HTTPException(status_code=400, detail="Maximum daily appointments must be greater than 0.")
        settings.max_daily_appointments = settings_update.max_daily_appointments

    if settings_update.allow_walk_in is not None:
        settings.allow_walk_in = settings_update.allow_walk_in

    # 3. Queue Validations
    if settings_update.queue_prefix is not None:
        prefix_val = settings_update.queue_prefix.strip().upper()
        if not prefix_val or len(prefix_val) > 5:
            raise HTTPException(status_code=400, detail="Queue prefix must be between 1 and 5 characters.")
        settings.queue_prefix = prefix_val

    if settings_update.auto_generate_tokens is not None:
        settings.auto_generate_tokens = settings_update.auto_generate_tokens

    if settings_update.emergency_priority_enabled is not None:
        settings.emergency_priority_enabled = settings_update.emergency_priority_enabled

    if settings_update.queue_reset_daily is not None:
        settings.queue_reset_daily = settings_update.queue_reset_daily

    # 4. Notifications Validations
    if settings_update.email_notifications is not None:
        settings.email_notifications = settings_update.email_notifications

    if settings_update.sms_notifications is not None:
        settings.sms_notifications = settings_update.sms_notifications

    if settings_update.appointment_reminders is not None:
        settings.appointment_reminders = settings_update.appointment_reminders

    if settings_update.reminder_hours_before is not None:
        if not (1 <= settings_update.reminder_hours_before <= 72):
            raise HTTPException(status_code=400, detail="Reminder hours before appointment must be between 1 and 72 hours.")
        settings.reminder_hours_before = settings_update.reminder_hours_before

    # 5. AI Configuration Validations
    if settings_update.ai_recommendations_enabled is not None:
        settings.ai_recommendations_enabled = settings_update.ai_recommendations_enabled

    if settings_update.ai_confidence_threshold is not None:
        if not (0.0 <= settings_update.ai_confidence_threshold <= 100.0):
            raise HTTPException(status_code=400, detail="AI confidence threshold must be between 0 and 100 percent.")
        settings.ai_confidence_threshold = settings_update.ai_confidence_threshold

    # 6. Localization
    if settings_update.timezone is not None:
        settings.timezone = settings_update.timezone
    if settings_update.date_format is not None:
        settings.date_format = settings_update.date_format
    if settings_update.time_format is not None:
        settings.time_format = settings_update.time_format
    if settings_update.language is not None:
        settings.language = settings_update.language

    # 7. Appearance
    if settings_update.system_theme is not None:
        settings.system_theme = settings_update.system_theme
    if settings_update.primary_color is not None:
        settings.primary_color = settings_update.primary_color

    settings.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(settings)

    log = AuditLog(
        user_id=current_user.id,
        action="Update System Settings",
        details=f"Updated hospital system settings for '{settings.hospital_name}'"
    )
    db.add(log)
    db.commit()

    return settings
