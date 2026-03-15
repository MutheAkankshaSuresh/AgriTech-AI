# Two-Chamber IoT + AI Implementation Guide

This project is now extended for:
- Chamber A: storage monitoring (temperature, humidity, seed moisture)
- Chamber B: germination monitoring (image capture + vision outputs)
- Future germination forecasting (30/90/180 day decay curve)

## 1) Implemented API endpoints

All endpoints are under `/api/seeds`.

- `POST /iot/chamber-a/readings`
  - Save Chamber A reading
  - Auto-runs GP prediction and stores a log
- `GET /iot/chamber-a/latest`
- `GET /iot/chamber-a/history`

- `POST /iot/chamber-b/images`
  - Save Chamber B image metadata
- `GET /iot/chamber-b/latest`
- `GET /iot/chamber-b/history`

- `POST /forecast`
  - Predicts future GP timeline from current storage conditions

Backward compatibility:
- Existing `POST /iot/ingest` is still supported.

## 2) Chamber payloads

### Chamber A payload

```json
{
  "device_id": "seed_box_01",
  "batch_id": "BATCH-2026-001",
  "crop_type": "Cotton",
  "temperature_c": 27.0,
  "humidity_percent": 72.0,
  "seed_moisture_percent": 10.8,
  "storage_days": 20,
  "light_level": 150,
  "co2_ppm": 520,
  "total_seeds": 20,
  "captured_at": "2026-03-10T10:00:00"
}
```

### Chamber B payload

```json
{
  "device_id": "seed_box_01",
  "batch_id": "BATCH-2026-001",
  "image_name": "batch_001_t1.jpg",
  "image_url": "https://your-storage/batch_001_t1.jpg",
  "total_seeds": 20,
  "germinated_seeds": 16,
  "damaged_seeds": 2,
  "mold_presence": false,
  "captured_at": "2026-03-10T10:00:00"
}
```

### Forecast payload

```json
{
  "device_id": "seed_box_01",
  "batch_id": "BATCH-2026-001",
  "crop_type": "Cotton",
  "temperature_c": 27,
  "humidity_percent": 72,
  "seed_moisture_percent": 11,
  "storage_days": 20,
  "damaged_seeds": 3,
  "color_uniformity": 85,
  "forecast_days": [0, 30, 90, 180]
}
```

## 3) Datasets to train AI

Use two datasets:

- `Chamber A GP dataset` (tabular regression)
  - Template: `ml/data_templates/chamber_a_gp_training_template.csv`
  - Target: `actual_gp_percent`

- `Chamber B image label dataset` (vision)
  - Template: `ml/data_templates/chamber_b_image_labels_template.csv`
  - Used with your image files for sprout/damage/mold detection

Recommended minimum:
- 2,000+ tabular rows across crops and storage ranges
- 1,000+ labeled images across time points and defect scenarios

## 4) Features for GP model

Use these input features:
- `temperature_c`
- `humidity_percent`
- `seed_moisture_percent`
- `storage_days`
- `damaged_seeds`
- `color_uniformity`
- `crop_type` (encoded)
- `interaction = seed_moisture_percent * humidity_percent / 100`

Target:
- `actual_gp_percent`

## 5) Train the GP model

Command:

```bash
python ml/train_iot_gp_model.py --data ml/data/chamber_a_gp_training.csv --epochs 60
```

Outputs:
- `ml/models/gp_predictor.pth`
- `ml/models/feature_scaler.pkl`
- `ml/models/gp_predictor_metrics.json`

These are loaded automatically by backend `MLService`.

## 6) Germination percentage formula

`GP = (germinated_seeds / total_seeds) * 100`

Example:
- `germinated_seeds = 16`
- `total_seeds = 20`
- `GP = 80%`

## 7) End-to-end flow

1. ESP32 sends Chamber A reading every 5 minutes.
2. ESP32-CAM sends Chamber B image metadata every 6 hours.
3. FastAPI stores data and runs GP prediction.
4. Forecast API projects GP at future storage days.
5. Dashboard reads stats/history/forecast and displays status + recommendations.
