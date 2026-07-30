# Future Enhancements: AcuraQueue Hospital Management System

---

## 🔮 1. Roadmap & Architecture Upgrades

While **AcuraQueue** is a complete, production-ready system for outpatient and general clinic operations, the following realistic enhancements will enable enterprise multi-hospital scaling:

---

## 🐘 2. Database Migration (PostgreSQL)

- **Current State**: Uses SQLite (`hospital_v2.db`) for lightweight, zero-configuration file storage.
- **Future Enhancement**: Migrate connection string to **PostgreSQL 16**.
- **Benefits**: Support high-concurrency write transactions across multi-terminal reception desks and multi-doctor consultations simultaneously, leveraging native JSONB data types for complex lab results.

---

## 🐳 3. Containerization & Orchestration (Docker & Kubernetes)

- **Current State**: Running FastAPI with Uvicorn locally and React with Vite.
- **Future Enhancement**: Create a multi-stage `Dockerfile` and `docker-compose.yml`:
  ```yaml
  version: '3.8'
  services:
    backend:
      build: ./backend
      ports: ["8000:8000"]
      environment:
        - DATABASE_URL=postgresql://user:pass@db:5432/acuraqueue
    frontend:
      build: ./frontend
      ports: ["80:80"]
    db:
      image: postgres:16
  ```
- **Benefits**: One-command deployment across cloud platforms (AWS ECS, Azure App Service, GCP Cloud Run).

---

## 🔄 4. CI/CD Pipeline Automation (GitHub Actions)

- **Future Enhancement**: Implement a `.github/workflows/ci.yml` pipeline that triggers on every pull request:
  1. Runs backend Python verification tests (`test_appointments.py`, `test_sprint4_*.py`).
  2. Runs `npm run build` to verify Vite React bundle creation.
  3. Deploys passing builds automatically to staging/production servers.

---

## 📲 5. External SMS & Email Notifications Gateway

- **Current State**: In-app notification queue and toggle configurations in System Settings.
- **Future Enhancement**: Integrate **Twilio SMS API** and **SendGrid Email API**.
- **Use Cases**:
  - Automatically text patients 1 hour before scheduled appointments.
  - Text patients when their queue ticket is 2 calls away from being summoned.

---

## 🚀 6. Scalable WebSocket Event Bus (Redis Pub/Sub)

- **Current State**: Single-node FastAPI in-memory WebSocket ConnectionManager.
- **Future Enhancement**: Attach **Redis** as a distributed message broker.
- **Benefits**: Enables horizontal scaling across multiple FastAPI worker nodes behind a Nginx load balancer while keeping queue calling ticket broadcasts perfectly synchronized.

---

## 🔒 7. Advanced Security & Compliance

- **Two-Factor Authentication (2FA)**: Add TOTP authenticator app support for Admin and Doctor logins.
- **API Rate Limiting**: Apply `slowapi` rate-limiting middleware to prevent brute-force login attempts.
- **HIPAA Audit Log Viewer**: Dedicated UI panel in Admin Dashboard for searching and exporting raw audit logs (`AuditLog` table).
