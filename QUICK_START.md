# Quick Start Guide - Hospital Management System

## 🚀 Starting the Application

### Step 1: Start the Backend Server

Open PowerShell and run:
```powershell
cd "d:\hospital system managemnt"
& ".\venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Step 2: Start the Frontend Development Server

Open a **new PowerShell window** and run:
```powershell
cd "d:\hospital system managemnt\frontend"
npm run dev
```

**Expected Output:**
```
VITE v4.x.x  ready in 123 ms
➜  Local:   http://localhost:5173/
```

### Step 3: Access the Application

- **Frontend:** Open http://localhost:5173 in your browser
- **API Documentation:** http://localhost:8000/docs

---

## 👤 Login Credentials

### Patient Account (Jane Doe)
You can use **ANY** of these to login:

| Method | Username | Password |
|--------|----------|----------|
| By Username | `jane` | `patient123` |
| By Email | `jane@example.com` | `patient123` |
| By Patient ID | `1` | `patient123` |

### Admin Account
- Username: `admin`
- Password: `admin123`

### Receptionist Account
- Username: `receptionist`
- Password: `recep123`

---

## 🎯 What to Test

### Patient Dashboard (after logging in as Jane)

1. **Appointments & Queue**
   - See upcoming appointment with Dr. Gregory House
   - Check live queue status (simulated)

2. **Latest Prescription**
   - View current prescription from latest visit
   - Print or download as PDF

3. **Medical History**
   - See all past doctor visits
   - Filter by department, doctor, or date
   - View diagnosis, doctor notes, and follow-up dates

4. **Medicine Tracker**
   - Complete history of all prescribed medications
   - Search by medicine name

5. **Laboratory Reports**
   - View all lab test reports
   - Download reports as needed

6. **Notifications**
   - See all patient notifications
   - Appointment confirmations, test results, etc.

7. **Profile**
   - View patient information
   - Edit profile details

---

## 🔧 Troubleshooting

### Server won't start - Port 8000 in use
```powershell
# Close the port (Windows)
Get-NetTCPConnection -LocalPort 8000 | ForEach-Object { Get-Process -Id $_.OwningProcess | Stop-Process -Force }
```

### Database errors
Delete the database file and restart the server:
```powershell
cd "d:\hospital system managemnt"
Remove-Item -Force hospital_v2.db*
# Restart server
```

### Frontend won't connect to backend
- Make sure backend is running on http://localhost:8000
- Check browser console for CORS errors
- Verify network connectivity

---

## 📚 API Examples (Testing with curl)

### 1. Login and Get Token
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "jane", "password": "patient123"}'
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### 2. Get Patient Profile
```bash
curl -X GET "http://localhost:8000/api/patients/me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Get Medical Visits
```bash
curl -X GET "http://localhost:8000/api/patients/me/visits" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Get Prescriptions
```bash
curl -X GET "http://localhost:8000/api/patients/me/prescriptions" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Get Lab Reports
```bash
curl -X GET "http://localhost:8000/api/patients/me/reports" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Get Notifications
```bash
curl -X GET "http://localhost:8000/api/patients/me/notifications" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7. Get Appointments
```bash
curl -X GET "http://localhost:8000/api/appointments" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🔒 Dashboard Features Overview

### 👥 Role-Based Access
- **Patients:** Can view their own profile, medical history, prescriptions, reports, and notifications
- **Doctors:** Can view their assigned patients and update their medical records
- **Receptionists:** Can manage appointments and queue
- **Admin:** Full system access

### 📊 Data Management
- **Automatic seeding:** Default departments, doctors, and test patient on startup
- **Persistent storage:** All data saved to SQLite database
- **Real-time updates:** WebSocket support for live queue status

### 🔐 Security Features
- JWT token-based authentication
- Password hashing with bcrypt
- Role-based access control
- Automatic session expiration

---

## 📱 Responsive Design

The dashboard is fully responsive and works on:
- 📱 Mobile phones (320px+)
- 📱 Tablets (768px+)
- 🖥️ Desktops (1024px+)

---

## 💾 Database Schema

The system uses SQLite with the following main tables:
- **users** - All user accounts (patients, doctors, staff)
- **patients** - Patient profiles with contact info
- **visits** - Doctor visit records
- **prescription_items** - Individual medicines prescribed
- **medical_reports** - Lab and diagnostic reports
- **appointments** - Patient appointments
- **notifications** - Patient alerts and messages

---

## 🛑 Stopping the Application

### Stop Backend
In the PowerShell window running the backend:
```
Press Ctrl + C
```

### Stop Frontend
In the PowerShell window running the frontend:
```
Press Ctrl + C
```

---

## 📝 Additional Notes

- The system automatically creates test data on first startup
- All timestamps are in UTC
- Files are saved relative to the project root
- PDF reports are generated on-the-fly when requested

---

**Happy Testing!** 🎉
