# Project Structure: AcuraQueue Hospital Management System

---

## 📂 Directory Layout Overview

```
disease-prediction/
├── backend/
│   ├── database/
│   │   ├── connection.py        # SQLAlchemy database engine and SessionLocal setup
│   │   ├── models.py            # Complete ORM models (User, Doctor, Patient, Department, Queue, etc.)
│   │   └── schemas.py           # Pydantic validation schemas for API requests & responses
│   ├── routes/
│   │   ├── ai.py                # AI clinical diagnostic & symptom prediction endpoints
│   │   ├── analytics.py         # Advanced analytics & reporting endpoints
│   │   ├── appointments.py      # Appointment booking, reschedule, cancel APIs
│   │   ├── auth.py              # User authentication & token login APIs
│   │   ├── clinical.py          # Consultations, e-prescriptions, lab orders, PDF report generation
│   │   ├── dashboard.py         # Executive Admin Dashboard statistics & KPI metrics
│   │   ├── department.py        # Clinical Department CRUD & deletion safeguards
│   │   ├── disease.py           # Disease knowledgebase lookup APIs
│   │   ├── doctor.py            # Doctor management & schedule configuration APIs
│   │   ├── notification.py     # System notifications
│   │   ├── patient.py           # Patient registry & demographic CRUD APIs
│   │   ├── patient_portal.py    # Patient portal self-service APIs
│   │   ├── queue.py             # Check-in, ticket generation, & ticket calling APIs
│   │   ├── receptionist.py      # Receptionist management CRUD APIs
│   │   ├── reports.py           # Report catalog APIs
│   │   ├── settings.py          # System settings & hospital configuration APIs
│   │   └── user_management.py   # User & role management CRUD APIs
│   ├── services/
│   │   ├── auth_service.py      # Bcrypt password hashing, JWT generation, & RoleChecker guard
│   │   ├── disease_knowledge.py # Disease diagnosis knowledgebase
│   │   ├── pdf_report_service.py# ReportLab PDF report generation engine
│   │   └── queue_service.py     # Queue management business logic
│   ├── utils/
│   │   └── websocket.py         # Real-time WebSocket connection manager & event broadcaster
│   └── main.py                  # FastAPI entrypoint, CORS setup, router inclusion, & SQLite auto-migrations
│
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── AIClinicalRecommendationPanel.jsx  # AI recommendation sidebar
│   │   │   ├── AppointmentBookingModal.jsx         # Searchable appointment booking modal
│   │   │   ├── DepartmentManagement.jsx            # Department CRUD table & modal
│   │   │   ├── DoctorManagement.jsx                # Doctor CRUD, schedule config, & availability toggle
│   │   │   ├── LaboratoryOrdersModule.jsx          # Digital lab test order entry
│   │   │   ├── PatientRegistrationModal.jsx        # Patient demographic registration form
│   │   │   ├── ReceptionistManagement.jsx          # Receptionist CRUD & password reset modal
│   │   │   ├── SystemSettings.jsx                  # 7-tab system settings configuration module
│   │   │   ├── UserManagement.jsx                  # User directory & role management component
│   │   │   └── Topbar.jsx / Sidebar.jsx / UserMenu.jsx  # Shell navigation controls
│   │   ├── pages/               # Top-level workspace pages
│   │   │   ├── AdminDashboard.jsx       # Executive Admin Dashboard with analytics & management tabs
│   │   │   ├── DoctorDashboard.jsx      # Physician dashboard & active patient queue
│   │   │   ├── ReceptionistDashboard.jsx# Reception desk dashboard & queue ticket caller
│   │   │   ├── ClinicalWorkspace.jsx    # Doctor consultation encounter page
│   │   │   ├── PatientDashboard.jsx     # Patient self-service portal
│   │   │   └── Login.jsx                # Multi-role authentication login page
│   │   ├── services/
│   │   │   └── api.js                   # Unified Axios client & API service abstractions
│   │   ├── App.jsx                      # Main React router & role routing
│   │   └── main.jsx                     # React DOM rendering entrypoint
│   ├── package.json                     # Node dependencies & Vite build scripts
│   └── vite.config.js                   # Vite dev server & proxy settings
│
└── docs/                                # Technical documentation package
    ├── 01_Project_Overview.md
    ├── 02_System_Architecture.md
    ├── 03_Database_Design.md
    ├── 04_API_Documentation.md
    ├── 05_User_Manual.md
    ├── 06_Admin_Manual.md
    ├── 07_Test_Report.md
    ├── 08_Project_Structure.md
    └── 09_Future_Enhancements.md
```
