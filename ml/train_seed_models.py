"""
Unified training pipeline for AgriTech AI.

Outputs (saved to backend/ml_models):
- gp_model.pth
- cnn_model.pth
- scaler.pkl
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Subset, TensorDataset

from seed_image_dataset import SeedImageDataset


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "ml" / "data"
MODEL_DIR = ROOT_DIR / "backend" / "ml_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CROP_ENCODING = {"Cotton": 0, "Bajra": 1, "Tomato": 2, "Brinjal": 3, "Chilli": 4}
DEFECT_CLASSES = ["Healthy", "Cracked", "Discolored", "Shriveled"]
DEFECT_ENCODING = {name: idx for idx, name in enumerate(DEFECT_CLASSES)}

IMAGE_SIZE = 224
IMAGE_MEAN = [0.485, 0.456, 0.406]
IMAGE_STD = [0.229, 0.224, 0.225]


class SeedGPPredictor(nn.Module):
    def __init__(self, input_dim: int = 8):
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
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.network(x).squeeze(-1) * 100


class SeedDefectCNN(nn.Module):
    def __init__(self, num_classes: int = 4):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(32),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(64),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1),
            nn.ReLU(),
            nn.BatchNorm2d(128),
            nn.MaxPool2d(2),
            nn.Conv2d(128, 256, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(4),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


def build_inference_transform() -> transforms.Compose:
    # This exact preprocessing must match backend inference.
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGE_MEAN, std=IMAGE_STD),
        ]
    )


def build_train_transform() -> transforms.Compose:
    # Training adds augmentation but keeps identical base preprocessing.
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGE_MEAN, std=IMAGE_STD),
        ]
    )


def load_gp_dataframe() -> pd.DataFrame:
    csv_path = DATA_DIR / "seed_quality_dataset.csv"
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        if "crop_encoded" not in df.columns:
            df["crop_encoded"] = df["crop_type"].map(CROP_ENCODING).fillna(0)
        if "interaction" not in df.columns:
            df["interaction"] = df["moisture_percent"] * df["storage_humidity_percent"] / 100.0
        return df

    random.seed(42)
    np.random.seed(42)
    rows = []
    for _ in range(5000):
        crop = random.choice(list(CROP_ENCODING.keys()))
        moisture = float(np.clip(np.random.normal(8.5, 1.5), 5, 15))
        weight = float(np.clip(np.random.normal(110, 20), 60, 180))
        purity = float(np.clip(np.random.normal(98.5, 1.0), 94, 100))
        temp = float(np.clip(np.random.normal(20, 4), 10, 35))
        humidity = float(np.clip(np.random.normal(50, 10), 30, 75))
        days = int(np.random.randint(10, 250))

        gp = 92.0
        gp -= max(0, (moisture - 10) * 4)
        gp -= max(0, (temp - 25) * 2)
        gp -= max(0, (humidity - 60) * 1.5)
        gp -= max(0, (days - 100) * 0.08)
        gp += (purity - 97) * 2
        gp += (weight - 100) * 0.05
        gp += np.random.normal(0, 3)
        gp = float(np.clip(gp, 30, 99))

        rows.append(
            {
                "moisture_percent": round(moisture, 2),
                "thousand_seed_weight_g": round(weight, 2),
                "physical_purity_percent": round(purity, 2),
                "storage_temperature_c": round(temp, 2),
                "storage_humidity_percent": round(humidity, 2),
                "days_since_harvest": days,
                "crop_type": crop,
                "crop_encoded": CROP_ENCODING[crop],
                "interaction": round(moisture * humidity / 100.0, 3),
                "actual_gp_percent": round(gp, 1),
            }
        )

    df = pd.DataFrame(rows)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    return df


def train_gp_model(epochs: int = 80) -> None:
    df = load_gp_dataframe()
    features = [
        "moisture_percent",
        "thousand_seed_weight_g",
        "physical_purity_percent",
        "storage_temperature_c",
        "storage_humidity_percent",
        "days_since_harvest",
        "crop_encoded",
        "interaction",
    ]

    X = df[features].values.astype(np.float32)
    y = df["actual_gp_percent"].values.astype(np.float32)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train).astype(np.float32)
    X_val_scaled = scaler.transform(X_val).astype(np.float32)

    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")

    train_loader = DataLoader(TensorDataset(torch.FloatTensor(X_train_scaled), torch.FloatTensor(y_train)), batch_size=64, shuffle=True)
    val_loader = DataLoader(TensorDataset(torch.FloatTensor(X_val_scaled), torch.FloatTensor(y_val)), batch_size=64)

    model = SeedGPPredictor(input_dim=len(features)).to(DEVICE)
    optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.MSELoss()
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", patience=5, factor=0.5)

    best_mae = float("inf")
    for epoch in range(epochs):
        model.train()
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()

        model.eval()
        preds: List[float] = []
        targets: List[float] = []
        with torch.no_grad():
            for xb, yb in val_loader:
                out = model(xb.to(DEVICE)).cpu().numpy()
                preds.extend(out.tolist())
                targets.extend(yb.numpy().tolist())

        val_mae = mean_absolute_error(targets, preds)
        scheduler.step(val_mae)
        if val_mae < best_mae:
            best_mae = val_mae
            torch.save(model.state_dict(), MODEL_DIR / "gp_model.pth")

        if (epoch + 1) % 10 == 0:
            print(f"[GP] Epoch {epoch + 1}/{epochs} val_mae={val_mae:.3f}")

    metrics = {"best_val_mae": float(best_mae), "features": features}
    with open(MODEL_DIR / "gp_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)


def train_cnn_model(epochs: int = 35, image_root: Path | None = None) -> None:
    image_root = image_root or (DATA_DIR / "seed_images")

    full_dataset = SeedImageDataset(str(image_root), DEFECT_ENCODING, transform=None)
    labels = np.array([lbl for _, lbl in full_dataset.samples])
    indices = np.arange(len(full_dataset))

    train_idx, val_idx = train_test_split(
        indices,
        test_size=0.2,
        random_state=42,
        stratify=labels,
    )

    train_dataset = SeedImageDataset(str(image_root), DEFECT_ENCODING, transform=build_train_transform())
    val_dataset = SeedImageDataset(str(image_root), DEFECT_ENCODING, transform=build_inference_transform())

    train_subset = Subset(train_dataset, train_idx.tolist())
    val_subset = Subset(val_dataset, val_idx.tolist())

    train_loader = DataLoader(train_subset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_subset, batch_size=32, shuffle=False, num_workers=0)

    class_counts = np.bincount(labels[train_idx], minlength=len(DEFECT_CLASSES))
    class_weights = (len(train_idx) / np.maximum(class_counts, 1)).astype(np.float32)

    model = SeedDefectCNN(num_classes=len(DEFECT_CLASSES)).to(DEVICE)
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(class_weights, device=DEVICE))
    optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", patience=4, factor=0.5)

    best_acc = 0.0
    patience = 8
    no_improve = 0

    for epoch in range(epochs):
        model.train()
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()

        model.eval()
        preds: List[int] = []
        targets: List[int] = []
        with torch.no_grad():
            for xb, yb in val_loader:
                logits = model(xb.to(DEVICE))
                pred = torch.argmax(logits, dim=1).cpu().numpy().tolist()
                preds.extend(pred)
                targets.extend(yb.numpy().tolist())

        val_acc = accuracy_score(targets, preds)
        scheduler.step(val_acc)

        if val_acc > best_acc:
            best_acc = val_acc
            no_improve = 0
            torch.save(model.state_dict(), MODEL_DIR / "cnn_model.pth")
        else:
            no_improve += 1

        if (epoch + 1) % 5 == 0:
            print(f"[CNN] Epoch {epoch + 1}/{epochs} val_acc={val_acc:.4f}")

        if no_improve >= patience:
            print(f"[CNN] Early stopping at epoch {epoch + 1}")
            break

    report = classification_report(targets, preds, target_names=DEFECT_CLASSES, output_dict=True)
    with open(MODEL_DIR / "cnn_metrics.json", "w", encoding="utf-8") as f:
        json.dump({"best_val_accuracy": float(best_acc), "report": report}, f, indent=2)


if __name__ == "__main__":
    print(f"Training on device: {DEVICE}")
    print(f"Saving models to: {MODEL_DIR}")

    train_gp_model()
    train_cnn_model()

    print("Training completed")
    print("Saved files:")
    print(f"- {MODEL_DIR / 'gp_model.pth'}")
    print(f"- {MODEL_DIR / 'cnn_model.pth'}")
    print(f"- {MODEL_DIR / 'scaler.pkl'}")
