# Administrator Manual: AcuraQueue Hospital Management System

---

## 🛡️ Introduction

The **Admin Manual** provides comprehensive instructions for hospital administrators managing the AcuraQueue workspace via the **Executive Admin Dashboard**.

---

## 📊 1. Executive Admin Dashboard & Analytics

Upon logging in with an `Admin` account, administrators land on the **Executive Dashboard**:

### Key Features:
- **Real-Time KPI Cards**:
  - Total Patients, Total Doctors, Total Receptionists, Total Departments, Total Users, Active Queue Count, Today's Appointments, Active Consultations, Emergency Queue Count.
- **Analytics Charts (`Recharts`)**:
  - **Monthly Patient Registrations**: Bar chart tracking patient intake over time.
  - **Appointment Trends**: Line chart displaying scheduled vs walk-in volume.
  - **Department Distribution**: Pie chart illustrating active department workloads.
  - **Doctor Workload**: Column chart showing daily consultations per physician.
  - **Risk Distribution**: Risk category breakdown (Low, Moderate, High, Critical).

---

## 👨‍⚕️ 2. Doctor Management Module

Navigate to the **Doctor Management** tab:
1. **Search & Filter**: Filter doctor roster by search term (name, specialization), department, or status (Active, Inactive).
2. **Add Doctor**: Click **+ Add Doctor**. Fill in Name, Specialization, Room Number, Username, Password, Email, and Department.
3. **Schedule Configuration**: Configure working days (e.g., Mon, Tue, Wed, Thu, Fri), working hours start/end (09:00 - 17:00), and average consultation duration (15 min).
4. **Availability & Status Toggle**: Toggle doctor availability (`Available`, `Busy`, `On Leave`) or soft enable/disable account access. Active queue safeguards prevent disabling a doctor actively conducting a consultation unless explicitly confirmed.

---

## 📋 3. Receptionist Management Module

Navigate to the **Receptionist Management** tab:
1. **Roster Overview**: View all front-desk reception accounts sorted newest first.
2. **Add Receptionist**: Click **+ Add Receptionist**. Fill in Full Name, Username, Email, Phone, and Password.
3. **Password Reset**: Click the Key icon to open the dedicated **Reset Password Modal** to assign new credentials.
4. **Disable/Enable Account**: Click the Power icon to soft-toggle account access.

---

## 🏢 4. Department Management Module

Navigate to the **Department Management** tab:
1. **Department Roster**: View medical departments, code badges (e.g. `CARD`), descriptions, assigned doctor counts, and statuses.
2. **Add Department**: Click **+ Add Department**. Enter Department Name (e.g. Cardiology), Department Code (e.g. CARD), and Description.
3. **Assigned Doctor Protection**: Attempting to delete a department with assigned physicians triggers an error alert (`400 Bad Request`) instructing the admin to reassign doctors first.

---

## 👤 5. User & Role Management Module

Navigate to the **User & Role Management** tab:
1. **Central User Directory**: View all user accounts across roles (`Admin`, `Doctor`, `Receptionist`, `Patient`).
2. **Role Assignment & Auto-Creation**: Creating a user with a `Doctor` or `Receptionist` role automatically initializes the corresponding linked profile record.
3. **Profile Synchronization**: Updating user profile details automatically synchronizes linked Doctor or Receptionist records.

---

## ⚙️ 6. System Settings Module

Navigate to the **System Settings** tab:
- **Hospital Info**: Configure Hospital Name, Code, Address, Phone, Email, Website, and Logo asset URL.
- **Appointments Policy**: Set Consultation Duration (minutes), Booking Interval (minutes), Max Daily Appointments, and Walk-in toggle.
- **Queue Rules**: Set Queue Prefix (e.g. `Q`), Auto Tokens toggle, Daily Token Reset toggle, and Emergency Priority toggle.
- **Notifications**: Configure Email, SMS, Appointment Reminders, and Reminder Lead Time (hours).
- **AI Preferences**: Enable/disable AI Recommendations and adjust the Diagnostic Confidence Threshold slider (50%–99%).
- **Localization & Appearance**: Select Time Zone, Date Format, Time Format, Language, Theme (System, Light, Dark), and Primary Accent Color.
- **System Information Cards**: View Application Version (`v2.0.0`), Database Engine (`Connected (SQLite)`), Backend API (`Healthy (FastAPI)`), and Frontend Client (`Active (Vite + React)`).
