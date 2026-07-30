# API Documentation: AcuraQueue Hospital Management System

---

## 🔑 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/token` (Form Login)
- **Method**: `POST`
- **Description**: Authenticates user credentials and returns a JWT access token.
- **Auth**: None (Public)
- **Request Body** (`application/x-www-form-urlencoded`):
  - `username` (string, required)
  - `password` (string, required)
- **Response Body**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "role": "Admin",
    "username": "admin"
  }
  ```
- **Errors**: `401 Unauthorized` (Invalid credentials), `400 Bad Request` (Missing fields).

### `POST /api/auth/register` (Patient Self-Registration)
- **Method**: `POST`
- **Description**: Registers a new patient user account.
- **Auth**: None (Public)
- **Request Body**:
  - `username` (string, required)
  - `password` (string, required, >= 6 chars)
  - `role` (string, default "Patient")
- **Response Body**: User object.

---

## 👨‍⚕️ 2. Doctor Management Endpoints (`/api/doctors`)

### `GET /api/doctors`
- **Method**: `GET`
- **Description**: List doctors with optional search, department filter, and status filter.
- **Auth**: Required (`Admin`, `Receptionist`, `Doctor`)
- **Query Params**: `search`, `department_id`, `is_active`
- **Response**: Array of `DoctorResponse` objects.

### `POST /api/doctors`
- **Method**: `POST`
- **Description**: Create a new doctor account and profile.
- **Auth**: `Admin` only
- **Request Body**: `DoctorCreate` schema (name, specialization, room_number, username, password, department_id, email).
- **Response**: `201 Created` with `DoctorResponse`.
- **Errors**: `400 Bad Request` (Duplicate username/email, invalid department).

### `PUT /api/doctors/{id}`
- **Method**: `PUT`
- **Description**: Update doctor profile information.
- **Auth**: `Admin` only
- **Response**: `DoctorResponse`.

### `PUT /api/doctors/{id}/status`
- **Method**: `PUT`
- **Description**: Enable/Disable doctor account.
- **Auth**: `Admin` only
- **Query Params**: `is_active` (bool), `force` (bool).
- **Validation**: Checks for active calling consultations unless `force=true`.

---

## 📋 3. Receptionist Management Endpoints (`/api/receptionists`)

### `GET /api/receptionists`
- **Method**: `GET`
- **Description**: List receptionists sorted newest first, with search and active filters.
- **Auth**: `Admin` only
- **Query Params**: `search`, `is_active`, `page`, `limit`
- **Response**: Array of `ReceptionistResponse` objects.

### `POST /api/receptionists`
- **Method**: `POST`
- **Description**: Create a new receptionist account and profile.
- **Auth**: `Admin` only
- **Request Body**: `ReceptionistCreate` (name, username, email, phone, password, is_active).
- **Response**: `201 Created` with `ReceptionistResponse`.

### `PUT /api/receptionists/{id}`
- **Method**: `PUT`
- **Description**: Update receptionist profile information.
- **Auth**: `Admin` only

### `PUT /api/receptionists/{id}/status`
- **Method**: `PUT`
- **Description**: Soft enable/disable receptionist account.
- **Auth**: `Admin` only

### `PUT /api/receptionists/{id}/reset-password`
- **Method**: `PUT`
- **Description**: Reset receptionist login password.
- **Auth**: `Admin` only

---

## 🏢 4. Department Management Endpoints (`/api/departments`)

### `GET /api/departments`
- **Method**: `GET`
- **Description**: List all departments with doctor counts, sorted alphabetically.
- **Auth**: `Admin` only
- **Query Params**: `search`, `is_active`

### `GET /api/departments/active`
- **Method**: `GET`
- **Description**: Return active departments for dropdown selections.
- **Auth**: Required (Any authenticated role)

### `POST /api/departments`
- **Method**: `POST`
- **Description**: Create a new medical department.
- **Auth**: `Admin` only
- **Request Body**: `DepartmentCreate` (name, code, description, is_active).

### `PUT /api/departments/{id}`
- **Method**: `PUT`
- **Description**: Update department name, code, description, or status.
- **Auth**: `Admin` only

### `PUT /api/departments/{id}/status`
- **Method**: `PUT`
- **Description**: Toggle active status of a department.
- **Auth**: `Admin` only

### `DELETE /api/departments/{id}`
- **Method**: `DELETE`
- **Description**: Delete department record.
- **Auth**: `Admin` only
- **Validation**: Rejects deletion (`400 Bad Request`) if assigned doctors exist.

---

## 👤 5. User & Role Management Endpoints (`/api/users`)

### `GET /api/users`
- **Method**: `GET`
- **Description**: List all user accounts across roles (`Admin`, `Doctor`, `Receptionist`, `Patient`).
- **Auth**: `Admin` only
- **Query Params**: `search`, `role`, `is_active`

### `GET /api/users/{id}`
- **Method**: `GET`
- **Description**: Get single user details and linked profile.
- **Auth**: `Admin` only

### `POST /api/users`
- **Method**: `POST`
- **Description**: Create a user and automatically initialize linked Doctor/Receptionist/Patient profile.
- **Auth**: `Admin` only

### `PUT /api/users/{id}`
- **Method**: `PUT`
- **Description**: Update user and synchronize linked profile details.
- **Auth**: `Admin` only

### `PUT /api/users/{id}/status`
- **Method**: `PUT`
- **Description**: Enable or disable user account.
- **Auth**: `Admin` only

### `PUT /api/users/{id}/reset-password`
- **Method**: `PUT`
- **Description**: Reset user password.
- **Auth**: `Admin` only

---

## ⚙️ 6. System Settings Endpoints (`/api/settings`)

### `GET /api/settings`
- **Method**: `GET`
- **Description**: Get current global system settings (initializes default settings if empty).
- **Auth**: `Admin` only

### `PUT /api/settings`
- **Method**: `PUT`
- **Description**: Update hospital configuration, appointment rules, queue prefixes, notification settings, and AI parameters.
- **Auth**: `Admin` only

---

## 🚦 7. Queue Management Endpoints (`/api/queue`)

### `POST /api/queue/check-in`
- **Method**: `POST`
- **Description**: Check-in patient, create queue ticket, and assign token.
- **Auth**: `Receptionist` / `Admin`
- **Request Body**: `patient_id`, `department_id`, `priority_level` (1=Emergency, 2=Urgent, 3=Normal), `doctor_id`.

### `GET /api/queue/tickets`
- **Method**: `GET`
- **Description**: List active queue tickets by department or doctor.
- **Auth**: Required

### `PUT /api/queue/call-next`
- **Method**: `PUT`
- **Description**: Doctor calls next ticket from room queue. Broadcasts WebSocket event.
- **Auth**: `Doctor`

---

## 🩺 8. Clinical Encounter & Report Endpoints (`/api/clinical`, `/api/reports`)

### `POST /api/clinical/consultations`
- **Method**: `POST`
- **Description**: Complete clinical encounter, save vitals, diagnosis, doctor notes, e-prescriptions, and lab orders.
- **Auth**: `Doctor`

### `GET /api/consultations/{consultation_id}/report`
- **Method**: `GET`
- **Description**: Generates and downloads branded PDF clinical summary report via ReportLab.
- **Auth**: Required

---

## 📊 9. Dashboard & Analytics Endpoints (`/api/dashboard`)

### `GET /api/dashboard/admin`
- **Method**: `GET`
- **Description**: Returns 12+ KPI statistics, monthly registration trends, doctor workload distribution, department stats, and recent operational activity.
- **Auth**: `Admin` only
