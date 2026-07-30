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
    email: Optional[str] = None
    is_available: bool = True
    is_active: bool = True
    status_text: Optional[str] = "Available"
    working_days: Optional[str] = "Mon,Tue,Wed,Thu,Fri"
    working_hours_start: Optional[str] = "09:00"
    working_hours_end: Optional[str] = "17:00"
    avg_consultation_time: Optional[int] = 15

class DoctorCreate(DoctorBase):
    username: str
    password: str
    department_id: int

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    room_number: Optional[str] = None
    email: Optional[str] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None
    status_text: Optional[str] = None
    working_days: Optional[str] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None
    avg_consultation_time: Optional[int] = None
    department_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None

class DoctorScheduleUpdate(BaseModel):
    working_days: str = "Mon,Tue,Wed,Thu,Fri"
    working_hours_start: str = "09:00"
    working_hours_end: str = "17:00"
    avg_consultation_time: int = 15

class DoctorStatusUpdate(BaseModel):
    is_available: Optional[bool] = None
    status_text: Optional[str] = None
    is_active: Optional[bool] = None

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
    dob: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[str] = None
    existing_conditions: Optional[str] = None
    national_id: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_number: Optional[str] = None
    profile_photo: Optional[str] = None
    patient_code: Optional[str] = None

class PatientCreate(PatientBase):
    username: Optional[str] = None
    password: Optional[str] = None

class PatientResponse(PatientBase):
    id: int
    patient_code: Optional[str] = None
    user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PatientProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[str] = None
    existing_conditions: Optional[str] = None
    national_id: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_number: Optional[str] = None
    profile_photo: Optional[str] = None

class DuplicateCheckRequest(BaseModel):
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    national_id: Optional[str] = None
    exclude_patient_id: Optional[int] = None

class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    matches: List[str] = []
    message: str
    existing_patient: Optional[PatientResponse] = None

# --- Appointment Schemas ---
class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int
    department_id: Optional[int] = None
    appointment_type: str = "Scheduled"  # Walk-in, Scheduled
    appointment_time: datetime
    priority: Optional[int] = 3  # 1: Critical, 2: Urgent, 3: Normal
    reason: Optional[str] = None
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    patient_id: Optional[int] = None
    doctor_id: Optional[int] = None
    department_id: Optional[int] = None
    appointment_type: Optional[str] = None
    appointment_time: Optional[datetime] = None
    priority: Optional[int] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class AppointmentReschedule(BaseModel):
    appointment_time: datetime

class AppointmentCheckIn(BaseModel):
    priority_level: Optional[int] = 3

class TimeSlot(BaseModel):
    time: str
    datetime_iso: str
    available: bool
    booking_id: Optional[int] = None
    patient_name: Optional[str] = None

class DoctorAvailabilityResponse(BaseModel):
    doctor_id: int
    doctor_name: str
    date: str
    is_available: bool
    total_slots: int
    available_slots_count: int
    slots: List[TimeSlot]

class AppointmentResponse(AppointmentBase):
    id: int
    status: str
    created_at: datetime
    patient: Optional[PatientResponse] = None
    doctor: Optional[DoctorResponse] = None
    department: Optional[DepartmentResponse] = None

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
    consultation_outcome: Optional[str] = "Discharge"
    discharge_summary: Optional[str] = None
    patient_instructions: Optional[str] = None
    medical_certificate: Optional[bool] = False
    next_review_required: Optional[bool] = False
    followup_date: Optional[str] = None
    followup_time: Optional[str] = None
    followup_reason: Optional[str] = None
    followup_priority: Optional[str] = None
    admission_reason: Optional[str] = None
    ward: Optional[str] = None
    expected_stay: Optional[str] = None
    bed_number: Optional[str] = None
    referral_department: Optional[str] = None
    referral_doctor: Optional[str] = None
    referral_reason: Optional[str] = None
    referral_notes: Optional[str] = None

class ConsultationCreate(ConsultationBase):
    lab_requests: Optional[List[dict]] = []

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
