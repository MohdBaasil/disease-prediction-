import os
import pandas as pd
import numpy as np

def generate_synthetic_data(filepath, n_samples=5000):
    np.random.seed(42)

    # Doctor configurations: {doctor_id: (department, avg_consultation_duration)}
    doctors = {
        1: ("Cardiology", 20),
        2: ("Cardiology", 25),
        3: ("Cardiology", 15),
        4: ("General Medicine", 10),
        5: ("General Medicine", 12),
        6: ("General Medicine", 15),
        7: ("General Medicine", 8),
        8: ("Orthopedics", 18),
        9: ("Orthopedics", 22),
        10: ("Orthopedics", 15)
    }

    data = []
    for _ in range(n_samples):
        doc_id = np.random.choice(list(doctors.keys()))
        dept, doc_avg = doctors[doc_id]
        
        # Features
        day_of_week = np.random.randint(0, 7)  # 0: Monday, 6: Sunday
        time_of_day = np.random.randint(480, 1020)  # Between 8:00 AM (480 mins) and 5:00 PM (1020 mins)
        
        # Patients currently waiting (0 to 15)
        patients_waiting = np.random.randint(0, 16)
        
        # Emergency patients waiting (must be <= patients_waiting)
        if patients_waiting > 0:
            emergency_patients = np.random.randint(0, min(patients_waiting + 1, 5))
        else:
            emergency_patients = 0
            
        # Doctor workload (patients seen so far today, 0 to 30)
        doctor_workload = np.random.randint(0, 31)
        
        # Add random noise to average consultation duration for this instance
        inst_avg_duration = max(5, doc_avg + np.random.normal(0, 2))
        
        # Calculate actual waiting time
        # Formula: normal patients waiting * avg duration + emergency patients * avg duration * 1.5 + some time-of-day/day-of-week factor
        if patients_waiting == 0:
            actual_wait_time = 0.0
        else:
            # Emergency patients jump ahead, but they also take time.
            # Base waiting time is the time it takes to clear all waiting patients before this user's turn
            base_wait = (patients_waiting - emergency_patients) * inst_avg_duration
            emerg_wait = emergency_patients * inst_avg_duration * 1.3
            
            # Doctor workload factor (fatigue increases duration slightly)
            workload_delay = doctor_workload * 0.2
            
            # Peak hours factor (lunch hour around 12:00-1:00 PM [720-780 mins] and end of day [960-1020 mins] have slight delays)
            peak_delay = 0.0
            if 720 <= time_of_day <= 780:
                peak_delay = 5.0
            elif time_of_day >= 960:
                peak_delay = 8.0
                
            # Random noise
            noise = np.random.normal(0, 3)
            
            actual_wait_time = max(0.0, base_wait + emerg_wait + workload_delay + peak_delay + noise)

        data.append({
            "doctor_id": doc_id,
            "department": dept,
            "day_of_week": day_of_week,
            "time_of_day_minutes": time_of_day,
            "patients_waiting": patients_waiting,
            "emergency_patients_waiting": emergency_patients,
            "doctor_workload": doctor_workload,
            "avg_consultation_time": round(inst_avg_duration, 2),
            "actual_wait_time": round(actual_wait_time, 2)
        })

    df = pd.DataFrame(data)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    df.to_csv(filepath, index=False)
    print(f"Generated {n_samples} samples of synthetic data at: {filepath}")

if __name__ == "__main__":
    import sys
    filepath = "backend/machine_learning/dataset/historical_consultations.csv"
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
    generate_synthetic_data(filepath)
