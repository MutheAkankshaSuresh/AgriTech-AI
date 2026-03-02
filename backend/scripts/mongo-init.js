// AgriTech AI Platform — MongoDB Initialization Script
// Runs automatically on first container startup

db = db.getSiblingDB('agritech_db');

// ── USERS ──────────────────────────────────────────────────────────────────
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

// ── SEED BATCHES ──────────────────────────────────────────────────────────
db.createCollection('seed_batches');
db.seed_batches.createIndex({ batch_id: 1 }, { unique: true });
db.seed_batches.createIndex({ crop_type: 1 });
db.seed_batches.createIndex({ status: 1 });
db.seed_batches.createIndex({ created_at: -1 });
db.seed_batches.createIndex({ "ai_prediction.pass_fail": 1 });

// ── SEED IMAGES ───────────────────────────────────────────────────────────
db.createCollection('seed_images');
db.seed_images.createIndex({ batch_id: 1 });
db.seed_images.createIndex({ captured_at: -1 });

// ── FARMS ─────────────────────────────────────────────────────────────────
db.createCollection('farms');
db.farms.createIndex({ farm_id: 1 }, { unique: true });
db.farms.createIndex({ "location.district": 1 });
db.farms.createIndex({ "location.state": 1 });

// ── SOIL SENSOR READINGS (time-series) ────────────────────────────────────
db.createCollection('soil_sensor_readings');
db.soil_sensor_readings.createIndex({ farm_id: 1, zone_id: 1, timestamp: -1 });
db.soil_sensor_readings.createIndex({ sensor_id: 1 });

// ── IRRIGATION RECOMMENDATIONS ────────────────────────────────────────────
db.createCollection('irrigation_recommendations');
db.irrigation_recommendations.createIndex({ farm_id: 1 });
db.irrigation_recommendations.createIndex({ generated_at: -1 });

// ── CROP HEALTH SCANS ─────────────────────────────────────────────────────
db.createCollection('crop_health_scans');
db.crop_health_scans.createIndex({ farm_id: 1, scan_date: -1 });

// ── YIELD PREDICTIONS ─────────────────────────────────────────────────────
db.createCollection('yield_predictions');
db.yield_predictions.createIndex({ farm_id: 1, season: 1 });

// ── CLIMATE RISK REPORTS ──────────────────────────────────────────────────
db.createCollection('climate_risk_reports');
db.climate_risk_reports.createIndex({ district: 1, state: 1 });
db.climate_risk_reports.createIndex({ generated_date: -1 });

// ── ALERTS ────────────────────────────────────────────────────────────────
db.createCollection('alerts');
db.alerts.createIndex({ status: 1, severity: 1 });
db.alerts.createIndex({ module: 1 });
db.alerts.createIndex({ created_at: -1 });

print('✅ AgriTech DB initialized — all collections and indexes created');
