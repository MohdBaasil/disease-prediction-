import os
import pandas as pd
import numpy as np

def generate_disease_data(filepath, n_samples=2100):
    np.random.seed(42)
    
    diseases = ["Diabetes", "Asthma", "Migraine", "Heart Attack", "Stroke", "Sepsis", "Common Cold"]
    samples_per_disease = n_samples // len(diseases)
    
    data = []
    
    for disease in diseases:
        for _ in range(samples_per_disease):
            # Base features
            age = np.random.randint(18, 85)
            bmi = np.random.normal(24, 4)
            blood_glucose = np.random.normal(90, 15)
            heart_rate = np.random.normal(75, 10)
            temperature = np.random.normal(98.2, 0.4)
            systolic_bp = np.random.normal(115, 10)
            
            # Symptoms (defaults to low probability of occurrence)
            symptoms = {
                "frequent_urination": np.random.choice([0, 1], p=[0.9, 0.1]),
                "increased_thirst": np.random.choice([0, 1], p=[0.9, 0.1]),
                "family_history_diabetes": np.random.choice([0, 1], p=[0.8, 0.2]),
                "shortness_of_breath": np.random.choice([0, 1], p=[0.85, 0.15]),
                "wheezing": np.random.choice([0, 1], p=[0.95, 0.05]),
                "chest_tightness": np.random.choice([0, 1], p=[0.92, 0.08]),
                "coughing": np.random.choice([0, 1], p=[0.8, 0.2]),
                "throbbing_headache": np.random.choice([0, 1], p=[0.9, 0.1]),
                "nausea": np.random.choice([0, 1], p=[0.9, 0.1]),
                "light_sensitivity": np.random.choice([0, 1], p=[0.93, 0.07]),
                "chest_pain": np.random.choice([0, 1], p=[0.9, 0.1]),
                "pain_radiating_arm_jaw": np.random.choice([0, 1], p=[0.95, 0.05]),
                "sweating": np.random.choice([0, 1], p=[0.85, 0.15]),
                "sudden_numbness_weakness": np.random.choice([0, 1], p=[0.97, 0.03]),
                "trouble_speaking": np.random.choice([0, 1], p=[0.97, 0.03]),
                "confusion": np.random.choice([0, 1], p=[0.95, 0.05]),
                "drooping_face": np.random.choice([0, 1], p=[0.98, 0.02]),
                "shivering": np.random.choice([0, 1], p=[0.93, 0.07]),
                "rapid_breathing": np.random.choice([0, 1], p=[0.9, 0.1])
            }
            
            # Apply disease-specific logic to override vitals and symptoms
            if disease == "Diabetes":
                age = np.random.randint(35, 80)
                bmi = np.random.normal(30, 4) # Overweight/obese
                blood_glucose = np.random.normal(175, 45) # Hyperglycemia
                symptoms["frequent_urination"] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms["increased_thirst"] = np.random.choice([0, 1], p=[0.2, 0.8])
                symptoms["family_history_diabetes"] = np.random.choice([0, 1], p=[0.3, 0.7])
                
            elif disease == "Asthma":
                age = np.random.randint(5, 55)
                symptoms["shortness_of_breath"] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms["wheezing"] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms["chest_tightness"] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms["coughing"] = np.random.choice([0, 1], p=[0.25, 0.75])
                
            elif disease == "Migraine":
                age = np.random.randint(18, 50)
                symptoms["throbbing_headache"] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms["nausea"] = np.random.choice([0, 1], p=[0.2, 0.8])
                symptoms["light_sensitivity"] = np.random.choice([0, 1], p=[0.1, 0.9])
                
            elif disease == "Heart Attack":
                age = np.random.randint(50, 85)
                bmi = np.random.normal(28, 3.5)
                heart_rate = np.random.normal(105, 15) # Tachycardia
                systolic_bp = np.random.normal(145, 20) # High BP
                symptoms["chest_pain"] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms["pain_radiating_arm_jaw"] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms["sweating"] = np.random.choice([0, 1], p=[0.2, 0.8])
                symptoms["shortness_of_breath"] = np.random.choice([0, 1], p=[0.35, 0.65])
                
            elif disease == "Stroke":
                age = np.random.randint(55, 90)
                systolic_bp = np.random.normal(160, 25) # Severe hypertension
                symptoms["sudden_numbness_weakness"] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms["trouble_speaking"] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms["drooping_face"] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms["confusion"] = np.random.choice([0, 1], p=[0.3, 0.7])
                
            elif disease == "Sepsis":
                age = np.random.randint(30, 85)
                heart_rate = np.random.normal(115, 15) # Tachycardia
                # Temperature: extreme fever or hypothermia
                if np.random.rand() > 0.15:
                    temperature = np.random.normal(101.8, 1.2) # High Fever
                else:
                    temperature = np.random.normal(95.5, 0.8) # Hypothermia
                systolic_bp = np.random.normal(82, 8) # Low BP (hypotension)
                symptoms["shivering"] = np.random.choice([0, 1], p=[0.1, 0.9])
                symptoms["rapid_breathing"] = np.random.choice([0, 1], p=[0.05, 0.95])
                symptoms["confusion"] = np.random.choice([0, 1], p=[0.2, 0.8])
                symptoms["shortness_of_breath"] = np.random.choice([0, 1], p=[0.4, 0.6])
                
            elif disease == "Common Cold":
                temperature = np.random.normal(99.4, 0.8) # Mild fever
                symptoms["coughing"] = np.random.choice([0, 1], p=[0.15, 0.85])
                symptoms["shivering"] = np.random.choice([0, 1], p=[0.6, 0.4])
                
            # Construct row
            row = {
                "age": int(age),
                "bmi": round(max(10.0, bmi), 1),
                "blood_glucose": int(max(40, blood_glucose)),
                "heart_rate": int(max(40, heart_rate)),
                "temperature": round(temperature, 1),
                "systolic_bp": int(max(50, systolic_bp)),
                **symptoms,
                "disease": disease
            }
            data.append(row)
            
    df = pd.DataFrame(data)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    df.to_csv(filepath, index=False)
    print(f"[SUCCESS] Generated {len(df)} samples at {filepath}")

if __name__ == "__main__":
    filepath = os.path.join(os.path.dirname(__file__), "disease_dataset.csv")
    generate_disease_data(filepath)
