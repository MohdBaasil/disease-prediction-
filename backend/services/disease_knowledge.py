import os
import pandas as pd
from typing import Dict, Any, List

class DiseaseKnowledgeService:
    def __init__(self):
        self.knowledge: Dict[str, Dict[str, Any]] = {}
        self.symptoms: List[str] = []
        self.load_data()

    def load_data(self):
        datasets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "datasets")
        
        # Use the exact 19 symptom names that map to the ML model's feature columns.
        # These are defined to match SYMPTOM_MODEL_MAPPING in patient_portal.py exactly.
        # Display name → maps via SYMPTOM_MODEL_MAPPING → model feature key
        self.symptoms = [
            "Frequent Urination",          # → frequent_urination
            "Increased Thirst",            # → increased_thirst
            "Family History Of Diabetes",  # → family_history_diabetes
            "Shortness Of Breath",         # → shortness_of_breath
            "Wheezing",                    # → wheezing
            "Chest Tightness",             # → chest_tightness
            "Cough",                       # → coughing
            "Throbbing Headache",          # → throbbing_headache
            "Nausea",                      # → nausea
            "Light Sensitivity",           # → light_sensitivity
            "Chest Pain",                  # → chest_pain
            "Pain Radiating To Arm Or Jaw",  # → pain_radiating_arm_jaw
            "Sweating",                    # → sweating
            "Sudden Numbness Or Weakness", # → sudden_numbness_weakness
            "Trouble Speaking",            # → trouble_speaking
            "Confusion",                   # → confusion
            "Drooping Face",               # → drooping_face
            "Shivering",                   # → shivering
            "Rapid Breathing",             # → rapid_breathing
        ]

        # Load lookup dataframes
        files = {
            "kb": "05_disease_knowledge_base.csv",
            "dept": "07_disease_department.csv",
            "tests": "08_disease_lab_tests.csv",
            "meds": "09_disease_medicines.csv",
            "prec": "10_disease_precautions.csv",
            "diet": "11_disease_diet.csv",
            "workout": "12_disease_workout.csv",
            "risk": "13_disease_risk.csv"
        }
        
        dfs: Dict[str, pd.DataFrame] = {}
        for key, fname in files.items():
            path = os.path.join(datasets_dir, fname)
            if os.path.exists(path):
                dfs[key] = pd.read_csv(path)
            else:
                print(f"Warning: {fname} not found in {datasets_dir}")
                dfs[key] = pd.DataFrame()

        # Let's populate knowledge for the 7 predicted diseases of our ML models
        target_diseases = ["Diabetes", "Asthma", "Migraine", "Heart Attack", "Stroke", "Sepsis", "Common Cold"]
        
        # Fallbacks for causes
        causes_map = {
            "diabetes": "Insulin resistance, genetic factors, obesity, lack of physical activity",
            "asthma": "Genetic predisposition, environmental allergens, respiratory infections, exercise, air pollution",
            "migraine": "Neurological changes, stress, hormonal fluctuations, lack of sleep, sensory triggers",
            "heart attack": "Coronary artery disease, high cholesterol, hypertension, smoking, obesity, family history",
            "stroke": "Cerebral ischemia (blood clot) or hemorrhage (ruptured blood vessel), hypertension, smoking, atherosclerosis",
            "sepsis": "Severe systemic immune response to a bacterial, viral or fungal infection (e.g. pneumonia, UTI)",
            "common cold": "Rhinovirus or other viral infections, spread through respiratory droplets, weakened immune system"
        }

        specialists_map = {
            "cardiology": "Cardiologist",
            "neurology": "Neurologist",
            "pulmonology": "Pulmonologist",
            "endocrinology": "Endocrinologist",
            "general medicine": "General Practitioner",
            "dermatology": "Dermatologist",
            "gastroenterology": "Gastroenterologist"
        }

        for disease in target_diseases:
            key_name = disease.lower()
            info = {
                "name": disease,
                "description": "No description available.",
                "causes": causes_map.get(key_name, "Clinical indicators and physiological factors."),
                "symptoms": "N/A",
                "department": "General Medicine",
                "specialist": "General Physician",
                "risk_level": "Low",
                "severity": "Mild",
                "emergency": "0",
                "precautions": [],
                "medicines": [],
                "tests": [],
                "diet": {"recommended": "Balanced diet", "avoid": "Processed foods"},
                "workout": "Light walking and stretching"
            }

            # 1. KB details
            if "kb" in dfs and not dfs["kb"].empty:
                row = dfs["kb"][dfs["kb"]["Disease_Name"].str.lower() == key_name]
                if not row.empty:
                    info["description"] = str(row.iloc[0]["Description"])
                    info["symptoms"] = str(row.iloc[0]["Symptoms"])
            
            # 2. Department details
            if "dept" in dfs and not dfs["dept"].empty:
                row = dfs["dept"][dfs["dept"]["Disease_Name"].str.lower() == key_name]
                if not row.empty:
                    info["department"] = str(row.iloc[0]["Department"])
                    info["specialist"] = specialists_map.get(info["department"].lower(), "Specialist")

            # 3. Risk and severity
            if "risk" in dfs and not dfs["risk"].empty:
                row = dfs["risk"][dfs["risk"]["Disease"].str.lower() == key_name]
                if not row.empty:
                    info["risk_level"] = str(row.iloc[0]["Risk_Level"])
                    info["severity"] = str(row.iloc[0]["Severity"])
                    info["emergency"] = str(row.iloc[0]["Emergency"])

            # 4. Precautions
            if "prec" in dfs and not dfs["prec"].empty:
                row = dfs["prec"][dfs["prec"]["Disease"].str.lower() == key_name]
                if not row.empty:
                    precs = []
                    for i in range(1, 5):
                        p_val = row.iloc[0].get(f"Precaution_{i}")
                        if p_val and pd.notna(p_val) and str(p_val).strip() != "":
                            precs.append(str(p_val))
                    info["precautions"] = precs

            # 5. Diet
            if "diet" in dfs and not dfs["diet"].empty:
                row = dfs["diet"][dfs["diet"]["Disease"].str.lower() == key_name]
                if not row.empty:
                    info["diet"] = {
                        "recommended": str(row.iloc[0]["Recommended_Diet"]),
                        "avoid": str(row.iloc[0]["Foods_To_Avoid"])
                    }

            # 6. Workout
            if "workout" in dfs and not dfs["workout"].empty:
                row = dfs["workout"][dfs["workout"]["Disease"].str.lower() == key_name]
                if not row.empty:
                    info["workout"] = str(row.iloc[0]["Workout"])

            # 7. Medicines
            if "meds" in dfs and not dfs["meds"].empty:
                rows = dfs["meds"][dfs["meds"]["Disease"].str.lower() == key_name]
                meds = []
                for _, r in rows.iterrows():
                    meds.append({
                        "name": str(r["Medicine"]),
                        "dosage": str(r["Dosage_Notes"]),
                        "frequency": "As directed by physician",
                        "notes": str(r["Disclaimer"])
                    })
                info["medicines"] = meds

            # 8. Tests
            if "tests" in dfs and not dfs["tests"].empty:
                rows = dfs["tests"][dfs["tests"]["Disease"].str.lower() == key_name]
                tests = []
                for _, r in rows.iterrows():
                    tests.append({
                        "name": str(r["Recommended_Test"]),
                        "reason": str(r["Validation_Status"])
                    })
                info["tests"] = tests

            self.knowledge[key_name] = info

    def get_disease_info(self, disease_name: str) -> Dict[str, Any]:
        return self.knowledge.get(disease_name.lower(), {
            "name": disease_name,
            "description": "AI predicted condition. Detailed clinical database lookup was unavailable.",
            "causes": "Underlying clinical indicator patterns.",
            "symptoms": "N/A",
            "department": "General Medicine",
            "specialist": "General Physician",
            "risk_level": "Low",
            "severity": "Mild",
            "emergency": "0",
            "precautions": ["Rest and hydrate", "Monitor vital signs", "Consult a physician if symptoms worsen"],
            "medicines": [],
            "tests": [],
            "diet": {"recommended": "Balanced diet with high hydration", "avoid": "High-sugar, highly processed foods"},
            "workout": "Rest is recommended. Avoid strenuous physical exercise."
        })

disease_knowledge_service = DiseaseKnowledgeService()
