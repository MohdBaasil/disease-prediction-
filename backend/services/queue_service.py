import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from backend.database.models import Queue, Department, Doctor, Patient, Consultation, Prediction, Visit, PrescriptionItem
from backend.machine_learning.prediction import predict_waiting_time

def generate_token_number(db: Session, department_id: int) -> str:
    """
    Generates a token number like G001, C001, O002 based on department code
    and the number of patients registered today.
    """
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise ValueError("Department not found")
        
    code = dept.code.upper()
    
    # Get start of today
    today = datetime.datetime.utcnow().date()
    start_of_today = datetime.datetime.combine(today, datetime.time.min)
    
    # Count tokens in this department checked in today
    count = db.query(func.count(Queue.id)).filter(
        Queue.department_id == department_id,
        Queue.checked_in_time >= start_of_today
    ).scalar()
    
    next_num = count + 1
    return f"{code}{next_num:03d}"

def calculate_priority_score(checked_in_time: datetime.datetime, priority_level: int) -> float:
    """
    Calculates dynamic priority score using Aging Algorithm:
    Score = WaitTimeMinutes + PriorityBonus
    - Priority 1 (Critical): Bonus of 120 minutes
    - Priority 2 (Urgent): Bonus of 30 minutes
    - Priority 3 (Normal): Bonus of 0 minutes
    """
    now = datetime.datetime.utcnow()
    wait_time_minutes = (now - checked_in_time).total_seconds() / 60.0
    
    bonus = 0.0
    if priority_level == 1:
        bonus = 120.0
    elif priority_level == 2:
        bonus = 30.0
        
    return wait_time_minutes + bonus

def reorder_queue(db: Session, department_id: int, doctor_id: Optional[int] = None):
    """
    Reorders the waiting queue for a department (and optional doctor), updates positions,
    and recalculates estimated waiting times for everyone in the queue using the ML model.
    """
    # 1. Fetch all active waiting or skipped patients
    # We ignore calling/completed patients as they are already out of the waiting queue.
    active_queue = db.query(Queue).filter(
        Queue.department_id == department_id,
        Queue.status.in_(["Waiting", "Skipped"])
    ).all()
    
    if not active_queue:
        return
        
    # Calculate score for each
    scored_items = []
    for item in active_queue:
        score = calculate_priority_score(item.checked_in_time, item.priority_level)
        scored_items.append((score, item))
        
    # Sort by score descending (highest score first)
    scored_items.sort(key=lambda x: x[0], reverse=True)
    
    # Get doctor workload if doctor_id is specified
    workload = 0
    doc_avg_duration = 15.0  # default fallback
    doc_specialization = "General"
    
    if doctor_id:
        doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        if doc:
            doc_specialization = doc.specialization
            # Count completed consultations by this doctor today
            today = datetime.datetime.utcnow().date()
            start_of_today = datetime.datetime.combine(today, datetime.time.min)
            workload = db.query(func.count(Consultation.id)).filter(
                Consultation.doctor_id == doctor_id,
                Consultation.created_at >= start_of_today
            ).scalar()
            
            # Fetch average consultation duration for this doctor historically, or fallback to default
            avg_duration_query = db.query(func.avg(Consultation.duration_minutes)).filter(
                Consultation.doctor_id == doctor_id
            ).scalar()
            if avg_duration_query:
                doc_avg_duration = float(avg_duration_query)
                
    # 2. Update positions and run ML waiting time prediction
    now = datetime.datetime.utcnow()
    day_of_week = now.weekday()
    time_of_day_minutes = now.hour * 60 + now.minute
    
    emergency_ahead = 0
    for index, (score, item) in enumerate(scored_items):
        pos = index + 1
        item.position = pos
        
        # Count patients waiting ahead of this patient
        patients_ahead = index
        
        # Calculate predicted wait time
        est_wait = predict_waiting_time(
            doctor_id=doctor_id or 0,
            department=item.department.name if item.department else "General Medicine",
            day_of_week=day_of_week,
            time_of_day_minutes=time_of_day_minutes,
            patients_waiting=patients_ahead,
            emergency_patients_waiting=emergency_ahead,
            doctor_workload=workload,
            avg_consultation_time=doc_avg_duration
        )
        
        item.estimated_wait_time = round(est_wait, 2)
        
        # Track emergency patients ahead for the next loops
        if item.priority_level in [1, 2]:
            emergency_ahead += 1
            
        # Create prediction log record in db
        pred_record = Prediction(
            queue_id=item.id,
            doctor_id=doctor_id or 0,
            department_id=department_id,
            patients_waiting=patients_ahead,
            emergency_patients_waiting=emergency_ahead,
            doctor_workload=workload,
            time_of_day_minutes=time_of_day_minutes,
            day_of_week=day_of_week,
            predicted_wait_time=item.estimated_wait_time
        )
        db.add(pred_record)
        
    db.commit()

def add_patient_to_queue(
    db: Session,
    patient_id: int,
    department_id: int,
    priority_level: int = 3,
    doctor_id: Optional[int] = None
) -> Queue:
    """
    Registers a patient check-in, generates their token, adds them to the queue, and updates predictions.
    """
    # Verify patient
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise ValueError("Patient not found")
        
    # Generate token
    token = generate_token_number(db, department_id)
    
    # Create queue entry
    queue_entry = Queue(
        token_number=token,
        department_id=department_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        priority_level=priority_level,
        status="Waiting",
        checked_in_time=datetime.datetime.utcnow(),
        estimated_wait_time=0.0
    )
    
    db.add(queue_entry)
    db.commit()
    db.refresh(queue_entry)
    
    # Reorder queue to update positions and run ML wait predictions
    reorder_queue(db, department_id, doctor_id)
    db.refresh(queue_entry)
    
    return queue_entry

def call_next_patient(db: Session, doctor_id: int) -> Optional[Queue]:
    """
    Calls the next patient in the queue for a doctor's department.
    """
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise ValueError("Doctor not found")
        
    # First, make sure we complete or skip any current patient this doctor is calling
    current_calling = db.query(Queue).filter(
        Queue.doctor_id == doctor_id,
        Queue.status == "Calling"
    ).first()
    if current_calling:
        # Auto-skip if they call next without completing previous
        current_calling.status = "Skipped"
        
    # Find next patient in this doctor's department.
    # Patients are ordered by position (which has already been sorted by priority aging score)
    next_patient = db.query(Queue).filter(
        Queue.department_id == doc.department_id,
        Queue.status.in_(["Waiting", "Skipped"])
    ).order_by(Queue.position.asc()).first()
    
    if not next_patient:
        db.commit()
        return None
        
    # Update status to Calling
    next_patient.status = "Calling"
    next_patient.doctor_id = doctor_id
    next_patient.call_time = datetime.datetime.utcnow()
    next_patient.position = 0 # No longer in waiting position
    
    db.commit()
    db.refresh(next_patient)
    
    # Reorder the remaining queue
    reorder_queue(db, doc.department_id, doctor_id)
    
    return next_patient

def complete_consultation(
    db: Session,
    queue_id: int,
    symptoms: str,
    diagnosis: str,
    prescription: str,
    duration_minutes: int = 15
) -> Queue:
    """
    Marks a consultation completed, records details, logs actual wait time, and updates queue positions.
    """
    queue_entry = db.query(Queue).filter(Queue.id == queue_id).first()
    if not queue_entry:
        raise ValueError("Queue entry not found")
        
    now = datetime.datetime.utcnow()
    queue_entry.status = "Completed"
    queue_entry.completion_time = now
    queue_entry.position = None
    
    # Calculate actual wait time (checked_in_time to call_time)
    actual_wait = 0.0
    if queue_entry.call_time:
        actual_wait = (queue_entry.call_time - queue_entry.checked_in_time).total_seconds() / 60.0
        
    # Create Consultation
    consultation = Consultation(
        doctor_id=queue_entry.doctor_id,
        patient_id=queue_entry.patient_id,
        symptoms=symptoms,
        diagnosis=diagnosis,
        prescription=prescription,
        duration_minutes=duration_minutes
    )
    db.add(consultation)
    db.commit()

    # Create Visit record for Patient Medical History log
    visit = Visit(
        patient_id=queue_entry.patient_id,
        doctor_id=queue_entry.doctor_id,
        department=queue_entry.department.name if queue_entry.department else "General Medicine",
        visit_date=now,
        diagnosis=diagnosis,
        chief_complaint=symptoms,
        doctor_notes="Completed consultation session.",
        follow_up_date=now + datetime.timedelta(days=7)
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # Parse prescription details and insert into prescriptions table
    if prescription:
        for line in prescription.split('\n'):
            line_clean = line.strip()
            if not line_clean:
                continue
            
            # Simple splitter logic: "Medicine, Dosage, Frequency, Duration, Instructions"
            parts = [p.strip() for p in line_clean.split(',')]
            med_name = parts[0]
            med_dosage = parts[1] if len(parts) >= 2 else "As directed"
            med_freq = parts[2] if len(parts) >= 3 else "Daily"
            med_dur = parts[3] if len(parts) >= 4 else "7 days"
            med_inst = parts[4] if len(parts) >= 5 else ""
            
            item = PrescriptionItem(
                visit_id=visit.id,
                medicine_name=med_name,
                dosage=med_dosage,
                frequency=med_freq,
                duration=med_dur,
                instructions=med_inst
            )
            db.add(item)
        db.commit()
    
    # Update actual wait time in prediction logs for future training
    db.query(Prediction).filter(Prediction.queue_id == queue_id).update({
        Prediction.actual_wait_time: actual_wait
    })
    db.commit()
    
    # Reorder queue
    reorder_queue(db, queue_entry.department_id, queue_entry.doctor_id)
    db.refresh(queue_entry)
    
    return queue_entry

def skip_patient(db: Session, queue_id: int) -> Queue:
    """
    Skips the current calling patient.
    """
    queue_entry = db.query(Queue).filter(Queue.id == queue_id).first()
    if not queue_entry:
        raise ValueError("Queue entry not found")
        
    queue_entry.status = "Skipped"
    queue_entry.call_time = None
    db.commit()
    
    # Reorder queue
    reorder_queue(db, queue_entry.department_id, queue_entry.doctor_id)
    db.refresh(queue_entry)
    
    return queue_entry

def reschedule_patient(db: Session, queue_id: int) -> Queue:
    """
    Reschedules or re-adds a skipped patient back into the active queue.
    """
    queue_entry = db.query(Queue).filter(Queue.id == queue_id).first()
    if not queue_entry:
        raise ValueError("Queue entry not found")
        
    queue_entry.status = "Waiting"
    queue_entry.checked_in_time = datetime.datetime.utcnow()  # Reset wait time for fairness or keep original? Reset is standard.
    db.commit()
    
    # Reorder queue
    reorder_queue(db, queue_entry.department_id, queue_entry.doctor_id)
    db.refresh(queue_entry)
    
    return queue_entry
