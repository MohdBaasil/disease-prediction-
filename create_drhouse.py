import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.database.connection import SessionLocal
from backend.database.models import User, Doctor, Department
from backend.services.auth_service import get_password_hash

db = SessionLocal()
try:
    print("Checking if user 'drhouse' exists...")
    user = db.query(User).filter(User.username == "drhouse").first()
    if not user:
        print("Creating User 'drhouse'...")
        doctor_hash = get_password_hash("doctor123")
        user = User(username="drhouse", hashed_password=doctor_hash, role="Doctor")
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created User: id={user.id}")
        
        # Get first department
        dept = db.query(Department).first()
        dept_id = dept.id if dept else 1
        
        # Create Doctor profile
        print("Creating Doctor profile for Dr. Gregory House...")
        doc = Doctor(
            user_id=user.id,
            department_id=dept_id,
            name="Dr. Gregory House",
            specialization="Diagnostic Medicine",
            room_number="412-A",
            is_available=True
        )
        db.add(doc)
        db.commit()
        print("Successfully created Dr. Gregory House profile!")
    else:
        print("User 'drhouse' already exists!")
finally:
    db.close()
