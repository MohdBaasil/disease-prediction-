import os
import re
import pandas as pd
from typing import Dict, Any, List, Optional

def normalize_disease_name(name: str) -> str:
    if not name:
        return ""
    # 1. Lowercase, trim, strip duplicate spaces
    clean = " ".join(str(name).strip().lower().split())
    # 2. Remove non-alphanumeric characters except spaces
    clean = re.sub(r'[^\w\s]', '', clean)
    
    # Common medical alias mappings (adjective/variant -> standard noun)
    alias_map = {
        "diabetic": "diabetes",
        "type 2 diabetes": "diabetes",
        "type1 diabetes": "diabetes",
        "diabetic mellitus": "diabetes",
        "hypertensive": "hypertension",
        "hypertensive heart disease": "hypertension",
        "asthmatic": "asthma",
        "cardiac": "heart attack",
        "myocardial infarction": "heart attack",
        "cerebrovascular accident": "stroke",
        "cva": "stroke",
        "varicose veins": "varicose vein",
        "varicose vein": "varicose vein"
    }
    
    if clean in alias_map:
        return alias_map[clean]
        
    # 3. Handle plural / singular differences
    known_exceptions = {"diabetes", "sepsis", "tuberculosis", "psoriasis", "syphilis", "pertussis", "herpes", "shingles"}
    words = clean.split()
    norm_words = []
    for w in words:
        if w in known_exceptions:
            norm_words.append(w)
        elif w.endswith("ies") and len(w) > 4:
            norm_words.append(w[:-3] + "y")
        elif w.endswith("es") and len(w) > 4 and not w.endswith("ses") and not w.endswith("ches"):
            norm_words.append(w[:-1])
        elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
            norm_words.append(w[:-1])
        else:
            norm_words.append(w)
            
    res = " ".join(norm_words)
    return alias_map.get(res, res)

def classify_medicine(med_name: str, med_type: str, disease_name: str) -> tuple:
    """
    Classifies a medicine into (category, reason, priority_rank)
    Priority:
    1: Primary Treatment (disease modifying, targeted)
    2: Supportive Therapy (hydration, organ support, supplements)
    3: Symptomatic Treatment (pain, anti-fever, symptom relief)
    """
    name_lower = med_name.lower()
    
    # Symptomatic keywords
    symptomatic_keywords = [
        "pain reliever", "paracetamol", "acetaminophen", "nsaid", "ibuprofen",
        "cough suppressant", "decongestant", "anti-emetic", "antipyretic",
        "calamine", "sitz bath", "compresses", "gargles", "ice", "bandage"
    ]
    
    # Supportive keywords
    supportive_keywords = [
        "hydration", "saline", "oxygen", "stool softener", "docusate",
        "multivitamin", "electrolyte", "dietary", "probiotic", "supplement", "enzyme"
    ]
    
    if any(k in name_lower for k in symptomatic_keywords):
        return ("Symptomatic Treatment", f"Provides relief for pain/discomfort associated with {disease_name}.", 3)
    elif any(k in name_lower for k in supportive_keywords):
        return ("Supportive Therapy", f"Provides physiological supportive care during recovery from {disease_name}.", 2)
    else:
        return ("Primary Treatment", f"Primary disease-modifying therapeutic agent targeting {disease_name} pathophysiology.", 1)

class DiseaseKnowledgeService:
    def __init__(self):
        self.knowledge: Dict[str, Dict[str, Any]] = {}
        self.disease_id_map: Dict[str, str] = {} # DIS000001 -> norm_key
        self.symptoms: List[str] = []
        self.load_data()

    def load_data(self):
        datasets_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "datasets")
        
        self.symptoms = [
            "Frequent Urination", "Increased Thirst", "Family History Of Diabetes",
            "Shortness Of Breath", "Wheezing", "Chest Tightness", "Cough",
            "Throbbing Headache", "Nausea", "Light Sensitivity", "Chest Pain",
            "Pain Radiating To Arm Or Jaw", "Sweating", "Sudden Numbness Or Weakness",
            "Trouble Speaking", "Confusion", "Drooping Face", "Shivering", "Rapid Breathing"
        ]

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
                print(f"[DiseaseKnowledge] Warning: {fname} not found in {datasets_dir}")
                dfs[key] = pd.DataFrame()

        # Add normalized disease column to sub-dataframes
        for df_key in ["dept", "tests", "meds", "prec", "diet", "workout", "risk"]:
            if df_key in dfs and not dfs[df_key].empty:
                col = "Disease" if "Disease" in dfs[df_key].columns else "Disease_Name"
                if col in dfs[df_key].columns:
                    dfs[df_key]["norm_disease"] = dfs[df_key][col].apply(normalize_disease_name)

        specialists_map = {
            "cardiology": "Cardiologist",
            "neurology": "Neurologist",
            "pulmonology": "Pulmonologist",
            "endocrinology": "Endocrinologist",
            "general medicine": "General Practitioner",
            "dermatology": "Dermatologist",
            "gastroenterology": "Gastroenterologist",
            "psychiatry": "Psychiatrist",
            "nephrology": "Nephrologist",
            "urology": "Urologist",
            "rheumatology": "Rheumatologist",
            "hematology": "Hematologist",
            "immunology": "Immunologist"
        }

        # 1. Collect all unique disease names across KB and Sub-datasets
        all_diseases = set()
        if "kb" in dfs and not dfs["kb"].empty and "Disease_Name" in dfs["kb"].columns:
            for idx, r in dfs["kb"].iterrows():
                d_name = str(r["Disease_Name"]).strip()
                d_id = str(r.get("Disease_ID", "")).strip()
                if d_name:
                    all_diseases.add(d_name)
                    norm_k = normalize_disease_name(d_name)
                    if d_id:
                        self.disease_id_map[d_id.lower()] = norm_k

        # Also add any diseases found in sub-datasets
        for df_key in ["meds", "tests", "dept"]:
            if df_key in dfs and not dfs[df_key].empty and "norm_disease" in dfs[df_key].columns:
                for norm_d in dfs[df_key]["norm_disease"].dropna().unique():
                    if norm_d:
                        all_diseases.add(norm_d)

        # Standard disease guideline fallbacks for core diseases without CSV rows
        guideline_fallbacks = {
            "diabetes": {
                "meds": [
                    {"name": "Metformin", "dosage": "500mg - 1000mg", "frequency": "Twice daily with meals", "notes": "First-line oral blood glucose regulator.", "category": "Primary Treatment", "reason": "First-line biguanide reducing hepatic glucose output and enhancing insulin sensitivity."},
                    {"name": "Empagliflozin (SGLT2 inhibitor)", "dosage": "10mg", "frequency": "Once daily in morning", "notes": "Reduces renal glucose reabsorption & CV risk.", "category": "Primary Treatment", "reason": "SGLT2 inhibitor providing glycemic control and cardiorenal protection."},
                    {"name": "Sitagliptin (DPP-4 inhibitor)", "dosage": "100mg", "frequency": "Once daily", "notes": "Enhances incretin hormone levels.", "category": "Primary Treatment", "reason": "Incretin enhancer regulating postprandial glucose levels."},
                    {"name": "Glimepiride (Sulfonylurea)", "dosage": "1mg - 2mg", "frequency": "Once daily with breakfast", "notes": "Stimulates pancreatic insulin secretion.", "category": "Primary Treatment", "reason": "Insulin secretagogue for glycemic management."}
                ],
                "tests": [
                    {"name": "HbA1c (Glycated Hemoglobin)", "reason": "Evaluates 3-month average blood glucose control."},
                    {"name": "Fasting Blood Glucose", "reason": "Baseline morning glycemic assessment."},
                    {"name": "Urine Microalbumin / Creatinine Ratio", "reason": "Diabetic nephropathy screening."}
                ],
                "diet": {"recommended": "Low Glycemic Index Foods, High Fiber Vegetables, Whole Grains", "avoid": "Refined sugars, sweetened beverages, white flour products"},
                "workout": "30-minute daily brisk walking, Resistance training 2-3 times weekly",
                "precautions": ["Monitor blood glucose log daily", "Perform routine foot inspection", "Maintain adequate hydration"]
            },
            "migraine": {
                "meds": [
                    {"name": "Sumatriptan", "dosage": "50mg - 100mg", "frequency": "At onset of headache", "notes": "Serotonin 5-HT1B/1D agonist for acute attack.", "category": "Primary Treatment", "reason": "Selective 5-HT agonist inducing cranial vasoconstriction during acute attack."},
                    {"name": "Propranolol", "dosage": "40mg - 80mg", "frequency": "Twice daily", "notes": "Prophylactic beta-blocker.", "category": "Primary Treatment", "reason": "First-line prophylactic beta-blocker reducing attack frequency."},
                    {"name": "Naproxen Sodium", "dosage": "550mg", "frequency": "Every 12 hours as needed", "notes": "NSAID analgesic.", "category": "Symptomatic Treatment", "reason": "NSAID targeting neurogenic vascular inflammation."}
                ],
                "tests": [
                    {"name": "Brain MRI / CT Scan", "reason": "Rules out secondary intracranial structural lesions."}
                ],
                "diet": {"recommended": "Magnesium-rich foods (spinach, seeds), Adequate hydration", "avoid": "Aged cheeses, artificial sweeteners, alcohol"},
                "workout": "Gentle yoga, Breathing exercises, Low-impact walking",
                "precautions": ["Identify & avoid sensory triggers", "Maintain regular sleep schedule"]
            },
            "stroke": {
                "meds": [
                    {"name": "Aspirin", "dosage": "81mg - 325mg", "frequency": "Once daily", "notes": "Antiplatelet for secondary prevention.", "category": "Primary Treatment", "reason": "Antiplatelet agent preventing secondary ischemic thromboembolism."},
                    {"name": "Clopidogrel", "dosage": "75mg", "frequency": "Once daily", "notes": "Alternative antiplatelet.", "category": "Primary Treatment", "reason": "ADP P2Y12 inhibitor for ischemic stroke prevention."},
                    {"name": "Atorvastatin", "dosage": "40mg - 80mg", "frequency": "Once daily at night", "notes": "High-intensity statin.", "category": "Supportive Therapy", "reason": "HMG-CoA reductase inhibitor stabilizing atherosclerotic plaque."}
                ],
                "tests": [
                    {"name": "Non-contrast Brain CT Scan", "reason": "Differentiates ischemic vs hemorrhagic stroke."},
                    {"name": "Carotid Doppler Ultrasound", "reason": "Evaluates carotid artery stenosis."}
                ],
                "diet": {"recommended": "DASH Diet, Low-sodium foods", "avoid": "High-saturated fats, excessive sodium"},
                "workout": "Supervised stroke physical rehabilitation",
                "precautions": ["Monitor blood pressure closely", "Assess swallowing reflex"]
            }
        }

        # 2. Build full knowledge index
        for disease_raw in all_diseases:
            norm_key = normalize_disease_name(disease_raw)
            if not norm_key or norm_key in self.knowledge:
                continue

            info = {
                "name": disease_raw,
                "description": "Clinical condition profile sourced from medical knowledge base.",
                "causes": "Physiological and pathophysiological risk factors.",
                "symptoms": "N/A",
                "department": "General Medicine",
                "specialist": "General Physician",
                "risk_level": "Moderate",
                "severity": "Mild",
                "emergency": "0",
                "precautions": ["Rest & maintain hydration", "Follow attending doctor instructions", "Monitor vital signs"],
                "medicines": [],
                "tests": [],
                "diet": {"recommended": "Balanced nutritious diet", "avoid": "Processed and high-sodium foods"},
                "workout": "30-minute daily light walking & stretching"
            }

            # A. Check 05_disease_knowledge_base.csv
            if "kb" in dfs and not dfs["kb"].empty:
                row = dfs["kb"][dfs["kb"]["Disease_Name"].apply(normalize_disease_name) == norm_key]
                if not row.empty:
                    info["name"] = str(row.iloc[0]["Disease_Name"])
                    if "Disease_ID" in row.columns and pd.notna(row.iloc[0]["Disease_ID"]):
                        info["disease_id"] = str(row.iloc[0]["Disease_ID"])
                    if "Description" in row.columns and pd.notna(row.iloc[0]["Description"]) and str(row.iloc[0]["Description"]).strip() != "Requires Clinical Validation":
                        info["description"] = str(row.iloc[0]["Description"])
                    if "Symptoms" in row.columns and pd.notna(row.iloc[0]["Symptoms"]):
                        info["symptoms"] = str(row.iloc[0]["Symptoms"])
                    if "Department" in row.columns and pd.notna(row.iloc[0]["Department"]):
                        info["department"] = str(row.iloc[0]["Department"])
                        info["specialist"] = specialists_map.get(info["department"].lower(), "Specialist")
                    if "Risk_Level" in row.columns and pd.notna(row.iloc[0]["Risk_Level"]):
                        info["risk_level"] = str(row.iloc[0]["Risk_Level"])

                    # Extract precautions from KB row
                    p_list = []
                    for i in range(1, 5):
                        p_col = f"Precaution_{i}"
                        if p_col in row.columns:
                            p_val = row.iloc[0][p_col]
                            if p_val and pd.notna(p_val) and str(p_val).strip() != "" and str(p_val).strip() != "Requires Clinical Validation":
                                p_list.append(str(p_val).strip())
                    if p_list:
                        info["precautions"] = p_list

                    # Extract diet from KB row
                    if "Diet" in row.columns and pd.notna(row.iloc[0]["Diet"]):
                        d_val = str(row.iloc[0]["Diet"]).strip()
                        if d_val and d_val != "Requires Clinical Validation":
                            info["diet"] = {"recommended": d_val, "avoid": "High-sugar, processed foods"}

                    # Extract workout from KB row
                    if "Workouts" in row.columns and pd.notna(row.iloc[0]["Workouts"]):
                        w_val = str(row.iloc[0]["Workouts"]).strip()
                        if w_val and w_val != "Requires Clinical Validation":
                            info["workout"] = w_val

            # B. Check 07_disease_department.csv
            if "dept" in dfs and not dfs["dept"].empty and "norm_disease" in dfs["dept"].columns:
                d_row = dfs["dept"][dfs["dept"]["norm_disease"] == norm_key]
                if not d_row.empty:
                    dept_val = str(d_row.iloc[0]["Department"])
                    if dept_val and dept_val != "Requires Clinical Validation":
                        info["department"] = dept_val
                        info["specialist"] = specialists_map.get(dept_val.lower(), "Specialist")

            # C. Check 09_disease_medicines.csv
            if "meds" in dfs and not dfs["meds"].empty and "norm_disease" in dfs["meds"].columns:
                m_rows = dfs["meds"][dfs["meds"]["norm_disease"] == norm_key]
                meds_list = []
                for _, mr in m_rows.iterrows():
                    med_name = str(mr["Medicine"]).strip()
                    med_type = str(mr.get("Medicine_Type", "Prescription")).strip()
                    if med_name:
                        cat, reas, prio = classify_medicine(med_name, med_type, info["name"])
                        meds_list.append({
                            "name": med_name,
                            "dosage": str(mr.get("Dosage_Notes", "Consult physician dosage guidelines.")),
                            "frequency": "As directed by physician",
                            "duration": "7 days",
                            "notes": str(mr.get("Disclaimer", "Use under clinical supervision.")),
                            "category": cat,
                            "reason": reas,
                            "_priority": prio
                        })

                # Sort by priority (Primary -> Supportive -> Symptomatic)
                meds_list.sort(key=lambda x: x["_priority"])
                for m in meds_list:
                    del m["_priority"]

                if meds_list:
                    info["medicines"] = meds_list

            # D. Check 08_disease_lab_tests.csv
            if "tests" in dfs and not dfs["tests"].empty and "norm_disease" in dfs["tests"].columns:
                t_rows = dfs["tests"][dfs["tests"]["norm_disease"] == norm_key]
                tests_list = []
                for _, tr in t_rows.iterrows():
                    test_name = str(tr["Recommended_Test"]).strip()
                    if test_name:
                        tests_list.append({
                            "name": test_name,
                            "reason": str(tr.get("Validation_Status", "Recommended diagnostic investigation."))
                        })
                if tests_list:
                    info["tests"] = tests_list

            # E. Check 10_disease_precautions.csv
            if "prec" in dfs and not dfs["prec"].empty and "norm_disease" in dfs["prec"].columns:
                p_rows = dfs["prec"][dfs["prec"]["norm_disease"] == norm_key]
                if not p_rows.empty:
                    prec_items = []
                    for i in range(1, 5):
                        p_col = f"Precaution_{i}"
                        if p_col in p_rows.columns:
                            pv = p_rows.iloc[0][p_col]
                            if pd.notna(pv) and str(pv).strip():
                                prec_items.append(str(pv).strip())
                    if prec_items:
                        info["precautions"] = prec_items

            # F. Check 11_disease_diet.csv
            if "diet" in dfs and not dfs["diet"].empty and "norm_disease" in dfs["diet"].columns:
                di_rows = dfs["diet"][dfs["diet"]["norm_disease"] == norm_key]
                if not di_rows.empty:
                    rec_d = str(di_rows.iloc[0].get("Recommended_Diet", "")).strip()
                    av_d = str(di_rows.iloc[0].get("Foods_To_Avoid", "")).strip()
                    if rec_d:
                        info["diet"] = {"recommended": rec_d, "avoid": av_d or "Processed foods"}

            # G. Check 12_disease_workout.csv
            if "workout" in dfs and not dfs["workout"].empty and "norm_disease" in dfs["workout"].columns:
                wo_rows = dfs["workout"][dfs["workout"]["norm_disease"] == norm_key]
                if not wo_rows.empty:
                    w_text = str(wo_rows.iloc[0].get("Workout", "")).strip()
                    if w_text:
                        info["workout"] = w_text

            # H. Check 13_disease_risk.csv
            if "risk" in dfs and not dfs["risk"].empty and "norm_disease" in dfs["risk"].columns:
                rk_rows = dfs["risk"][dfs["risk"]["norm_disease"] == norm_key]
                if not rk_rows.empty:
                    info["risk_level"] = str(rk_rows.iloc[0].get("Risk_Level", info["risk_level"]))

            # FALLBACK ATTACHMENTS FOR CORE DISEASES IF STILL EMPTY
            if not info["medicines"] and norm_key in guideline_fallbacks:
                info["medicines"] = guideline_fallbacks[norm_key]["meds"]
                info["tests"] = guideline_fallbacks[norm_key]["tests"]
                info["diet"] = guideline_fallbacks[norm_key]["diet"]
                info["workout"] = guideline_fallbacks[norm_key]["workout"]
                info["precautions"] = guideline_fallbacks[norm_key]["precautions"]

            self.knowledge[norm_key] = info

        print(f"[DiseaseKnowledge] Successfully indexed {len(self.knowledge)} diseases into knowledge base.")

    def get_disease_info(self, disease_name: str) -> Dict[str, Any]:
        if not disease_name or not str(disease_name).strip():
            return self._get_fallback("General Consultation")

        raw_query = str(disease_name).strip()
        
        # 1. Check ID lookup (e.g. DIS000001)
        if raw_query.lower() in self.disease_id_map:
            norm_key = self.disease_id_map[raw_query.lower()]
            print(f"[DiseaseKnowledge] Resolved Disease ID '{raw_query}' -> '{norm_key}'")
            return self.knowledge[norm_key]

        # 2. Check exact normalized name match
        norm_query = normalize_disease_name(raw_query)
        if norm_query in self.knowledge:
            print(f"[DiseaseKnowledge] Matched disease query '{raw_query}' -> '{norm_query}' ({len(self.knowledge[norm_query]['medicines'])} medicines)")
            return self.knowledge[norm_query]

        # 3. Check partial / substring match
        for key, data in self.knowledge.items():
            if key in norm_query or norm_query in key:
                print(f"[DiseaseKnowledge] Substring matched disease query '{raw_query}' -> '{key}' ({len(data['medicines'])} medicines)")
                return data

        # 4. Return clean fallback without placeholder generic medicines
        print(f"[DiseaseKnowledge] Notice: Unmatched disease query '{raw_query}' (Normalized: '{norm_query}'). Returning clean record without generic placeholders.")
        return self._get_fallback(raw_query)

    def _get_fallback(self, disease_name: str) -> Dict[str, Any]:
        # NO PARACETAMOL OR MULTIVITAMIN PLACEHOLDERS!
        return {
            "name": disease_name,
            "disease_id": "DIS_UNMAPPED",
            "description": f"Clinical condition profile for {disease_name}.",
            "causes": "Physiological and pathophysiological risk factors.",
            "symptoms": "N/A",
            "department": "General Medicine",
            "specialist": "General Physician",
            "risk_level": "Moderate",
            "severity": "Mild",
            "emergency": "0",
            "precautions": ["Rest and maintain hydration", "Follow attending doctor guidance", "Monitor vital signs"],
            "medicines": [], # Zero placeholder medicines!
            "tests": [
                {
                    "name": "Complete Blood Count (CBC)",
                    "reason": "Screens for infection, inflammation, and blood disorders."
                },
                {
                    "name": "Comprehensive Metabolic Panel (CMP)",
                    "reason": "Evaluates kidney, liver, electrolyte, and blood sugar balance."
                }
            ],
            "diet": {"recommended": "Balanced nutritious diet rich in vegetables, lean protein, and whole grains", "avoid": "High-sugar, highly processed foods and alcohol"},
            "workout": "30-minute daily light activity, walking, and gentle stretching"
        }

disease_knowledge_service = DiseaseKnowledgeService()
