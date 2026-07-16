from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
from typing import Optional

from backend.database.connection import get_db
from backend.database.models import User, Consultation, Queue, Doctor, Department
from backend.services.auth_service import RoleChecker
from backend.services.report_service import generate_excel_report, generate_pdf_report, get_report_statistics

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

admin_only = RoleChecker(["Admin"])

@router.get("/excel")
def export_excel(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    # Parse dates
    start_date = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    end_date = datetime.datetime.utcnow()
    
    if start:
        start_date = datetime.datetime.fromisoformat(start)
    if end:
        end_date = datetime.datetime.fromisoformat(end)

    file_stream = generate_excel_report(db, start_date, end_date)
    
    filename = f"Hospital_Report_{start_date.date()}_to_{end_date.date()}.xlsx"
    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/pdf")
def export_pdf(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    # Parse dates
    start_date = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    end_date = datetime.datetime.utcnow()
    
    if start:
        start_date = datetime.datetime.fromisoformat(start)
    if end:
        end_date = datetime.datetime.fromisoformat(end)

    file_stream = generate_pdf_report(db, start_date, end_date)
    
    filename = f"Hospital_Report_{start_date.date()}_to_{end_date.date()}.pdf"
    return StreamingResponse(
        file_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/analytics")
def get_analytics(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker(["Admin", "Receptionist"]))
):
    # Parse dates
    start_date = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    end_date = datetime.datetime.utcnow()
    
    if start:
        start_date = datetime.datetime.fromisoformat(start)
    if end:
        end_date = datetime.datetime.fromisoformat(end)

    stats = get_report_statistics(db, start_date, end_date)
    
    # 1. Peak Hours Analytics (Patients checked in by hour)
    # We group by hour of checked_in_time
    # For SQLite, strftime('%H', checked_in_time) is used
    peak_hours_raw = db.query(
        func.strftime('%H', Queue.checked_in_time).label('hour'),
        func.count(Queue.id).label('count')
    ).filter(
        Queue.checked_in_time >= start_date,
        Queue.checked_in_time <= end_date
    ).group_by('hour').all()
    
    peak_hours = {f"{h:02d}:00": 0 for h in range(8, 18)}  # 8 AM to 5 PM
    for hr, count in peak_hours_raw:
        if hr:
            formatted_hr = f"{int(hr):02d}:00"
            if formatted_hr in peak_hours:
                peak_hours[formatted_hr] = count
                
    # 2. Doctor Utilization (Completed consultations per doctor)
    doc_utilization_raw = db.query(
        Doctor.name,
        func.count(Consultation.id).label('consultations_count')
    ).join(Consultation, Consultation.doctor_id == Doctor.id).filter(
        Consultation.created_at >= start_date,
        Consultation.created_at <= end_date
    ).group_by(Doctor.name).all()
    
    doc_utilization = {name: count for name, count in doc_utilization_raw}

    # 3. Emergency Statistics
    total_patients = stats["priority_1"] + stats["priority_2"] + stats["priority_3"]
    emerg_percentage = 0.0
    if total_patients > 0:
        emerg_percentage = round(((stats["priority_1"] + stats["priority_2"]) / total_patients) * 100, 1)

    return {
        "summary": {
            "total_consultations": stats["total_consultations"],
            "avg_duration_minutes": stats["avg_duration"],
            "avg_wait_minutes": stats["avg_wait"],
            "emergency_percentage": emerg_percentage
        },
        "priority_distribution": {
            "Critical": stats["priority_1"],
            "Urgent": stats["priority_2"],
            "Normal": stats["priority_3"]
        },
        "department_distribution": {dept: count for dept, count in stats["department_distribution"]},
        "peak_hours": peak_hours,
        "doctor_utilization": doc_utilization
    }
