import unittest
import io
from sqlalchemy.orm import Session
from backend.database.connection import SessionLocal
from backend.database.models import User, Patient, Visit, PrescriptionItem, MedicalReport, Department, Doctor, Queue
from backend.services.report_service import generate_prescription_pdf, generate_lab_report_pdf
from backend.routes.dashboard import get_patient_dashboard
from backend.services.auth_service import get_password_hash

class TestPatientDashboardFeatures(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        
        # 1. Create a test department
        cls.dept = Department(name="Test Cardiology", code="TC")
        cls.db.add(cls.dept)
        cls.db.commit()
        cls.db.refresh(cls.dept)
        
        # 2. Create a test user & doctor
        cls.doc_user = User(username="testdrstrange", hashed_password=get_password_hash("doctor123"), role="Doctor")
        cls.db.add(cls.doc_user)
        cls.db.commit()
        cls.db.refresh(cls.doc_user)
        
        cls.doctor = Doctor(
            user_id=cls.doc_user.id,
            department_id=cls.dept.id,
            name="Test Stephen Strange",
            specialization="Cardiology",
            room_number="202",
            is_available=True
        )
        cls.db.add(cls.doctor)
        cls.db.commit()
        cls.db.refresh(cls.doctor)

        # 3. Create a test patient user & profile
        cls.patient_user = User(username="testjane", hashed_password=get_password_hash("patient123"), role="Patient")
        cls.db.add(cls.patient_user)
        cls.db.commit()
        cls.db.refresh(cls.patient_user)
        
        cls.patient = Patient(
            user_id=cls.patient_user.id,
            name="Test Jane Doe",
            email="testjane@example.com",
            age=28,
            gender="Female",
            blood_group="O+",
            allergies="Penicillin",
            emergency_contact="John Doe",
            mobile_number="+1-555-0144"
        )
        cls.db.add(cls.patient)
        cls.db.commit()
        cls.db.refresh(cls.patient)

        # 4. Create a past visit & prescriptions
        cls.visit = Visit(
            patient_id=cls.patient.id,
            doctor_id=cls.doctor.id,
            department="Test Cardiology",
            diagnosis="Mild hypertension",
            chief_complaint="Elevated heart rate",
            doctor_notes="Take amlodipine.",
        )
        cls.db.add(cls.visit)
        cls.db.commit()
        cls.db.refresh(cls.visit)
        
        cls.rx_item = PrescriptionItem(
            visit_id=cls.visit.id,
            medicine_name="Amlodipine 5mg",
            dosage="5mg",
            frequency="Once daily",
            duration="30 days",
            instructions="With water"
        )
        cls.db.add(cls.rx_item)
        cls.db.commit()

        # 5. Create a test medical report
        cls.report = MedicalReport(
            patient_id=cls.patient.id,
            visit_id=cls.visit.id,
            report_name="Complete Blood Count",
            report_type="Blood Test",
            file_path="/reports/cbc_test.pdf"
        )
        cls.db.add(cls.report)
        cls.db.commit()
        cls.db.refresh(cls.report)

        # 6. Create a test queue entry
        cls.queue_entry = Queue(
            token_number="TC001",
            department_id=cls.dept.id,
            doctor_id=cls.doctor.id,
            patient_id=cls.patient.id,
            priority_level=3,
            status="Waiting",
            estimated_wait_time=15.0,
            position=1
        )
        cls.db.add(cls.queue_entry)
        cls.db.commit()
        cls.db.refresh(cls.queue_entry)

    @classmethod
    def tearDownClass(cls):
        # Cleanup in reverse order of dependencies
        cls.db.delete(cls.queue_entry)
        cls.db.delete(cls.report)
        cls.db.delete(cls.rx_item)
        cls.db.delete(cls.visit)
        cls.db.delete(cls.patient)
        cls.db.delete(cls.patient_user)
        cls.db.delete(cls.doctor)
        cls.db.delete(cls.doc_user)
        cls.db.delete(cls.dept)
        cls.db.commit()
        cls.db.close()

    def test_prescription_pdf_generation(self):
        pdf_stream = generate_prescription_pdf(self.db, self.visit.id)
        self.assertIsInstance(pdf_stream, io.BytesIO)
        pdf_bytes = pdf_stream.getvalue()
        self.assertTrue(len(pdf_bytes) > 0)
        # ReportLab PDF files start with %PDF
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

    def test_lab_report_pdf_generation(self):
        pdf_stream = generate_lab_report_pdf(self.db, self.report.id)
        self.assertIsInstance(pdf_stream, io.BytesIO)
        pdf_bytes = pdf_stream.getvalue()
        self.assertTrue(len(pdf_bytes) > 0)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

    def test_patient_dashboard_endpoint_active_tokens_ids(self):
        # We invoke get_patient_dashboard directly
        # and mock current_user as testjane
        response = get_patient_dashboard(
            patient_id=self.patient.id,
            db=self.db,
            current_user=self.patient_user
        )
        self.assertEqual(response["patient_name"], "Test Jane Doe")
        self.assertTrue(len(response["active_tokens"]) > 0)
        
        token_info = response["active_tokens"][0]
        self.assertEqual(token_info["token_number"], "TC001")
        self.assertEqual(token_info["doctor_id"], self.doctor.id)
        self.assertEqual(token_info["department_id"], self.dept.id)

if __name__ == "__main__":
    unittest.main()
