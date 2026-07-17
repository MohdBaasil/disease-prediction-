import os
import joblib
import pandas as pd
import numpy as np

# Load models once
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "saved_model")

_rf_model = None
_gb_model = None
_xgb_model = None
_le = None

def load_models():
    global _rf_model, _gb_model, _xgb_model, _le
    if _rf_model is None:
        _rf_model = joblib.load(os.path.join(MODEL_DIR, "disease_rf.pkl"))
    if _gb_model is None:
        _gb_model = joblib.load(os.path.join(MODEL_DIR, "disease_gb.pkl"))
    if _xgb_model is None:
        _xgb_model = joblib.load(os.path.join(MODEL_DIR, "disease_xgb.pkl"))
    if _le is None:
        _le = joblib.load(os.path.join(MODEL_DIR, "disease_label_encoder.pkl"))
    return _rf_model, _gb_model, _xgb_model, _le

def predict_disease(vitals: dict, symptoms: dict) -> dict:
    rf, gb, xgb, le = load_models()
    
    # Feature columns order must match generate_disease_data.py
    feature_cols = [
        "age", "bmi", "blood_glucose", "heart_rate", "temperature", "systolic_bp",
        "frequent_urination", "increased_thirst", "family_history_diabetes",
        "shortness_of_breath", "wheezing", "chest_tightness", "coughing",
        "throbbing_headache", "nausea", "light_sensitivity", "chest_pain",
        "pain_radiating_arm_jaw", "sweating", "sudden_numbness_weakness",
        "trouble_speaking", "confusion", "drooping_face", "shivering",
        "rapid_breathing"
    ]
    
    # Construct input dataframe
    input_dict = {}
    # Vitals
    input_dict["age"] = float(vitals.get("age", 30))
    input_dict["bmi"] = float(vitals.get("bmi", 24.0))
    input_dict["blood_glucose"] = float(vitals.get("blood_glucose", 90))
    input_dict["heart_rate"] = float(vitals.get("heart_rate", 75))
    input_dict["temperature"] = float(vitals.get("temperature", 98.2))
    input_dict["systolic_bp"] = float(vitals.get("systolic_bp", 115))
    
    # Symptoms
    for sym in feature_cols[6:]:
        input_dict[sym] = int(symptoms.get(sym, 0))
        
    df = pd.DataFrame([input_dict])
    
    # Predict probabilities
    rf_proba = rf.predict_proba(df)[0]
    gb_proba = gb.predict_proba(df)[0]
    xgb_proba = xgb.predict_proba(df)[0]
    
    # Soft voting ensemble
    ensemble_proba = (rf_proba + gb_proba + xgb_proba) / 3.0
    
    # Predicted index
    predicted_idx = np.argmax(ensemble_proba)
    predicted_disease = le.classes_[predicted_idx]
    confidence_score = ensemble_proba[predicted_idx]
    
    # Get top 3 predictions
    top_indices = np.argsort(ensemble_proba)[::-1][:3]
    top_predictions = [
        {"disease": le.classes_[idx], "probability": float(ensemble_proba[idx])}
        for idx in top_indices
    ]
    
    # Compare individual models
    rf_pred_idx = np.argmax(rf_proba)
    gb_pred_idx = np.argmax(gb_proba)
    xgb_pred_idx = np.argmax(xgb_proba)
    
    comparisons = {
        "random_forest": {"disease": le.classes_[rf_pred_idx], "probability": float(rf_proba[rf_pred_idx])},
        "gradient_boosting": {"disease": le.classes_[gb_pred_idx], "probability": float(gb_proba[gb_pred_idx])},
        "xgboost": {"disease": le.classes_[xgb_pred_idx], "probability": float(xgb_proba[xgb_pred_idx])}
    }
    
    # Explainable AI: Identify why
    reasons = []
    
    # Define mapping from disease to matching symptoms and vital conditions
    explanation_map = {
        "Diabetes": [
            ("blood_glucose", lambda x: x > 125, "Elevated Blood Glucose levels (Hyperglycemia)"),
            ("bmi", lambda x: x >= 25.0, "Elevated Body Mass Index (Overweight/Obese status)"),
            ("frequent_urination", lambda x: x == 1, "Frequent Urination (Polyuria)"),
            ("increased_thirst", lambda x: x == 1, "Excessive Thirst (Polydipsia)"),
            ("family_history_diabetes", lambda x: x == 1, "Genetic Risk / Family History of Diabetes")
        ],
        "Asthma": [
            ("shortness_of_breath", lambda x: x == 1, "Dyspnea (Shortness of Breath)"),
            ("wheezing", lambda x: x == 1, "Airway Wheezing or constriction"),
            ("chest_tightness", lambda x: x == 1, "Chest Tightness"),
            ("coughing", lambda x: x == 1, "Frequent Coughing")
        ],
        "Migraine": [
            ("throbbing_headache", lambda x: x == 1, "Severe Throbbing Head Pain"),
            ("nausea", lambda x: x == 1, "Associated Nausea or Vomiting"),
            ("light_sensitivity", lambda x: x == 1, "Photophobia (Sensitivity to Light/Sound)")
        ],
        "Heart Attack": [
            ("chest_pain", lambda x: x == 1, "Crushing Chest Pain (Angina)"),
            ("pain_radiating_arm_jaw", lambda x: x == 1, "Pain radiating to Left Arm, Shoulders, or Jaw"),
            ("sweating", lambda x: x == 1, "Profuse Sweating (Diaphoresis)"),
            ("heart_rate", lambda x: x > 100, "Elevated Heart Rate (Tachycardia)"),
            ("shortness_of_breath", lambda x: x == 1, "Shortness of Breath")
        ],
        "Stroke": [
            ("sudden_numbness_weakness", lambda x: x == 1, "Sudden numbness or unilateral weakness in limbs"),
            ("trouble_speaking", lambda x: x == 1, "Aphasia / Difficulty speaking or slurring words"),
            ("drooping_face", lambda x: x == 1, "Facial drooping or asymmetry"),
            ("systolic_bp", lambda x: x > 140, "Severe Hypertension (High Blood Pressure)"),
            ("confusion", lambda x: x == 1, "Sudden onset confusion or spatial disorientation")
        ],
        "Sepsis": [
            ("temperature", lambda x: x > 100.4 or x < 96.8, "Extreme temperature anomaly (Fever or Hypothermia)"),
            ("heart_rate", lambda x: x > 100, "Elevated Heart Rate (Tachycardia)"),
            ("rapid_breathing", lambda x: x == 1, "Rapid respiration rate (Tachypnea)"),
            ("systolic_bp", lambda x: x < 90, "Severe Hypotension / Shock (Low Blood Pressure)"),
            ("shivering", lambda x: x == 1, "Uncontrolled shivering or rigors"),
            ("confusion", lambda x: x == 1, "Altered Mental Status or acute confusion")
        ],
        "Common Cold": [
            ("coughing", lambda x: x == 1, "Active Coughing"),
            ("temperature", lambda x: x >= 99.0 and x <= 100.4, "Low-grade fever"),
            ("shivering", lambda x: x == 1, "Mild shivering or chills")
        ]
    }
    
    # Check conditions
    if predicted_disease in explanation_map:
        for feat, check_fn, desc in explanation_map[predicted_disease]:
            val = input_dict.get(feat, 0)
            if check_fn(val):
                reasons.append(desc)
                
    # If no specific reason found, add a fallback generic reason
    if not reasons:
        reasons.append("Clinical indicator patterns matching historical dataset.")
        
    # Risk Level
    severity = "Low"
    if predicted_disease in ["Heart Attack", "Stroke", "Sepsis"]:
        severity = "High"
    elif predicted_disease in ["Diabetes", "Asthma"]:
        severity = "Medium"
        
    if severity == "High":
        risk_level = "High"
        badge_color = "Red"
    elif severity == "Medium":
        if confidence_score > 0.7:
            risk_level = "High"
            badge_color = "Red"
        else:
            risk_level = "Medium"
            badge_color = "Yellow"
    else:
        if confidence_score > 0.8:
            risk_level = "Medium"
            badge_color = "Yellow"
        else:
            risk_level = "Low"
            badge_color = "Green"
            
    # Department Recommendations
    # Mapped departments in hospital.db: General Medicine, Cardiology, Orthopedics, Oncology
    dept_map = {
        "Diabetes": {"specialty": "Endocrinology", "mapped_db_dept": "General Medicine"},
        "Asthma": {"specialty": "Pulmonology", "mapped_db_dept": "General Medicine"},
        "Migraine": {"specialty": "Neurology", "mapped_db_dept": "General Medicine"},
        "Heart Attack": {"specialty": "Cardiology", "mapped_db_dept": "Cardiology"},
        "Stroke": {"specialty": "Neurology", "mapped_db_dept": "General Medicine"},
        "Sepsis": {"specialty": "General Medicine / Intensive Care", "mapped_db_dept": "General Medicine"},
        "Common Cold": {"specialty": "General Medicine", "mapped_db_dept": "General Medicine"}
    }
    dept_rec = dept_map.get(predicted_disease, {"specialty": "General Medicine", "mapped_db_dept": "General Medicine"})
    
    # Suggested Lab Tests
    lab_tests_map = {
        "Diabetes": ["HbA1c Glycated Hemoglobin Test", "Fasting Blood Sugar Test", "Microalbumin Urine Test"],
        "Asthma": ["Spirometry Lung Function Test", "Peak Expiratory Flow Measurement", "Chest X-ray"],
        "Migraine": ["Diagnostic Brain MRI", "Brain CT Scan", "Neurological Exam Panel"],
        "Heart Attack": ["Electrocardiogram (ECG)", "Serum Cardiac Troponin I/T Levels", "Echocardiogram"],
        "Stroke": ["Non-contrast Brain CT Scan", "Brain MRI (Diffusion-Weighted)", "Carotid Duplex Ultrasound"],
        "Sepsis": ["Blood Cultures (dual sites)", "Complete Blood Count (CBC)", "Blood Lactate Level", "Urinalysis and Culture"],
        "Common Cold": ["Rapid Influenza Swab (differential)", "Covid-19 Antigen Rapid Test", "Symptomatic assessment"]
    }
    lab_tests = lab_tests_map.get(predicted_disease, ["General Routine Blood Panel"])
    
    # Medicine Suggestions
    medicines_map = {
        "Diabetes": ["Metformin 500mg tablets (Oral hypoglycemic)", "Short-acting or Long-acting Insulin (under supervision)"],
        "Asthma": ["Albuterol (Salbutamol) Metered Dose Inhaler (Bronchodilator)", "Fluticasone Propionate Inhaler (Inhaled corticosteroid)"],
        "Migraine": ["Sumatriptan 50mg tablets (Triptan therapy)", "Ibuprofen 400mg tablets (NSAID pain relief)"],
        "Heart Attack": ["Aspirin 325mg (Antiplatelet therapy, chewed immediately)", "Nitroglycerin sublingual spray (Vasodilator)"],
        "Stroke": ["Tissue Plasminogen Activator (tPA) (for ischemic stroke)", "Aspirin (secondary prevention, non-hemorrhagic only)"],
        "Sepsis": ["Empiric Broad-spectrum Intravenous Antibiotics", "Intravenous Crystalloid Fluid Resuscitation"],
        "Common Cold": ["Paracetamol (Acetaminophen) 500mg (Antipyretic/Analgesic)", "Decongestant nasal sprays"]
    }
    medicines = medicines_map.get(predicted_disease, ["Symptomatic OTC therapy support"])
    
    is_emergency = predicted_disease in ["Heart Attack", "Stroke", "Sepsis"]
    
    return {
        "predicted_disease": predicted_disease,
        "confidence_score": float(confidence_score),
        "top_predictions": top_predictions,
        "comparisons": comparisons,
        "reasons": reasons,
        "risk_level": risk_level,
        "badge_color": badge_color,
        "recommended_specialty": dept_rec["specialty"],
        "mapped_db_dept": dept_rec["mapped_db_dept"],
        "suggested_tests": lab_tests,
        "suggested_medicines": medicines,
        "medicine_disclaimer": "DISCLAIMER: The drug recommendations provided are for educational and informational purposes only. They do not constitute actual medical prescriptions. The final prescribing decisions must be made by a licensed medical practitioner.",
        "is_emergency": is_emergency
    }
