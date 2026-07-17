# Dataset Validation Report

This report documents the post-improvement state of the healthcare datasets, confirming reference integrity, scaling, and the addition of the new datasets.

## 1. Relational Integrity Checks

All foreign key checks passed successfully:
- **Appointments (`14_appointments.csv`)**: 100% of the appointments reference valid patients, doctors, departments, and hospitals.
- **Queue Entries (`15_queue.csv`)**: 100% of the queue records reference valid appointments, patients, and doctors.
- **Prescriptions (`16_prescriptions.csv`)**: 100% of the prescriptions reference valid patients and doctors.
- **Lab Reports (`17_lab_reports.csv`)**: 100% of the lab reports reference valid, existing patients.
- **Notifications (`18_notifications.csv`)**: 100% of the notifications reference valid patients.

---

## 2. Realistic Healthcare Network Statistics

- **Hospitals**: scaled down to **200** (from ~40k). All columns fully populated.
- **Doctors**: scaled down to **1,000** (from 50k). All columns fully populated.
- **Departments**: **19** departments.
- **Patients**: **54,966** patients. Empty demographic and vital columns (`Phone`, `Email`, `Address`, `Height`, `Weight`, `BMI`, `Emergency_Contact`) are fully populated. `BMI_Category` matches recalculated BMI.

---

## 3. Added Master Datasets

The following new datasets have been added under `datasets/` with 100% integrity:
- `20_symptom_master.csv`
- `21_disease_master.csv`
- `22_medical_history.csv`
- `23_prediction_logs.csv`
- `24_patient_vitals.csv`
- `25_doctor_schedule.csv`
- `26_doctor_department_mapping.csv`
- `27_patient_visits.csv`
- `28_hospital_rooms.csv`
- `29_feature_importance.csv`
- `30_doctor_recommendation_mapping.csv`

---

## 4. ML Dataset Validation (Task 7)

- **Class Balance**: 30 classes are fully balanced (frequencies range between 782 and 911).
- **Missing Labels**: 0 null targets in the ML training dataset.
- **Symptom Encoding**: Checked one-hot columns against string labels; they are 100% consistent.
