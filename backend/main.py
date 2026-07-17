import os
import sys
import datetime

# Ensure project root is in sys.path when running main.py directly
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn

# Auto-delete database on start to ensure clean migration structure
# Do this BEFORE importing database connection to avoid file locks
for db_file in ["hospital.db", "hospital_v2.db"]:
    db_path = os.path.join(os.getcwd(), db_file)
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print(f"[SUCCESS] Deleted old database {db_file} for fresh migration")
        except Exception as e:
            print(f"[WARNING] Error removing old db {db_file}: {e}")

# NOW import database after cleanup
from backend.database.connection import engine, Base, get_db
from backend.database.models import (
    Department, User, Doctor, Patient, Visit, PrescriptionItem, MedicalReport, Notification, Appointment
)
from backend.services.auth_service import get_password_hash

# Route imports
from backend.routes import auth, doctor, patient, queue, notification, reports, dashboard, appointments, disease
from backend.utils.websocket import manager

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Hospital Queue Management System API",
    description="Backend API for AI-powered real-time hospital queue management.",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev/showcase simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(doctor.router)
app.include_router(patient.router)
app.include_router(queue.router)
app.include_router(appointments.router)
app.include_router(notification.router)
app.include_router(reports.router)
app.include_router(dashboard.router)
app.include_router(disease.router)

from fastapi.staticfiles import StaticFiles
# Mount static files directory to serve the frontend client
os.makedirs("backend/static", exist_ok=True)
app.mount("/", StaticFiles(directory="backend/static", html=True), name="static")

# WebSocket Endpoint for real-time dashboard events
@app.websocket("/ws/queue")
async def websocket_queue_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open; listen for incoming messages if any (optional)
            data = await websocket.receive_text()
            # Echo or process if needed, currently we use broadcast from routes
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Startup Seeding Logic
from backend.database.seed_from_csv import seed_db_from_csv

@app.on_event("startup")
def seed_data():
    db = next(get_db())
    try:
        print("Checking default seed data...")
        csv_path = os.path.join(os.getcwd(), "healthcare_dataset.csv")
        seed_db_from_csv(db, csv_path)
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
