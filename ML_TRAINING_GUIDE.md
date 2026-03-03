# 🧠 AgriTech AI - Complete ML Training Guide

## 📊 Project Overview

Your AgriTech platform has **3 ML models** for seed quality prediction:

### Model 1: GP Predictor (Germination Percentage)
- **Type:** Neural Network (MLP)
- **Input:** 8 tabular features
- **Output:** Germination % (0-100)
- **File:** `ml/models/gp_predictor.pth`

### Model 2: Defect Classifier (Image-based)
- **Type:** CNN (Convolutional Neural Network)
- **Input:** Seed images (224x224)
- **Output:** Healthy/Cracked/Discolored/Shriveled
- **File:** `ml/models/defect_classifier.pth`

### Model 3: YOLOv8 Object Detection
- **Type:** YOLO (You Only Look Once)
- **Input:** Seed images
- **Output:** Bounding boxes + defect detection
- **File:** `ml/models/best.pt` or `backend/ml_models/best.pt`

---

## 🎯 Current Status & What You Need

### ✅ What You Have:
- `best.pt` - YOLOv8 trained model
- Basic training script: `ml/train_seed_models.py`
- Backend inference: `backend/inference.py`

### ❌ What's Missing for Production:
1. **Real seed quality dataset** (currently using synthetic data)
2. **Proper data collection pipeline**
3. **Model validation on real data**
4. **Hyperparameter tuning**

---

## 📁 Required Dataset Structure

### For GP Predictor (CSV Data):
```
ml/data/seed_quality_dataset.csv

Required columns:
- moisture_percent (float)
- thousand_seed_weight_g (float)
- physical_purity_percent (float)
- storage_temperature_c (float)
- storage_humidity_percent (float)
- days_since_harvest (int)
- crop_type (string: Cotton/Bajra/Tomato/Brinjal/Chilli)
- actual_gp_percent (float) ← TARGET VARIABLE
```

**Minimum:** 1000+ samples for good accuracy
**Recommended:** 5000+ samples

### For Defect Classifier (Images):
```
ml/data/seed_images/
├── Healthy/        ← 500+ images of healthy seeds
├── Cracked/        ← 500+ images of cracked seeds
├── Discolored/     ← 500+ images of discolored seeds
└── Shriveled/      ← 500+ images of shriveled seeds
```

**Image specs:**
- Format: JPG/PNG
- Size: 224x224 pixels (will be auto-resized)
- Quality: Clear, well-lit photos
- Background: Plain/uniform

### For YOLOv8 (Object Detection):
```
ml/dataset/
├── images/
│   ├── train/      ← 80% of images
│   └── val/        ← 20% of images
└── labels/
    ├── train/      ← YOLO format labels
    └── val/        ← YOLO format labels
```

**YOLO label format (one .txt per image):**
```
class_id x_center y_center width height
0 0.5 0.5 0.3 0.3
```

---

## 🚀 Step-by-Step Training Guide

### Step 1: Collect Real Data

#### Option A: Use Existing Lab Data
If you have seed testing lab data:
1. Export to CSV with required columns
2. Place in `ml/data/seed_quality_dataset.csv`

#### Option B: Generate Synthetic Data (for testing)
```bash
cd ml
python train_seed_models.py
# This generates synthetic data automatically
```

#### Option C: Collect Seed Images
1. Take photos of seeds under consistent lighting
2. Organize into folders by defect type
3. Minimum 500 images per class

---

### Step 2: Install Dependencies

```bash
cd ml
pip install torch torchvision scikit-learn numpy pandas matplotlib joblib ultralytics opencv-python
```

---

### Step 3: Train GP Predictor (Tabular Model)

```bash
cd ml
python train_seed_models.py
```

**What it does:**
- Loads CSV data
- Trains neural network
- Saves model to `ml/models/gp_predictor.pth`
- Saves scaler to `ml/models/feature_scaler.pkl`
- Saves metrics to `ml/models/gp_predictor_metrics.json`

**Expected accuracy:** 90-95% (with real data)

---

### Step 4: Train Defect Classifier (CNN)

The same script trains both models:
```bash
python train_seed_models.py
```

**What it does:**
- Loads images from `ml/data/seed_images/`
- Trains CNN
- Saves model to `ml/models/defect_classifier.pth`
- Saves metrics to `ml/models/defect_classifier_metrics.json`

**Expected accuracy:** 85-95% (with real images)

---

### Step 5: Train YOLOv8 (Object Detection)

Create `ml/train_yolo.py`:

```python
from ultralytics import YOLO

# Load pretrained model
model = YOLO('yolov8n.pt')

# Train
results = model.train(
    data='data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    name='seed_detection',
    patience=20,
    save=True,
    device='cuda' if torch.cuda.is_available() else 'cpu'
)

# Save best model
model.save('models/best.pt')
```

Run training:
```bash
python train_yolo.py
```

**Expected mAP:** 0.7-0.9 (with good dataset)

---

## 🔧 Improve Model Accuracy

### 1. Data Quality (Most Important!)
- ✅ Collect more real data (5000+ samples)
- ✅ Balance classes (equal samples per defect type)
- ✅ Clean data (remove outliers, fix errors)
- ✅ Augment images (rotation, flip, brightness)

### 2. Hyperparameter Tuning

Edit `ml/train_seed_models.py`:

```python
# For GP Predictor
model = GPPredictor(
    input_size=8,
    hidden_sizes=[128, 256, 128],  # Try [256, 512, 256]
    dropout=0.3  # Try 0.2 or 0.4
)

# Training params
epochs = 200  # Try 300-500
learning_rate = 0.001  # Try 0.0001 or 0.01
batch_size = 32  # Try 64 or 128
```

### 3. Use Better Architecture

For defect classifier, try ResNet or EfficientNet:
```python
import torchvision.models as models

model = models.resnet50(pretrained=True)
model.fc = nn.Linear(2048, 4)  # 4 classes
```

### 4. Cross-Validation

Add k-fold validation to `train_seed_models.py`:
```python
from sklearn.model_selection import KFold

kfold = KFold(n_splits=5, shuffle=True)
for fold, (train_idx, val_idx) in enumerate(kfold.split(X)):
    # Train on train_idx, validate on val_idx
    pass
```

---

## 📊 Evaluate Model Performance

After training, check metrics:

```bash
# View GP Predictor metrics
cat ml/models/gp_predictor_metrics.json

# View Defect Classifier metrics
cat ml/models/defect_classifier_metrics.json
```

**Good metrics:**
- GP Predictor: MAE < 3%, R² > 0.90
- Defect Classifier: Accuracy > 90%
- YOLOv8: mAP > 0.75

---

## 🔄 Deploy Trained Models

### Step 1: Copy models to backend
```bash
# Copy all models
cp ml/models/*.pth backend/ml_models/
cp ml/models/*.pkl backend/ml_models/
cp ml/models/best.pt backend/ml_models/
```

### Step 2: Restart Docker
```bash
docker-compose restart backend
```

### Step 3: Test predictions
```bash
# Test via API
curl -X POST http://localhost:8000/api/seeds/predict \
  -H "Content-Type: application/json" \
  -d '{
    "crop_type": "Cotton",
    "moisture_percent": 8.5,
    "thousand_seed_weight_g": 45.2,
    "physical_purity_percent": 98.5,
    "storage_temperature_c": 20,
    "storage_humidity_percent": 60,
    "days_since_harvest": 30
  }'
```

---

## 🎓 Best Practices for Production

### 1. Data Collection Strategy
- Collect data from multiple seed testing labs
- Include seasonal variations
- Cover all crop types
- Document data collection process

### 2. Model Versioning
```
ml/models/
├── v1.0/
│   ├── gp_predictor.pth
│   └── defect_classifier.pth
├── v1.1/
│   └── ...
└── production/  ← Symlink to best version
```

### 3. Continuous Training
- Retrain monthly with new data
- A/B test new models vs old
- Monitor prediction accuracy in production

### 4. Model Monitoring
- Log all predictions
- Track accuracy over time
- Alert if accuracy drops

---

## 🐛 Troubleshooting

### Issue: Low Accuracy
**Solution:**
- Collect more data (5000+ samples)
- Balance classes
- Try different architectures
- Increase training epochs

### Issue: Overfitting
**Solution:**
- Add more dropout (0.4-0.5)
- Use data augmentation
- Reduce model complexity
- Add L2 regularization

### Issue: Model not loading
**Solution:**
```bash
# Check model files exist
ls -lh ml/models/
ls -lh backend/ml_models/

# Retrain if corrupted
cd ml
python train_seed_models.py
```

---

## 📞 Next Steps

1. **Collect Real Data** - Most important!
2. **Train with real data** - Run `train_seed_models.py`
3. **Evaluate accuracy** - Check metrics files
4. **Deploy to backend** - Copy models
5. **Test in production** - Use dashboard
6. **Monitor & improve** - Retrain regularly

---

## 🎯 Summary

**Current Setup:**
- ✅ YOLOv8 model (`best.pt`) - Ready
- ⚠️ GP Predictor - Needs real data
- ⚠️ Defect Classifier - Needs real images

**To Get Production-Ready:**
1. Collect 5000+ real seed quality records (CSV)
2. Collect 2000+ seed images (500 per class)
3. Retrain all models with real data
4. Validate accuracy > 90%
5. Deploy to production

**Your `best.pt` file is good for YOLOv8, but you need real data for the other two models!**
