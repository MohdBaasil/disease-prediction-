import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier

def train_disease_models(data_filepath, saved_model_dir):
    print(f"Loading dataset from {data_filepath}...")
    if not os.path.exists(data_filepath):
        raise FileNotFoundError(f"Dataset not found at {data_filepath}")
        
    df = pd.read_csv(data_filepath)
    
    # Define features
    numerical_features = ["age", "bmi", "blood_glucose", "heart_rate", "temperature", "systolic_bp"]
    symptom_features = [
        "frequent_urination", "increased_thirst", "family_history_diabetes",
        "shortness_of_breath", "wheezing", "chest_tightness", "coughing",
        "throbbing_headache", "nausea", "light_sensitivity", "chest_pain",
        "pain_radiating_arm_jaw", "sweating", "sudden_numbness_weakness",
        "trouble_speaking", "confusion", "drooping_face", "shivering",
        "rapid_breathing"
    ]
    feature_cols = numerical_features + symptom_features
    
    X = df[feature_cols]
    y = df["disease"]
    
    # Target Encoding
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    # Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numerical_features),
            ("sym", "passthrough", symptom_features)
        ]
    )
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    
    os.makedirs(saved_model_dir, exist_ok=True)
    
    # Save the label encoder
    le_save_path = os.path.join(saved_model_dir, "disease_label_encoder.pkl")
    joblib.dump(le, le_save_path)
    print(f"Saved LabelEncoder to {le_save_path}")
    
    # Model 1: Random Forest
    rf_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(n_estimators=150, max_depth=10, random_state=42, n_jobs=-1))
    ])
    print("Training Random Forest Classifier...")
    rf_pipeline.fit(X_train, y_train)
    rf_preds = rf_pipeline.predict(X_test)
    rf_acc = accuracy_score(y_test, rf_preds)
    print(f"Random Forest Accuracy: {rf_acc:.4f}")
    joblib.dump(rf_pipeline, os.path.join(saved_model_dir, "disease_rf.pkl"))
    
    # Model 2: Gradient Boosting
    gb_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42))
    ])
    print("Training Gradient Boosting Classifier...")
    gb_pipeline.fit(X_train, y_train)
    gb_preds = gb_pipeline.predict(X_test)
    gb_acc = accuracy_score(y_test, gb_preds)
    print(f"Gradient Boosting Accuracy: {gb_acc:.4f}")
    joblib.dump(gb_pipeline, os.path.join(saved_model_dir, "disease_gb.pkl"))
    
    # Model 3: XGBoost
    xgb_pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", XGBClassifier(n_estimators=100, max_depth=4, random_state=42, eval_metric='mlogloss'))
    ])
    print("Training XGBoost Classifier...")
    xgb_pipeline.fit(X_train, y_train)
    xgb_preds = xgb_pipeline.predict(X_test)
    xgb_acc = accuracy_score(y_test, xgb_preds)
    print(f"XGBoost Accuracy: {xgb_acc:.4f}")
    joblib.dump(xgb_pipeline, os.path.join(saved_model_dir, "disease_xgb.pkl"))
    
    print("\nComparison and Evaluation Complete.")
    print("Classification report for Ensemble (XGBoost representation):")
    print(classification_report(y_test, xgb_preds, target_names=le.classes_))

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, "dataset", "disease_dataset.csv")
    model_dir = os.path.join(base_dir, "saved_model")
    train_disease_models(data_path, model_dir)
