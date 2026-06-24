from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import pandas as pd
import os

app = Flask(__name__)

# ── Load model, scaler, and feature columns ───────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model    = joblib.load(os.path.join(BASE_DIR, 'heart_disease_model.pkl'))
scaler   = joblib.load(os.path.join(BASE_DIR, 'scaler.pkl'))
features = joblib.load(os.path.join(BASE_DIR, 'feature_columns.pkl'))

CONTINUOUS = ['age', 'trestbps', 'chol', 'thalach', 'oldpeak', 'hr_ratio']

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.form

        age      = float(data['age'])
        sex      = float(data['sex'])
        cp       = float(data['cp'])
        trestbps = float(data['trestbps'])
        chol     = float(data['chol'])
        fbs      = float(data['fbs'])
        restecg  = float(data['restecg'])
        thalach  = float(data['thalach'])
        exang    = float(data['exang'])
        oldpeak  = float(data['oldpeak'])
        slope    = float(data['slope'])
        ca       = float(data['ca'])
        thal     = float(data['thal'])

        # ── Feature engineering (must match notebook) ────────────────────────
        age_group = 0 if age < 40 else (1 if age <= 55 else 2)
        high_chol = 1 if chol > 240 else 0
        hr_ratio  = thalach / (220 - age)

        raw = pd.DataFrame([[
            age, sex, cp, trestbps, chol, fbs,
            restecg, thalach, exang, oldpeak,
            slope, ca, thal, age_group, high_chol, hr_ratio
        ]], columns=features)

        # ── Scale continuous features ─────────────────────────────────────────
        raw[CONTINUOUS] = scaler.transform(raw[CONTINUOUS])

        # ── Predict ───────────────────────────────────────────────────────────
        pred = model.predict(raw)[0]
        prob = model.predict_proba(raw)[0][1]

        return jsonify({
            'prediction': int(pred),
            'probability': round(float(prob) * 100, 1),
            'risk_level': 'HIGH' if pred == 1 else 'LOW'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
