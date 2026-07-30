# Project Overview: AcuraQueue Hospital Management System

---

## 🎯 1. Executive Summary & Project Goals

The **AcuraQueue Hospital Management System** is a next-generation, web-based hospital clinical workflow and administration platform. Developed as a production-grade healthcare solution, AcuraQueue integrates real-time patient queue management, automated appointment scheduling, AI-driven diagnostic decision support, digital clinical consultations, e-prescriptions, lab orders, PDF report exports, and comprehensive administrative governance.

### Core Goals:
1. **Eliminate Operational Bottlenecks**: Automate patient intake, check-in, and queue routing to dramatically reduce patient wait times and lobby overcrowding.
2. **Empower Clinical Decision-Making**: Provide physicians with an integrated AI Clinical Recommendation engine that generates symptom-based differential diagnoses, risk scores, and care plans.
3. **Standardize Hospital Administration**: Supply hospital administrators with a unified control panel for managing medical departments, physician rosters, reception staff, user roles, and system-wide configuration settings.
4. **Deliver End-to-End Digital Healthcare**: Digitally link every patient touchpoint—from registration and queuing to clinical examination, e-prescription generation, and PDF medical report downloads.

---

## 💡 2. Problem Statement

Modern healthcare facilities encounter significant operational friction due to disconnected systems, manual paper-based processes, and inefficient patient flow management:

| Operational Challenge | Traditional Impact | AcuraQueue Solution |
| :--- | :--- | :--- |
| **Unmanaged Patient Waiting Lines** | Long queues, overcrowded lobbies, frustrated patients, unpredictable consultation delays. | Dynamic digital token generation, department-based routing, real-time live calling, and WebSocket updates. |
| **Fragmented Staff Management** | Disjointed spreadsheets for doctor schedules, reception shifts, and user permissions. | Integrated Doctor, Receptionist, Department, and User & Role Management modules with RBAC. |
| **Diagnostic Overhead & Manual Charting** | Time-consuming manual clinical documentation and lack of automated decision support. | Structured clinical consultation workspace with AI diagnostic suggestions and e-prescriptions. |
| **Paper-Based Prescription & Report Loss** | Misplaced physical prescriptions, illegible handwriting, and delayed lab results. | Digital e-prescriptions, structured lab orders, and automated server-side PDF report exports. |

---

## 📐 3. System Scope

AcuraQueue is scoped to serve four primary user classes across outpatient clinics and general hospitals:

```
                  ┌─────────────────────────────────────────┐
                  │ AcuraQueue Hospital Management System  │
                  └────────────────────┬────────────────────┘
                                       │
        ┌──────────────────┬───────────┴───────────┬──────────────────┐
        ▼                  ▼                       ▼                  ▼
┌───────────────┐  ┌───────────────┐       ┌───────────────┐  ┌───────────────┐
│ Administrator │  │  Receptionist │       │    Doctor     │  │    Patient    │
└───────────────┘  └───────────────┘       └───────────────┘  └───────────────┘
```

- **Outpatient Care**: General medicine, cardiology, neurology, pediatrics, orthopedics, etc.
- **Queue & Check-In**: Walk-in token generation, pre-booked appointment check-in, priority handling (Normal, Urgent, Emergency).
- **Clinical Encounter**: Structured consultation entry, vitals recording, diagnosis, e-prescriptions, lab orders, PDF export.
- **Administrative Governance**: Staff management, department setup, user role configuration, and system setting adjustment.

---

## 🛠️ 4. Implemented Modules Overview

AcuraQueue consists of **9 fully implemented modules**:

### 1. Authentication & Security Module
- JWT token authentication with expiration handling.
- Role-Based Access Control (`Admin`, `Doctor`, `Receptionist`, `Patient`).
- Secure password hashing using `passlib` with `bcrypt`.

### 2. Patient Registration & Registry Module
- Unique Patient Code assignment (`PAT-XXXXXX`).
- Comprehensive demographic, contact, and emergency info capture.
- Searchable patient database with instant lookup by mobile, code, or name.

### 3. Queue Management & Token Dispatch Module
- Department-specific ticket generation (e.g., `CARD-101`, `NEU-102`).
- Multi-tier priority routing (Normal, Urgent, Emergency).
- Real-time queue caller and WebSocket live status broadcasting.

### 4. Appointment Booking & Scheduling Module
- Walk-in and scheduled appointment creation.
- Doctor double-booking prevention and duplicate appointment checks.
- Doctor availability grid and appointment status management (`Scheduled`, `Checked-In`, `Completed`, `Cancelled`).

### 5. Doctor Management Module
- Production-ready CRUD APIs for physician accounts.
- Working schedule configuration (working days, working hours, consultation duration).
- Doctor availability toggle (`Available`, `Busy`, `On Leave`).
- Active consultation queue safeguards upon disable.

### 6. Receptionist Management Module
- Production-ready CRUD APIs for reception staff accounts.
- Account search, active/inactive filtering, and soft disable/enable status toggling.
- Dedicated admin password reset modal and credential management.

### 7. Department Management Module
- Clinical department CRUD with unique code validation.
- Assigned doctor tracking per department.
- Deletion safeguards preventing department deletion if doctors are currently assigned.

### 8. User & Role Management Module
- Centralized user account directory across all roles (`Admin`, `Doctor`, `Receptionist`, `Patient`).
- Automatic role profile creation (e.g., creating a Doctor user automatically initializes a linked `Doctor` profile).
- Synchronized profile updates and soft status toggles.

### 9. System Settings Module
- Global hospital profile configuration (Name, Code, Address, Contact, Logo).
- Appointment policies, queue prefixes, notification preferences, AI confidence sliders, localization, and theme styling.

---

## ✅ 5. System Benefits

- **For Patients**: Reduced wait times, transparent ticket tracking, digital prescription access, and medical PDF report downloads.
- **For Receptionists**: Streamlined registration, instant check-in, automated ticket dispatch, and clear queue visibility.
- **For Doctors**: Organized patient queue, fast vitals charting, AI diagnostic assistance, e-prescriptions, and one-click PDF generation.
- **For Administrators**: Total operational governance, real-time KPI metrics, staff scheduling, user permission control, and central system configuration.
