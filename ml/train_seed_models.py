"""
AgriTech AI - Seed Quality Model Training Script
================================================
Trains two models:
1. GP Predictor (Neural Network) - predicts Germination Percentage from tabular features
2. Defect Classifier (CNN) - classifies seed defects from images

Run: python train_seed_models.py
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset, Dataset
import torchvision.transforms as transforms
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, accuracy_score, classification_report
import joblib
import os
import json
from pathlib import Path
from PIL import Image, ImageDraw
import random
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
MODELS_DIR = Path("../ml/models")
DATA_DIR = Path("../ml/data")
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"🔧 Using device: {DEVICE}")

CROP_ENCODING = {"Cotton": 0, "Bajra": 1, "Tomato": 2, "Brinjal": 3, "Chilli": 4}
DEFECT_CLASSES = ["Healthy", "Cracked", "Discolored", "Shriveled"]
DEFECT_ENCODING = {cls: i for i, cls in enumerate(DEFECT_CLASSES)}

# ─────────────────────────────────────────────
# STEP 1: GENERATE / LOAD TRAINING DATA
# ─────────────────────────────────────────────

def generate_synthetic_seed_data(n_samples=5000):
    """
    Generate synthetic seed quality dataset.
    In production: replace with your actual lab data CSV.

    Expected CSV columns:
    moisture_percent, thousand_seed_weight_g, physical_purity_percent,
    storage_temperature_c, storage_humidity_percent, days_since_harvest,
    crop_type, interaction_feature, actual_gp_percent, defect_class
    """
    print(f"\n📊 Generating {n_samples} synthetic seed samples...")

    np.random.seed(42)
    random.seed(42)

    data = []
    for _ in range(n_samples):
        crop = random.choice(list(CROP_ENCODING.keys()))
        moisture = np.random.normal(8.5, 1.5)
        moisture = np.clip(moisture, 5, 15)
        weight = np.random.normal(110, 20)
        weight = np.clip(weight, 60, 180)
        purity = np.random.normal(98.5, 1.0)
        purity = np.clip(purity, 94, 100)
        temp = np.random.normal(20, 4)
        temp = np.clip(temp, 10, 35)
        humidity = np.random.normal(50, 10)
        humidity = np.clip(humidity, 30, 75)
        days = np.random.randint(10, 250)

        # Physics-based GP formula (matches real-world patterns)
        base_gp = 92
        base_gp -= max(0, (moisture - 10) * 4)      # high moisture hurts GP
        base_gp -= max(0, (temp - 25) * 2)           # high temp hurts
        base_gp -= max(0, (humidity - 60) * 1.5)     # high humidity hurts
        base_gp -= max(0, (days - 100) * 0.08)       # aging hurts
        base_gp += (purity - 97) * 2                  # purity helps
        base_gp += (weight - 100) * 0.05              # heavier seeds slightly better
        base_gp += np.random.normal(0, 3)             # natural variance

        gp = np.clip(base_gp, 30, 99)

        # Defect class correlation with GP
        if gp >= 85:
            defect = np.random.choice(DEFECT_CLASSES, p=[0.85, 0.05, 0.06, 0.04])
        elif gp >= 70:
            defect = np.random.choice(DEFECT_CLASSES, p=[0.55, 0.20, 0.15, 0.10])
        else:
            defect = np.random.choice(DEFECT_CLASSES, p=[0.10, 0.35, 0.30, 0.25])

        data.append({
            "moisture_percent": round(moisture, 2),
            "thousand_seed_weight_g": round(weight, 2),
            "physical_purity_percent": round(purity, 2),
            "storage_temperature_c": round(temp, 2),
            "storage_humidity_percent": round(humidity, 2),
            "days_since_harvest": days,
            "crop_type": crop,
            "crop_encoded": CROP_ENCODING[crop],
            "interaction": round(moisture * humidity / 100, 3),
            "actual_gp_percent": round(gp, 1),
            "defect_class": defect,
            "defect_encoded": DEFECT_ENCODING[defect]
        })

    df = pd.DataFrame(data)
    csv_path = DATA_DIR / "seed_quality_dataset.csv"
    df.to_csv(csv_path, index=False)
    print(f"✅ Dataset saved to {csv_path}")
    print(f"   GP Distribution: Mean={df['actual_gp_percent'].mean():.1f}%, Std={df['actual_gp_percent'].std():.1f}%")
    print(f"   Pass rate (GP≥70): {(df['actual_gp_percent'] >= 70).mean()*100:.1f}%")
    print(f"   Defect distribution: {df['defect_class'].value_counts().to_dict()}")
    return df


def load_data():
    csv_path = DATA_DIR / "seed_quality_dataset.csv"
    if csv_path.exists():
        print(f"\n📂 Loading existing dataset from {csv_path}")
        return pd.read_csv(csv_path)
    else:
        return generate_synthetic_seed_data()


# ─────────────────────────────────────────────
# STEP 2: MODEL DEFINITIONS
# ─────────────────────────────────────────────

class SeedGPPredictor(nn.Module):
    """Neural Network: Tabular features → GP Percentage"""
    def __init__(self, input_dim=8):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.BatchNorm1d(128),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.BatchNorm1d(64),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.network(x).squeeze(-1) * 100


class SeedDefectClassifier(nn.Module):
    """CNN: Seed image → Defect class"""
    def __init__(self, num_classes=4):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.ReLU(), nn.BatchNorm2d(32), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.BatchNorm2d(64), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(), nn.BatchNorm2d(128), nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1), nn.ReLU(), nn.AdaptiveAvgPool2d(4)
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512), nn.ReLU(), nn.Dropout(0.5),
            nn.Linear(512, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        return self.classifier(self.features(x))


# ─────────────────────────────────────────────
# STEP 3: TRAIN GP PREDICTOR
# ─────────────────────────────────────────────

def train_gp_predictor(df):
    print("\n" + "="*60)
    print("🌱 TRAINING GP PREDICTOR MODEL")
    print("="*60)

    FEATURES = ["moisture_percent", "thousand_seed_weight_g", "physical_purity_percent",
                "storage_temperature_c", "storage_humidity_percent", "days_since_harvest",
                "crop_encoded", "interaction"]
    TARGET = "actual_gp_percent"

    X = df[FEATURES].values.astype(np.float32)
    y = df[TARGET].values.astype(np.float32)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    joblib.dump(scaler, MODELS_DIR / "feature_scaler.pkl")
    print("✅ Feature scaler saved")

    train_ds = TensorDataset(torch.FloatTensor(X_train_scaled), torch.FloatTensor(y_train))
    val_ds = TensorDataset(torch.FloatTensor(X_val_scaled), torch.FloatTensor(y_val))
    train_loader = DataLoader(train_ds, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=64)

    model = SeedGPPredictor(input_dim=len(FEATURES)).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-4)
    criterion = nn.MSELoss()
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    EPOCHS = 80
    best_val_mae = float("inf")
    train_losses, val_maes = [], []

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for xb, yb in val_loader:
                xb = xb.to(DEVICE)
                pred = model(xb).cpu().numpy()
                val_preds.extend(pred)
                val_targets.extend(yb.numpy())

        val_mae = mean_absolute_error(val_targets, val_preds)
        train_losses.append(total_loss / len(train_loader))
        val_maes.append(val_mae)
        scheduler.step(val_mae)

        if val_mae < best_val_mae:
            best_val_mae = val_mae
            torch.save(model.state_dict(), MODELS_DIR / "gp_predictor.pth")

        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch+1:3d}/{EPOCHS} | Loss: {train_losses[-1]:.4f} | Val MAE: {val_mae:.2f}%")

    print(f"\n✅ GP Predictor Training Complete!")
    print(f"   Best Validation MAE: {best_val_mae:.2f}% GP")

    # Pass/Fail accuracy
    preds_arr = np.array(val_preds)
    targets_arr = np.array(val_targets)
    pred_labels = (preds_arr >= 70).astype(int)
    true_labels = (targets_arr >= 70).astype(int)
    acc = accuracy_score(true_labels, pred_labels)
    print(f"   Pass/Fail Classification Accuracy: {acc*100:.1f}%")

    # Save training metrics
    metrics = {
        "best_val_mae": float(best_val_mae),
        "pass_fail_accuracy": float(acc),
        "features": FEATURES,
        "epochs": EPOCHS
    }
    with open(MODELS_DIR / "gp_predictor_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    return model, scaler, train_losses, val_maes


# ─────────────────────────────────────────────
# STEP 4: SYNTHETIC IMAGE GENERATION
# ─────────────────────────────────────────────

def generate_synthetic_seed_images(n_per_class=200):
    """Generate synthetic seed images for training CNN"""
    images_dir = DATA_DIR / "seed_images"
    for cls in DEFECT_CLASSES:
        (images_dir / cls).mkdir(parents=True, exist_ok=True)

    print(f"\n🖼️  Generating synthetic seed images ({n_per_class} per class)...")

    def draw_seed(defect_class):
        img = Image.new("RGB", (224, 224), color=(200 + random.randint(0, 55),
                                                   180 + random.randint(0, 40),
                                                   140 + random.randint(0, 40)))
        draw = ImageDraw.Draw(img)

        cx, cy = 112 + random.randint(-10, 10), 112 + random.randint(-10, 10)
        w = random.randint(60, 80)
        h = random.randint(35, 50)

        if defect_class == "Healthy":
            color = (139 + random.randint(-20, 20), 105 + random.randint(-20, 20), 20 + random.randint(-10, 10))
            draw.ellipse([cx-w, cy-h, cx+w, cy+h], fill=color, outline=(100, 75, 5), width=2)

        elif defect_class == "Cracked":
            color = (120 + random.randint(-20, 20), 90 + random.randint(-20, 20), 30)
            draw.ellipse([cx-w, cy-h, cx+w, cy+h], fill=color, outline=(80, 60, 10), width=2)
            for _ in range(random.randint(2, 5)):
                x1 = cx + random.randint(-w//2, w//2)
                y1 = cy + random.randint(-h//2, h//2)
                x2 = x1 + random.randint(-20, 20)
                y2 = y1 + random.randint(-20, 20)
                draw.line([x1, y1, x2, y2], fill=(40, 30, 5), width=2)

        elif defect_class == "Discolored":
            color = (100 + random.randint(0, 80), 60 + random.randint(0, 40), 10 + random.randint(0, 30))
            draw.ellipse([cx-w, cy-h, cx+w, cy+h], fill=color, outline=(60, 40, 5), width=2)
            for _ in range(random.randint(3, 8)):
                sx = cx + random.randint(-w//2, w//2)
                sy = cy + random.randint(-h//2, h//2)
                spot_color = (random.randint(150, 200), random.randint(50, 100), random.randint(10, 30))
                draw.ellipse([sx-5, sy-5, sx+5, sy+5], fill=spot_color)

        elif defect_class == "Shriveled":
            color = (110 + random.randint(-15, 15), 85 + random.randint(-15, 15), 20)
            w_s, h_s = int(w * 0.6), int(h * 0.6)
            draw.ellipse([cx-w_s, cy-h_s, cx+w_s, cy+h_s], fill=color, outline=(80, 60, 10), width=2)
            for _ in range(5):
                x1 = cx + random.randint(-w_s, w_s)
                draw.line([x1, cy-h_s, x1+random.randint(-5, 5), cy+h_s],
                         fill=(90, 70, 15), width=1)

        # Add noise
        noise = np.random.randint(0, 25, (224, 224, 3), dtype=np.uint8)
        img_arr = np.array(img) + noise
        img_arr = np.clip(img_arr, 0, 255).astype(np.uint8)
        return Image.fromarray(img_arr)

    for cls in DEFECT_CLASSES:
        for i in range(n_per_class):
            img = draw_seed(cls)
            img.save(images_dir / cls / f"{cls.lower()}_{i:04d}.png")

    print(f"✅ Synthetic images generated at {images_dir}")
    return images_dir


class SeedImageDataset(Dataset):
    def __init__(self, image_paths, labels, transform=None):
        self.image_paths = image_paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img = Image.open(self.image_paths[idx]).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, self.labels[idx]


# ─────────────────────────────────────────────
# STEP 5: TRAIN DEFECT CLASSIFIER
# ─────────────────────────────────────────────

def train_defect_classifier(images_dir):
    print("\n" + "="*60)
    print("🔬 TRAINING SEED DEFECT CLASSIFIER (CNN)")
    print("="*60)

    transform_train = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(30),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    transform_val = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    all_paths, all_labels = [], []
    for cls, idx in DEFECT_ENCODING.items():
        cls_dir = images_dir / cls
        if cls_dir.exists():
            for img_path in cls_dir.glob("*.png"):
                all_paths.append(str(img_path))
                all_labels.append(idx)

    if len(all_paths) == 0:
        print("❌ No images found. Generating synthetic images first...")
        images_dir = generate_synthetic_seed_images(200)
        return train_defect_classifier(images_dir)

    print(f"   Total images: {len(all_paths)}")
    indices = list(range(len(all_paths)))
    random.shuffle(indices)
    split = int(0.8 * len(indices))
    train_idx, val_idx = indices[:split], indices[split:]

    train_ds = SeedImageDataset([all_paths[i] for i in train_idx], [all_labels[i] for i in train_idx], transform_train)
    val_ds = SeedImageDataset([all_paths[i] for i in val_idx], [all_labels[i] for i in val_idx], transform_val)
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=32, num_workers=0)

    model = SeedDefectClassifier(num_classes=len(DEFECT_CLASSES)).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

    EPOCHS = 30
    best_acc = 0
    all_train_acc, all_val_acc = [], []

    for epoch in range(EPOCHS):
        model.train()
        correct = total = 0
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            out = model(xb)
            loss = criterion(out, yb)
            loss.backward()
            optimizer.step()
            correct += (out.argmax(1) == yb).sum().item()
            total += len(yb)
        train_acc = correct / total

        model.eval()
        val_preds, val_true = [], []
        with torch.no_grad():
            for xb, yb in val_loader:
                xb = xb.to(DEVICE)
                out = model(xb)
                val_preds.extend(out.argmax(1).cpu().numpy())
                val_true.extend(yb.numpy())

        val_acc = accuracy_score(val_true, val_preds)
        all_train_acc.append(train_acc)
        all_val_acc.append(val_acc)
        scheduler.step()

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), MODELS_DIR / "defect_classifier.pth")

        if (epoch + 1) % 5 == 0:
            print(f"  Epoch {epoch+1:3d}/{EPOCHS} | Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}%")

    print(f"\n✅ Defect Classifier Training Complete!")
    print(f"   Best Validation Accuracy: {best_acc*100:.1f}%")
    print(f"\n   Classification Report:")
    print(classification_report(val_true, val_preds, target_names=DEFECT_CLASSES))

    metrics = {"best_val_accuracy": float(best_acc), "classes": DEFECT_CLASSES, "epochs": EPOCHS}
    with open(MODELS_DIR / "defect_classifier_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    return model, all_train_acc, all_val_acc


# ─────────────────────────────────────────────
# STEP 6: MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("🌾 AgriTech AI — Seed Quality Model Training")
    print("=" * 60)

    df = load_data()
    gp_model, scaler, gp_losses, gp_maes = train_gp_predictor(df)

    images_dir = DATA_DIR / "seed_images"
    if not images_dir.exists() or len(list(images_dir.rglob("*.png"))) < 100:
        images_dir = generate_synthetic_seed_images(n_per_class=300)

    cnn_model, cnn_train_acc, cnn_val_acc = train_defect_classifier(images_dir)

    print("\n" + "="*60)
    print("🎉 ALL MODELS TRAINED SUCCESSFULLY!")
    print("="*60)
    print(f"   📁 Models saved to: {MODELS_DIR.resolve()}")
    print(f"   📄 Files created:")
    for f in MODELS_DIR.iterdir():
        print(f"      - {f.name}")
    print("\n💡 Next steps:")
    print("   1. Copy models/ folder to backend/ml_models/")
    print("   2. Run: docker-compose up --build")
    print("   3. Open http://localhost:3000")
    print("\n📌 To use your own data:")
    print("   - Replace generate_synthetic_seed_data() with your CSV file")
    print("   - Replace generate_synthetic_seed_images() with real seed photos")
    print("   - Re-run this script")
