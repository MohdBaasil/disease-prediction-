import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Admin, Receptionist, Doctor, Patient
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    doctor = relationship("Doctor", back_populates="user", uselist=False, cascade="all, delete-orphan")
    patient = relationship("Patient", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)  # e.g., 'G' for General Medicine, 'C' for Cardiology
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    doctors = relationship("Doctor", back_populates="department", cascade="all, delete")
    queues = relationship("Queue", back_populates="department", cascade="all, delete")

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String, nullable=False)
    specialization = Column(String, nullable=False)
    room_number = Column(String, nullable=False)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="doctor")
    department = relationship("Department", back_populates="doctors")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete")
    queues = relationship("Queue", back_populates="doctor", cascade="all, delete")
    consultations = relationship("Consultation", back_populates="doctor", cascade="all, delete")
    visits = relationship("Visit", back_populates="doctor", cascade="all, delete")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    blood_group = Column(String, nullable=True)
    allergies = Column(Text, nullable=True)
    profile_photo = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    mobile_number = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete")
    queues = relationship("Queue", back_populates="patient", cascade="all, delete")
    consultations = relationship("Consultation", back_populates="patient", cascade="all, delete")
    notifications = relationship("Notification", back_populates="patient", cascade="all, delete")
    visits = relationship("Visit", back_populates="patient", cascade="all, delete")
    reports = relationship("MedicalReport", back_populates="patient", cascade="all, delete")
    disease_predictions = relationship("DiseasePredictionLog", back_populates="patient", cascade="all, delete")
    prediction_histories = relationship("PredictionHistory", back_populates="patient", cascade="all, delete")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    appointment_type = Column(String, default="Scheduled")  # Walk-in, Scheduled
    appointment_time = Column(DateTime, nullable=False)
    status = Column(String, default="Scheduled")  # Scheduled, Completed, Cancelled
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")

class Queue(Base):
    __tablename__ = "queue"

    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String, nullable=False)  # G001, C001
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    priority_level = Column(Integer, default=3)  # 1: Critical, 2: Urgent, 3: Normal
    status = Column(String, default="Waiting")  # Waiting, Calling, Skipped, Completed
    checked_in_time = Column(DateTime, default=datetime.datetime.utcnow)
    call_time = Column(DateTime, nullable=True)
    completion_time = Column(DateTime, nullable=True)
    estimated_wait_time = Column(Float, default=0.0)  # minutes
    position = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="queues")
    doctor = relationship("Doctor", back_populates="queues")
    patient = relationship("Patient", back_populates="queues")
    predictions = relationship("Prediction", back_populates="queue", cascade="all, delete")

class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    symptoms = Column(Text, nullable=False)
    diagnosis = Column(Text, nullable=False)
    prescription = Column(Text, nullable=False)
    duration_minutes = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    doctor = relationship("Doctor", back_populates="consultations")
    patient = relationship("Patient", back_populates="consultations")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    queue_id = Column(Integer, ForeignKey("queue.id", ondelete="CASCADE"), nullable=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    patients_waiting = Column(Integer, nullable=False)
    emergency_patients_waiting = Column(Integer, nullable=False)
    doctor_workload = Column(Integer, nullable=False)
    time_of_day_minutes = Column(Integer, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    predicted_wait_time = Column(Float, nullable=False)
    actual_wait_time = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    queue = relationship("Queue", back_populates="predictions")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, default="Notification")
    type = Column(String, nullable=False)  # TokenGenerated, AppointmentDelayed, PatientNext, DoctorAvailable
    message = Column(Text, nullable=False)
    channel = Column(String, nullable=False)  # SMS, WhatsApp, Email
    status = Column(String, default="Sent")  # Sent, Failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="notifications")

class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    department = Column(String, nullable=False)
    visit_date = Column(DateTime, default=datetime.datetime.utcnow)
    diagnosis = Column(Text, nullable=True)
    chief_complaint = Column(Text, nullable=True)
    doctor_notes = Column(Text, nullable=True)
    follow_up_date = Column(DateTime, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="visits")
    doctor = relationship("Doctor", back_populates="visits")
    prescriptions = relationship("PrescriptionItem", back_populates="visit", cascade="all, delete")
    reports = relationship("MedicalReport", back_populates="visit", cascade="all, delete")

class PrescriptionItem(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id", ondelete="CASCADE"), nullable=False)
    medicine_name = Column(String, nullable=False)
    dosage = Column(String, nullable=False)
    frequency = Column(String, nullable=False)
    duration = Column(String, nullable=False)
    instructions = Column(Text, nullable=True)

    # Relationships
    visit = relationship("Visit", back_populates="prescriptions")

class MedicalReport(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id", ondelete="SET NULL"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    report_name = Column(String, nullable=False)
    report_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    visit = relationship("Visit", back_populates="reports")
    patient = relationship("Patient", back_populates="reports")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

class DiseasePredictionLog(Base):
    __tablename__ = "disease_prediction_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    vitals = Column(Text, nullable=False)  # JSON formatted string
    symptoms = Column(Text, nullable=False)  # JSON formatted string
    predicted_disease = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="disease_predictions")

class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    predicted_disease = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    symptoms = Column(Text, nullable=False)  # JSON formatted list of strings
    prediction_time = Column(DateTime, default=datetime.datetime.utcnow)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="prediction_histories")
