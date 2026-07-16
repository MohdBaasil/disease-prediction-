import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def train_model(data_filepath, model_save_path):
    print(f"Loading dataset from {data_filepath}...")
    if not os.path.exists(data_filepath):
        raise FileNotFoundError(f"Dataset file not found at {data_filepath}. Please run generate_data.py first.")

    df = pd.read_csv(data_filepath)

    # Features and Target
    feature_cols = [
        "doctor_id",
        "department",
        "day_of_week",
        "time_of_day_minutes",
        "patients_waiting",
        "emergency_patients_waiting",
        "doctor_workload",
        "avg_consultation_time"
    ]
    target_col = "actual_wait_time"

    X = df[feature_cols]
    y = df[target_col]

    # Preprocessing pipeline
    categorical_features = ["doctor_id", "department"]
    numerical_features = [
        "day_of_week",
        "time_of_day_minutes",
        "patients_waiting",
        "emergency_patients_waiting",
        "doctor_workload",
        "avg_consultation_time"
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numerical_features),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features)
        ]
    )

    # Full pipeline with RandomForest model
    model_pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1))
        ]
    )

    # Split train and test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Training Random Forest Regressor model...")
    model_pipeline.fit(X_train, y_train)
    print("Training completed!")

    # Evaluation
    y_pred = model_pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)

    print("\nModel Evaluation Metrics:")
    print(f"Mean Absolute Error (MAE): {mae:.2f} minutes")
    print(f"Root Mean Squared Error (RMSE): {rmse:.2f} minutes")
    print(f"R-squared (R2) Score: {r2:.4f}")

    # Save model
    os.makedirs(os.path.dirname(model_save_path), exist_ok=True)
    joblib.dump(model_pipeline, model_save_path)
    print(f"\nTrained model pipeline saved successfully at: {model_save_path}")

if __name__ == "__main__":
    data_path = "backend/machine_learning/dataset/historical_consultations.csv"
    model_path = "backend/machine_learning/saved_model/model_pipeline.pkl"
    train_model(data_path, model_path)
