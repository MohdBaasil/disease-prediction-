import os
import joblib
import pandas as pd

# Global cache for the loaded model pipeline
_model_pipeline = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "model_pipeline.pkl")

def load_model():
    global _model_pipeline
    if _model_pipeline is not None:
        return _model_pipeline
        
    if os.path.exists(MODEL_PATH):
        try:
            _model_pipeline = joblib.load(MODEL_PATH)
            return _model_pipeline
        except Exception as e:
            print(f"Error loading model from {MODEL_PATH}: {e}")
            return None
    else:
        print(f"Model file not found at {MODEL_PATH}. Prediction service will use fallback estimator.")
        return None

def predict_waiting_time(
    doctor_id: int,
    department: str,
    day_of_week: int,
    time_of_day_minutes: int,
    patients_waiting: int,
    emergency_patients_waiting: int,
    doctor_workload: int,
    avg_consultation_time: float
) -> float:
    """
    Predicts the waiting time in minutes for a patient entering the queue.
    If the trained ML model is not available, falls back to a deterministic calculation.
    """
    model = load_model()
    
    if model is not None:
        # Construct dataframe matching feature names
        input_data = pd.DataFrame([{
            "doctor_id": doctor_id,
            "department": department,
            "day_of_week": day_of_week,
            "time_of_day_minutes": time_of_day_minutes,
            "patients_waiting": patients_waiting,
            "emergency_patients_waiting": emergency_patients_waiting,
            "doctor_workload": doctor_workload,
            "avg_consultation_time": avg_consultation_time
        }])
        
        try:
            prediction = model.predict(input_data)[0]
            # Prediction cannot be negative
            return float(max(0.0, prediction))
        except Exception as e:
            print(f"Error making ML prediction: {e}. Falling back to baseline.")
            
    # Fallback Baseline calculation
    if patients_waiting == 0:
        return 0.0
        
    # Standard queue wait: normal patients wait for average doctor consultation duration
    normal_patients = max(0, patients_waiting - emergency_patients_waiting)
    wait_time = normal_patients * avg_consultation_time
    
    # Emergency patients add extra delay (they jump ahead but also consume doctor time)
    wait_time += emergency_patients_waiting * avg_consultation_time * 1.3
    
    # Workload adjustment
    wait_time += doctor_workload * 0.2
    
    return float(max(0.0, wait_time))
