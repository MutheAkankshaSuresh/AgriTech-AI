# 🌾 AgriTech AI Platform

AI-powered platform for Seed Quality, Water Intelligence, Precision Farming, and Climate Resilience.

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Docker Desktop installed
- Git

### Run Everything
```bash
git clone <your-repo>
cd agritech

# Train ML models first (optional but recommended)
cd ml
pip install torch torchvision scikit-learn numpy pandas matplotlib joblib
python train_seed_models.py
cd ..

# Copy trained models to backend
mkdir -p backend/ml_models
cp ml/models/* backend/ml_models/

# Start everything
docker-compose up --build
```

### Access
| Service | URL |
|---|---|
| 🖥️ Dashboard | http://localhost:3000 |
| 🔌 API Docs | http://localhost:8000/docs |
| 🍃 MongoDB | localhost:27017 |

### Demo Login
| Role | Email | Password |
|---|---|---|
| Admin | admin@agritech.com | Admin@123 |
| QC Analyst | qc@agritech.com | QC@123 |

---

## 📁 Project Structure

```
agritech/
├── docker-compose.yml          # Runs everything together
│
├── backend/                    # FastAPI Python Backend
│   ├── app/
│   │   ├── main.py             # Entry point
│   │   ├── database.py         # MongoDB connection + seed data
│   │   ├── routes/
│   │   │   ├── auth.py         # Login / JWT
│   │   │   ├── seeds.py        # Seed batch CRUD + predictions
│   │   │   ├── dashboard.py    # Dashboard stats
│   │   │   └── alerts.py       # Alert management
│   │   ├── models/
│   │   │   └── schemas.py      # Pydantic models
│   │   └── services/
│   │       └── ml_service.py   # ML inference service
│   ├── scripts/
│   │   └── mongo-init.js       # MongoDB init + indexes
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   # React Dashboard
│   ├── src/
│   │   ├── App.js              # Complete dashboard UI
│   │   ├── index.js
│   │   └── utils/api.js        # API client
│   ├── public/index.html
│   ├── package.json
│   └── Dockerfile
│
└── ml/                         # Machine Learning
    ├── train_seed_models.py    # Complete training script
    ├── models/                 # Saved model files (after training)
    │   ├── gp_predictor.pth
    │   ├── defect_classifier.pth
    │   ├── feature_scaler.pkl
    │   └── *_metrics.json
    └── data/
        ├── seed_quality_dataset.csv   # Auto-generated
        └── seed_images/               # Synthetic + real images
```

---

## 🤖 ML Models

### Model 1: GP Predictor (Neural Network)
- **Input:** 8 tabular features (moisture, weight, purity, storage conditions, days since harvest, crop type)
- **Output:** Germination Percentage (0-100%)
- **Architecture:** 4-layer MLP with BatchNorm + Dropout
- **Accuracy:** ~2% MAE, ~94% Pass/Fail accuracy

### Model 2: Defect Classifier (CNN)
- **Input:** Seed image (224×224 RGB)
- **Output:** Healthy / Cracked / Discolored / Shriveled
- **Architecture:** 4-block CNN + 3-layer classifier
- **Dataset:** PlantVillage + custom seed images

### Training with Your Own Data

**For GP Predictor (CSV):**
```python
# In train_seed_models.py, replace generate_synthetic_seed_data() with:
df = pd.read_csv('your_lab_data.csv')
# Required columns:
# moisture_percent, thousand_seed_weight_g, physical_purity_percent,
# storage_temperature_c, storage_humidity_percent, days_since_harvest,
# crop_type, actual_gp_percent
```

**For Defect Classifier (Images):**
```
ml/data/seed_images/
├── Healthy/        ← 500+ photos of good seeds
├── Cracked/        ← 500+ photos of cracked seeds  
├── Discolored/     ← 500+ photos of discolored seeds
└── Shriveled/      ← 500+ photos of shriveled seeds
```

---

## 🗄️ MongoDB Collections

| Collection | Purpose |
|---|---|
| `users` | Dashboard users with role-based access |
| `seed_batches` | Seed batch records with AI predictions |
| `seed_images` | Image scan results per batch |
| `farms` | Farm master records |
| `soil_sensor_readings` | Time-series IoT sensor data |
| `irrigation_recommendations` | AI-generated irrigation schedules |
| `crop_health_scans` | Drone/satellite analysis results |
| `yield_predictions` | Seasonal yield forecasts |
| `climate_risk_reports` | District-level climate risk scores |
| `alerts` | Cross-module alert system |

---

## 🔌 API Endpoints

```
POST /api/auth/login              # Get JWT token
GET  /api/seeds/batches           # List all batches
POST /api/seeds/batches           # Create + auto-predict batch
POST /api/seeds/predict           # Predict GP from features
POST /api/seeds/analyze-image     # CNN defect analysis
GET  /api/seeds/stats             # Crop-wise stats
GET  /api/seeds/gp-trend          # GP trend chart data
GET  /api/dashboard/stats         # Summary stats
GET  /api/alerts/                 # Get alerts
PATCH /api/alerts/{id}/resolve    # Resolve an alert
```

Full interactive docs: http://localhost:8000/docs

---

## 📊 Dashboard Pages

| Page | Description |
|---|---|
| Dashboard | KPIs, GP trend chart, batch status pie, crop performance bar |
| Batch Registry | Full table of all batches with GP bars, filters |
| AI Predictor | Tabular prediction form + seed image analysis |
| Alert Center | Real-time alerts with severity levels |
| Water Intelligence | Phase 2 — IoT irrigation scheduling |
| Precision Farming | Phase 2 — NDVI maps, yield prediction |
| Climate Resilience | Phase 2 — Risk scores, seasonal advisory |

---

## 🗺️ Roadmap

- **Phase 1 (Now):** Seed Quality AI — ✅ Complete
- **Phase 2 (Q2 2025):** Water Intelligence + IoT sensors
- **Phase 3 (Q3 2025):** Precision Farming + Drone integration  
- **Phase 4 (Q4 2025):** Climate Resilience + Variety recommender

---

## 📞 Support

Built with FastAPI + React + MongoDB + PyTorch  
Contact your development team to connect real IoT sensors and upload actual seed image datasets.
