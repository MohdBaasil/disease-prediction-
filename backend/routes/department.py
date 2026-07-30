from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
import datetime

from backend.database.connection import get_db
from backend.database.models import Department, Doctor, User, AuditLog
from backend.database.schemas import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DepartmentStatusUpdate
)
from backend.services.auth_service import RoleChecker

router = APIRouter(prefix="/api/departments", tags=["Departments"])

admin_only = RoleChecker(["Admin"])

def format_department_response(dept: Department, doc_count: int) -> dict:
    return {
        "id": dept.id,
        "name": dept.name,
        "code": dept.code,
        "description": dept.description,
        "is_active": dept.is_active if dept.is_active is not None else True,
        "doctor_count": doc_count,
        "created_at": dept.created_at or datetime.datetime.utcnow(),
        "updated_at": dept.updated_at or dept.created_at
    }

@router.get("", response_model=List[DepartmentResponse])
def get_departments(
    search: Optional[str] = Query(None, description="Search by name or code or description"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(search, str):
        search = None
    if not isinstance(is_active, bool):
        is_active = None

    query = db.query(
        Department,
        func.count(Doctor.id).label("doc_count")
    ).outerjoin(Doctor, Doctor.department_id == Department.id)

    if is_active is not None:
        query = query.filter(Department.is_active == is_active)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Department.name.ilike(search_fmt),
                Department.code.ilike(search_fmt),
                Department.description.ilike(search_fmt)
            )
        )

    query = query.group_by(Department.id).order_by(Department.name.asc())
    results = query.all()

    return [format_department_response(dept, doc_count) for dept, doc_count in results]

@router.get("/active", response_model=List[DepartmentResponse])
def get_active_departments(
    db: Session = Depends(get_db)
):
    query = db.query(
        Department,
        func.count(Doctor.id).label("doc_count")
    ).outerjoin(Doctor, Doctor.department_id == Department.id).filter(
        Department.is_active == True
    ).group_by(Department.id).order_by(Department.name.asc())

    results = query.all()
    return [format_department_response(dept, doc_count) for dept, doc_count in results]

@router.get("/{department_id}", response_model=DepartmentResponse)
def get_department_by_id(department_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")
    doc_count = db.query(func.count(Doctor.id)).filter(Doctor.department_id == department_id).scalar() or 0
    return format_department_response(dept, doc_count)

@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not dept_in.name or not dept_in.name.strip():
        raise HTTPException(status_code=400, detail="Department name is required.")
    if not dept_in.code or not dept_in.code.strip():
        raise HTTPException(status_code=400, detail="Department code is required.")

    name_clean = dept_in.name.strip()
    code_clean = dept_in.code.strip().upper()
    desc_clean = dept_in.description.strip() if dept_in.description else None

    # Validate unique name
    existing_name = db.query(Department).filter(func.lower(Department.name) == name_clean.lower()).first()
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department name '{name_clean}' already exists."
        )

    # Validate unique code
    existing_code = db.query(Department).filter(func.upper(Department.code) == code_clean).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department code '{code_clean}' already exists."
        )

    department = Department(
        name=name_clean,
        code=code_clean,
        description=desc_clean,
        is_active=dept_in.is_active if dept_in.is_active is not None else True
    )
    db.add(department)
    db.commit()
    db.refresh(department)

    # Audit Log
    log = AuditLog(
        user_id=current_user.id,
        action="Create Department",
        details=f"Created department '{department.name}' (Code: {department.code})"
    )
    db.add(log)
    db.commit()

    return format_department_response(department, 0)

@router.put("/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    dept_update: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    if dept_update.name and dept_update.name.strip() != dept.name:
        new_name = dept_update.name.strip()
        existing_name = db.query(Department).filter(
            func.lower(Department.name) == new_name.lower(),
            Department.id != department_id
        ).first()
        if existing_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department name '{new_name}' already exists."
            )
        dept.name = new_name

    if dept_update.code and dept_update.code.strip().upper() != dept.code:
        new_code = dept_update.code.strip().upper()
        existing_code = db.query(Department).filter(
            func.upper(Department.code) == new_code,
            Department.id != department_id
        ).first()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department code '{new_code}' already exists."
            )
        dept.code = new_code

    if dept_update.description is not None:
        dept.description = dept_update.description.strip() if dept_update.description else None

    if dept_update.is_active is not None:
        dept.is_active = dept_update.is_active

    dept.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(dept)

    doc_count = db.query(func.count(Doctor.id)).filter(Doctor.department_id == department_id).scalar() or 0

    log = AuditLog(
        user_id=current_user.id,
        action="Update Department",
        details=f"Updated department '{dept.name}' (Code: {dept.code})"
    )
    db.add(log)
    db.commit()

    return format_department_response(dept, doc_count)

@router.put("/{department_id}/status", response_model=DepartmentResponse)
def toggle_department_status(
    department_id: int,
    is_active: bool = Query(True, description="Set True to enable, False to disable department"),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    if not isinstance(is_active, bool):
        is_active = True

    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    dept.is_active = is_active
    dept.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(dept)

    doc_count = db.query(func.count(Doctor.id)).filter(Doctor.department_id == department_id).scalar() or 0

    log = AuditLog(
        user_id=current_user.id,
        action="Toggle Department Status",
        details=f"Department '{dept.name}' status set to is_active={is_active}"
    )
    db.add(log)
    db.commit()

    return format_department_response(dept, doc_count)

@router.delete("/{department_id}")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    assigned_doctors = db.query(func.count(Doctor.id)).filter(Doctor.department_id == department_id).scalar() or 0
    if assigned_doctors > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department '{dept.name}' because {assigned_doctors} doctor(s) are assigned to it. Please reassign or remove assigned doctors first."
        )

    dept_name = dept.name
    db.delete(dept)
    db.commit()

    log = AuditLog(
        user_id=current_user.id,
        action="Delete Department",
        details=f"Deleted department '{dept_name}' (ID: {department_id})"
    )
    db.add(log)
    db.commit()

    return {"message": f"Department '{dept_name}' deleted successfully."}
