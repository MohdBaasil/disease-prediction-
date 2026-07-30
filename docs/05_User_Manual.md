# User Manual: AcuraQueue Hospital Management System

---

## 📖 Introduction

Welcome to the **AcuraQueue User Manual**. This guide provides step-by-step instructions for **Receptionists**, **Doctors**, and **Patients** operating within the AcuraQueue workspace.

---

## 📋 1. Receptionist User Guide

### 1.1 Logging In
1. Open your browser and navigate to `http://localhost:5173`.
2. Enter your assigned **Username** and **Password**.
3. Select your role as **Receptionist** (or leave default auto-detection) and click **Sign In**.

### 1.2 Registering a New Patient
1. On the **Receptionist Dashboard**, click the **+ Register Patient** button.
2. In the modal, fill in required demographic information:
   - Full Name *
   - Contact Mobile *
   - Age & Gender *
   - Address, Medical History, Allergies (Optional)
   - Emergency Contact Name & Phone
3. Click **Save & Register Patient**. The system automatically generates a unique Patient Code (e.g. `PAT-000102`).

### 1.3 Patient Check-In & Ticket Dispatch
1. Locate the patient in the registry or use the search bar by name, mobile, or patient code.
2. Click **Check-In to Queue**.
3. Select the target **Department** (e.g. Cardiology, General Medicine).
4. Select the **Priority Level**:
   - **Normal** (Standard sequential token)
   - **Urgent** (Priority placement)
   - **Emergency** (Immediate top placement)
5. (Optional) Assign a specific **Attending Doctor**.
6. Click **Confirm Check-In**. A queue token (e.g. `CARD-101`) is immediately dispatched.

---

## 👨‍⚕️ 2. Doctor User Guide

### 2.1 Viewing Patient Queue
1. Log in to the **Doctor Dashboard**.
2. Review your active room queue under **Today's Patient Queue**.
3. Observe patient tokens, priority badges, and estimated waiting times.

### 2.2 Calling the Next Patient
1. Click the prominent **Call Next Patient** button at the top of your workspace.
2. The live ticket display changes to **Calling**, and the patient's token is broadcasted over WebSockets across reception monitors.
3. Click **Start Clinical Encounter** to open the **Clinical Workspace**.

### 2.3 Conducting the Clinical Encounter
1. **Patient Vitals & History**:
   - Review patient demographic details,allergies, and past medical history in the left panel.
   - Enter current vitals: Blood Pressure (mmHg), Pulse Rate (bpm), Body Temp (°F), SpO2 (%), Weight (kg).
2. **AI Clinical Recommendation Panel**:
   - Inspect AI-suggested differential diagnoses based on recorded symptoms.
   - Review recommended lab tests and preventive care suggestions.
3. **Diagnosis & Clinical Notes**:
   - Enter the primary ICD/Clinical **Diagnosis**.
   - Enter detailed **Doctor Notes** and select a **Follow-up Date**.
4. **E-Prescription Entry**:
   - Click **+ Add Medication Item**.
   - Enter Drug Name, Dosage (e.g. 500mg), Frequency (e.g. 1-0-1), Duration (e.g. 5 days), and Instructions (e.g. After meals).
5. **Laboratory Test Orders**:
   - Select required blood tests, radiology scans, or panel orders.
6. **Completing Consultation & Exporting PDF**:
   - Click **Complete Encounter & Discharge**.
   - Click **Download PDF Report** to generate and open the official signed PDF Medical Report.

---

## 👤 3. Patient User Guide

### 3.1 Patient Portal Overview
1. Log in using your registered patient account credentials.
2. View your **Personal Dashboard** displaying:
   - **Queue Status**: Live ticket tracking when checked in at the hospital.
   - **Appointments**: Upcoming scheduled visits and past consultation history.
   - **Active Prescriptions**: Current medication schedules and dosage instructions.
   - **Medical Reports**: View and download past clinical PDFs.

### 3.2 Self-Service AI Health Assistant
1. Navigate to **AI Health Assistant** tab.
2. Input present symptoms to view preliminary health assessment insights and preventive care guidance.
