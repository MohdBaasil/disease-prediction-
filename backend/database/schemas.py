from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# --- Token & Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    role: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Department Schemas ---
class DepartmentBase(BaseModel):
    name: str
    code: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Doctor Schemas ---
class DoctorBase(BaseModel):
    name: str
    specialization: str
    room_number: str
    is_available: bool = True

class DoctorCreate(DoctorBase):
    username: str
    password: str
    department_id: int

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    room_number: Optional[str] = None
    is_available: Optional[bool] = None
    department_id: Optional[int] = None

class DoctorResponse(DoctorBase):
    id: int
    user_id: int
    department_id: int
    department: Optional[DepartmentResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Patient Schemas ---
class PatientBase(BaseModel):
    name: str
    age: int
    gender: str
    mobile_number: str
    email: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    profile_photo: Optional[str] = None
    emergency_contact: Optional[str] = None

class PatientCreate(PatientBase):
    username: Optional[str] = None
    password: Optional[str] = None

class PatientResponse(PatientBase):
    id: int
    user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PatientProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    profile_photo: Optional[str] = None
    emergency_contact: Optional[str] = None

# --- Appointment Schemas ---
class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int
    appointment_type: str = "Scheduled"  # Walk-in, Scheduled
    appointment_time: datetime

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentResponse(AppointmentBase):
    id: int
    status: str
    created_at: datetime
    patient: Optional[PatientResponse] = None
    doctor: Optional[DoctorResponse] = None

    class Config:
        from_attributes = True

# --- Queue Schemas ---
class QueueBase(BaseModel):
    patient_id: int
    department_id: int
    doctor_id: Optional[int] = None
    priority_level: int = 3  # 1: Critical, 2: Urgent, 3: Normal

class QueueCreate(QueueBase):
    symptoms: Optional[str] = None
    appointment_type: str = "Walk-in"

class QueueResponse(BaseModel):
    id: int
    token_number: str
    department_id: int
    doctor_id: Optional[int] = None
    patient_id: int
    priority_level: int
    status: str
    checked_in_time: datetime
    call_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    estimated_wait_time: float
    position: Optional[int] = None
    patient: PatientResponse
    doctor: Optional[DoctorResponse] = None
    department: DepartmentResponse

    class Config:
        from_attributes = True

# --- Consultation Schemas ---
class ConsultationBase(BaseModel):
    patient_id: int
    symptoms: str
    diagnosis: str
    prescription: str
    duration_minutes: int = 15

class ConsultationCreate(ConsultationBase):
    pass

class ConsultationResponse(ConsultationBase):
    id: int
    doctor_id: int
    created_at: datetime
    doctor: Optional[DoctorResponse] = None

    class Config:
        from_attributes = True

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: int
    patient_id: int
    title: str
    type: str
    message: str
    channel: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Visit, Prescription & Report Schemas ---
class PrescriptionItemBase(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None

class PrescriptionItemCreate(PrescriptionItemBase):
    pass

class PrescriptionItemResponse(PrescriptionItemBase):
    id: int
    visit_id: int

    class Config:
        from_attributes = True

class MedicalReportResponse(BaseModel):
    id: int
    visit_id: Optional[int] = None
    patient_id: int
    report_name: str
    report_type: str
    file_path: str
    upload_date: datetime

    class Config:
        from_attributes = True

class VisitResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    department: str
    visit_date: datetime
    diagnosis: Optional[str] = None
    chief_complaint: Optional[str] = None
    doctor_notes: Optional[str] = None
    follow_up_date: Optional[datetime] = None
    prescriptions: List[PrescriptionItemResponse] = []
    reports: List[MedicalReportResponse] = []
    doctor: Optional[DoctorResponse] = None

    class Config:
        from_attributes = True

# --- Audit Log Schemas ---
class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    details: str
    created_at: datetime

    class Config:
        from_attributes = True
