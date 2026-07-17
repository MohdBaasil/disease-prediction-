# Dataset Audit Report

This report documents the initial audit of the 19 datasets in the healthcare package, highlighting missing values, duplicates, empty columns, and relationship issues.

---

## 1. Summary of Raw Datasets

| File Name | Rows | Duplicate Rows | Empty Columns | Missing Fields & Count |
| :--- | :--- | :--- | :--- | :--- |
| `01_patients.csv` | 54,966 | 0 | Phone, Email, Address, Height, Weight, BMI, Emergency_Contact | Phone (54966), Email (54966), Address (54966), Height (54966), Weight (54966), BMI (54966), Emergency_Contact (54966) |
| `02_doctors.csv` | 50,000 | 0 | Qualification, Experience, Availability, Phone, Email | Qualification (50000), Experience (50000), Availability (50000), Phone (50000), Email (50000) |
| `03_departments.csv` | 19 | 0 | None | None |
| `04_hospitals.csv` | 39,876 | 0 | Location, Contact, Email | Location (39876), Contact (39876), Email (39876) |
| `05_disease_knowledge_base.csv` | 155 | 0 | None | Description (55), Symptoms (21), Medications (55), Diet (55), Precaution_1/2/3/4 (55 each), Workouts (55) |
| `06_disease_prediction_dataset.csv` | 25,000 | 0 | None | None |
| `07_disease_department.csv` | 155 | 0 | None | None |
| `08_disease_lab_tests.csv` | 397 | 0 | None | None |
| `09_disease_medicines.csv` | 500 | 0 | None | None |
| `10_disease_precautions.csv` | 155 | 0 | None | Precaution_1/2/3/4 (55 each) |
| `11_disease_diet.csv` | 155 | 0 | None | Recommended_Diet (55) |
| `12_disease_workout.csv` | 155 | 0 | None | Workout (55) |
| `13_disease_risk.csv` | 155 | 0 | None | None |
| `14_appointments.csv` | 54,966 | 0 | None | None |
| `15_queue.csv` | 5,000 | 0 | None | None |
| `16_prescriptions.csv` | 54,966 | 0 | None | None |
| `17_lab_reports.csv` | 54,966 | 0 | None | None |
| `18_notifications.csv` | 8,000 | 0 | None | None |
| `19_ml_training_dataset.csv` | 25,000 | 0 | None | None |

---

## 2. Key Findings & Anomalies

### A. Missing Values & Unpopulated Columns
- **`01_patients.csv`**: Contains demographic details but key clinical/contact columns (`Phone`, `Email`, `Address`, `Height`, `Weight`, `BMI`, `Emergency_Contact`) are completely empty (all null). `BMI_Category` is set to a placeholder value `"Unknown"`.
- **`02_doctors.csv`**: The credentials and contact details (`Qualification`, `Experience`, `Availability`, `Phone`, `Email`) are completely empty (all null).
- **`04_hospitals.csv`**: Completely empty for `Location`, `Contact`, and `Email`.
- **Medical Knowledge Base (`05`, `10`, `11`, `12`)**: Approximately 55 out of 155 disease records lack descriptive information, symptoms, medication recommendations, dietary guidelines, precautions, and recommended workouts.

### B. Scalability & Distribution Anomalies
- The raw dataset package defines **50,000 doctors** and **39,876 hospitals** to serve **54,966 patients**.
- This distribution is highly unrealistic (nearly 1 hospital per patient and 1 doctor per patient).
- To create a realistic healthcare network, the hospital count needs to be scaled down to **100–300** and doctors scaled down to **300–1,500** while keeping the **55k patient** records intact.

### C. Relationship Validation Issues
- Because doctors and hospitals will be scaled down, existing appointments, prescriptions, and queue entries will contain references to doctor IDs and hospital names that no longer exist in the master records.
- Appointments, prescriptions, and queue entries need to be re-mapped to point to valid doctors and hospitals.
- Currently, `15_queue.csv` does not link to appointments. An `Appointment_ID` reference needs to be added.
- Appointments (`14_appointments.csv`) lack explicit foreign keys for `Hospital_ID` and `Department_ID`.
