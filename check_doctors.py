import sys
import os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.database.connection import SessionLocal
from backend.database.models import User, Doctor

db = SessionLocal()
try:
    user = db.query(User).filter(User.username == "drhouse").first()
    print(f"User drhouse exists: {user is not None}")
    if user:
        print(f"User ID: {user.id}, Role: {user.role}")
        doc = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if doc:
            print(f"Doctor Name: {doc.name}")
    else:
        # Check first 5 doctors
        print("First 5 doctors:")
        for d in db.query(Doctor).limit(5).all():
            u = db.query(User).filter(User.id == d.user_id).first()
            print(f"Doctor ID: {d.id}, Name: {d.name}, Username: {u.username if u else 'N/A'}")
finally:
    db.close()
