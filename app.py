from flask import Flask, render_template, request, jsonify
import joblib
import numpy as np
import pandas as pd
import os
import io
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'cardiopredict_group42_secret'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model    = joblib.load(os.path.join(BASE_DIR, 'heart_disease_model.pkl'))
scaler   = joblib.load(os.path.join(BASE_DIR, 'scaler.pkl'))
features = joblib.load(os.path.join(BASE_DIR, 'feature_columns.pkl'))

CONTINUOUS = ['age', 'trestbps', 'chol', 'thalach', 'oldpeak', 'hr_ratio']
prediction_history = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.form
        patient_name = data.get('patient_name', 'Unknown Patient').strip() or 'Unknown Patient'

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

        errors = []
        if not (1 <= age <= 120):     errors.append("Age must be between 1 and 120")
        if not (1 <= trestbps <= 300): errors.append("Resting BP must be between 1 and 300")
        if not (1 <= chol <= 700):    errors.append("Cholesterol must be between 1 and 700")
        if not (1 <= thalach <= 300): errors.append("Max Heart Rate must be between 1 and 300")
        if not (0.0 <= oldpeak <= 10.0): errors.append("ST Depression must be between 0.0 and 10.0")
        if errors: return jsonify({'error': ' | '.join(errors)}), 400

        height = float(data.get('height', 0) or 0)
        weight = float(data.get('weight', 0) or 0)
        bmi = bmi_category = None
        if height > 0 and weight > 0:
            hm = height / 100
            bmi = round(weight / (hm ** 2), 1)
            bmi_category = 'Underweight' if bmi < 18.5 else 'Normal' if bmi < 25 else 'Overweight' if bmi < 30 else 'Obese'

        age_group = 0 if age < 40 else (1 if age <= 55 else 2)
        high_chol = 1 if chol > 240 else 0
        hr_ratio  = thalach / (220 - age)

        raw = pd.DataFrame([[age, sex, cp, trestbps, chol, fbs,
                              restecg, thalach, exang, oldpeak,
                              slope, ca, thal, age_group, high_chol, hr_ratio]], columns=features)
        raw[CONTINUOUS] = scaler.transform(raw[CONTINUOUS])

        pred = model.predict(raw)[0]
        prob = model.predict_proba(raw)[0][1]

        prediction_history.append({
            'id': len(prediction_history) + 1, 'name': patient_name,
            'age': int(age), 'sex': 'Male' if sex == 1 else 'Female',
            'prediction': int(pred), 'probability': round(float(prob) * 100, 1),
            'risk_level': 'HIGH' if pred == 1 else 'LOW',
            'date': datetime.now().strftime('%Y-%m-%d'),
            'time': datetime.now().strftime('%H:%M:%S'),
            'bmi': bmi, 'bmi_category': bmi_category
        })

        return jsonify({
            'prediction': int(pred), 'probability': round(float(prob) * 100, 1),
            'risk_level': 'HIGH' if pred == 1 else 'LOW',
            'patient_name': patient_name, 'bmi': bmi, 'bmi_category': bmi_category
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/bulk-predict', methods=['POST'])
def bulk_predict():
    try:
        if 'csv_file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['csv_file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        if not file.filename.endswith('.csv'):
            return jsonify({'error': 'Please upload a CSV file only'}), 400

        content = file.read().decode('utf-8')
        df = pd.read_csv(io.StringIO(content))

        required_cols = ['age','sex','cp','trestbps','chol','fbs',
                         'restecg','thalach','exang','oldpeak','slope','ca','thal']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return jsonify({'error': f'Missing columns: {", ".join(missing)}'}), 400
        if len(df) == 0:
            return jsonify({'error': 'CSV file is empty'}), 400
        if len(df) > 100:
            return jsonify({'error': 'Maximum 100 patients per upload'}), 400

        results = []
        for idx, row in df.iterrows():
            try:
                age      = float(row['age'])
                sex      = float(row['sex'])
                cp       = float(row['cp'])
                trestbps = float(row['trestbps'])
                chol     = float(row['chol'])
                fbs      = float(row['fbs'])
                restecg  = float(row['restecg'])
                thalach  = float(row['thalach'])
                exang    = float(row['exang'])
                oldpeak  = float(row['oldpeak'])
                slope    = float(row['slope'])
                ca       = float(row['ca'])
                thal     = float(row['thal'])

                patient_name = str(row.get('patient_name', f'Patient {idx+1}')).strip()
                if not patient_name or patient_name == 'nan':
                    patient_name = f'Patient {idx+1}'

                age_group = 0 if age < 40 else (1 if age <= 55 else 2)
                high_chol = 1 if chol > 240 else 0
                hr_ratio  = thalach / (220 - age)

                raw = pd.DataFrame([[age, sex, cp, trestbps, chol, fbs,
                                     restecg, thalach, exang, oldpeak,
                                     slope, ca, thal, age_group, high_chol, hr_ratio]], columns=features)
                raw[CONTINUOUS] = scaler.transform(raw[CONTINUOUS])

                pred = model.predict(raw)[0]
                prob = model.predict_proba(raw)[0][1]

                result = {
                    'row': idx+1, 'patient_name': patient_name,
                    'age': int(age), 'sex': 'Male' if sex == 1 else 'Female',
                    'prediction': int(pred), 'probability': round(float(prob)*100, 1),
                    'risk_level': 'HIGH' if pred == 1 else 'LOW', 'status': 'success'
                }
                prediction_history.append({
                    'id': len(prediction_history)+1, 'name': patient_name,
                    'age': int(age), 'sex': 'Male' if sex == 1 else 'Female',
                    'prediction': int(pred), 'probability': round(float(prob)*100, 1),
                    'risk_level': 'HIGH' if pred == 1 else 'LOW',
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'time': datetime.now().strftime('%H:%M:%S'),
                    'bmi': None, 'bmi_category': None
                })
            except Exception as row_err:
                result = {
                    'row': idx+1, 'patient_name': f'Patient {idx+1}',
                    'age': '-', 'sex': '-', 'prediction': -1,
                    'probability': 0, 'risk_level': 'ERROR',
                    'status': 'error', 'error_msg': str(row_err)
                }
            results.append(result)

        return jsonify({
            'results':     results,
            'total':       len(results),
            'high_count':  sum(1 for r in results if r['risk_level'] == 'HIGH'),
            'low_count':   sum(1 for r in results if r['risk_level'] == 'LOW'),
            'error_count': sum(1 for r in results if r['risk_level'] == 'ERROR')
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/history')
def get_history():
    return jsonify(prediction_history[-10:])

@app.route('/clear-history', methods=['POST'])
def clear_history():
    prediction_history.clear()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)