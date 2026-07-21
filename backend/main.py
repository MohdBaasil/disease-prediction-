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

# NOW import database
from backend.database.connection import engine, Base, get_db
from backend.database.models import (
    Department, User, Doctor, Patient, Visit, PrescriptionItem, MedicalReport, Notification, Appointment, PredictionHistory,
    ChatHistory, HealthScoreHistory, RiskAlert, CarePlan
)
from backend.services.auth_service import get_password_hash

# Route imports
from backend.routes import auth, doctor, patient, queue, notification, reports, dashboard, appointments, disease, patient_portal, analytics, clinical, ai
from backend.utils.websocket import manager

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Hospital Queue Management System",
    description="Vibrant Hospital Management Workspace featuring advanced AI prediction history",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(patient_portal.router)
app.include_router(analytics.router)
app.include_router(clinical.router)
app.include_router(ai.router)

# Direct endpoint alias for /api/consultations/{consultation_id}/report
from fastapi.responses import FileResponse
from backend.services.pdf_report_service import generate_consultation_pdf
from backend.database.models import Consultation

@app.get("/api/consultations/{consultation_id}/report")
def direct_get_consultation_report(consultation_id: int, download: bool = False, db: Session = Depends(get_db)):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Consultation record not found.")
    try:
        pdf_path = generate_consultation_pdf(consultation_id, db)
        filename = f"CONSULTATION_{consultation_id}.pdf"
        disposition = f'attachment; filename="{filename}"' if download else f'inline; filename="{filename}"'
        return FileResponse(path=pdf_path, media_type="application/pdf", headers={"Content-Disposition": disposition})
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

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

from fastapi.staticfiles import StaticFiles
# Mount static files directory to serve the frontend client
os.makedirs("backend/static", exist_ok=True)
app.mount("/", StaticFiles(directory="backend/static", html=True), name="static")

# Startup Seeding Logic
from backend.database.seed_from_csv import seed_db_from_csv

@app.on_event("startup")
def seed_data():
    db = next(get_db())
    try:
        print("Checking default seed data...", flush=True)
        csv_path = os.path.join(os.getcwd(), "healthcare_dataset.csv")
        print("Invoking seed_db_from_csv...", flush=True)
        seed_db_from_csv(db, csv_path)
        print("seed_db_from_csv finished successfully.", flush=True)
    except Exception as e:
        print(f"Error seeding database: {e}", flush=True)
    finally:
        db.close()

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
