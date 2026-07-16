import datetime
from sqlalchemy.orm import Session
from backend.database.models import Notification, Patient

def send_patient_notification(
    db: Session,
    patient_id: int,
    notification_type: str,
    message: str,
    channel: str = "SMS"
) -> Notification:
    """
    Mock service to send and store patient notifications (SMS, WhatsApp, Email).
    Simulates sending by printing to console and writing a record to the database.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    patient_name = patient.name if patient else f"ID {patient_id}"
    mobile = patient.mobile_number if patient else "Unknown"

    print("\n" + "="*50)
    print(f"[{notification_type.upper()} NOTIFICATION SENT VIA {channel.upper()}]")
    print(f"To: {patient_name} (Mobile: {mobile})")
    print(f"Message: {message}")
    print("="*50 + "\n")

    db_notification = Notification(
        patient_id=patient_id,
        type=notification_type,
        message=message,
        channel=channel,
        status="Sent",
        created_at=datetime.datetime.utcnow()
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    return db_notification
