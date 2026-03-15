"""
Train a GP predictor for two-chamber IoT seed monitoring.

Usage:
  python ml/train_iot_gp_model.py --data ml/data/chamber_a_gp_training.csv
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset


CROP_ENCODING = {"Cotton": 0, "Bajra": 1, "Tomato": 2, "Brinjal": 3, "Chilli": 4}
REQUIRED_COLUMNS = [
    "temperature_c",
    "humidity_percent",
    "seed_moisture_percent",
    "storage_days",
    "damaged_seeds",
    "color_uniformity",
    "crop_type",
    "actual_gp_percent",
]


class SeedGPPredictor(nn.Module):
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
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.network(x).squeeze(-1) * 100


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["crop_encoded"] = df["crop_type"].map(CROP_ENCODING).fillna(0).astype(float)
    df["interaction"] = (df["seed_moisture_percent"] * df["humidity_percent"]) / 100.0
    return df


def load_or_create_dataset(data_path: Path, rows: int = 3000) -> pd.DataFrame:
    if data_path.exists():
        df = pd.read_csv(data_path)
        missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
        if missing:
            raise ValueError(f"Dataset missing required columns: {missing}")
        return df

    rng = np.random.default_rng(42)
    crops = list(CROP_ENCODING.keys())
    out = []
    for _ in range(rows):
        crop = crops[rng.integers(0, len(crops))]
        temperature_c = float(np.clip(rng.normal(24, 4), 12, 38))
        humidity_percent = float(np.clip(rng.normal(58, 11), 30, 85))
        seed_moisture_percent = float(np.clip(rng.normal(9.7, 1.8), 5, 16))
        storage_days = int(rng.integers(0, 240))
        damaged_seeds = int(rng.integers(0, 8))
        color_uniformity = float(np.clip(rng.normal(84, 8), 50, 100))

        gp = 95.0
        gp -= max(0.0, (temperature_c - 25.0) * 1.8)
        gp -= max(0.0, (humidity_percent - 60.0) * 1.1)
        gp -= max(0.0, (seed_moisture_percent - 10.0) * 3.2)
        gp -= storage_days * 0.07
        gp -= damaged_seeds * 1.8
        gp += (color_uniformity - 80.0) * 0.20
        gp += rng.normal(0.0, 2.2)
        gp = float(np.clip(gp, 30, 99))

        out.append(
            {
                "temperature_c": round(temperature_c, 2),
                "humidity_percent": round(humidity_percent, 2),
                "seed_moisture_percent": round(seed_moisture_percent, 2),
                "storage_days": storage_days,
                "damaged_seeds": damaged_seeds,
                "color_uniformity": round(color_uniformity, 2),
                "crop_type": crop,
                "actual_gp_percent": round(gp, 1),
            }
        )

    df = pd.DataFrame(out)
    data_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(data_path, index=False)
    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default="ml/data/chamber_a_gp_training.csv")
    parser.add_argument("--epochs", type=int, default=60)
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    data_path = root / args.data
    model_dir = root / "ml" / "models"
    model_dir.mkdir(parents=True, exist_ok=True)

    df = load_or_create_dataset(data_path)
    df = build_features(df)

    feature_cols = [
        "seed_moisture_percent",
        "damaged_seeds",
        "color_uniformity",
        "temperature_c",
        "humidity_percent",
        "storage_days",
        "crop_encoded",
        "interaction",
    ]
    target_col = "actual_gp_percent"

    X = df[feature_cols].values.astype(np.float32)
    y = df[target_col].values.astype(np.float32)

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val = scaler.transform(X_val)
    joblib.dump(scaler, model_dir / "feature_scaler.pkl")

    train_loader = DataLoader(TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train)), batch_size=64, shuffle=True)
    val_loader = DataLoader(TensorDataset(torch.FloatTensor(X_val), torch.FloatTensor(y_val)), batch_size=64)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = SeedGPPredictor(input_dim=8).to(device)
    optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-4)
    criterion = nn.MSELoss()
    best_mae = float("inf")

    for epoch in range(args.epochs):
        model.train()
        for xb, yb in train_loader:
            xb = xb.to(device)
            yb = yb.to(device)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()

        model.eval()
        preds, targets = [], []
        with torch.no_grad():
            for xb, yb in val_loader:
                preds.extend(model(xb.to(device)).cpu().numpy())
                targets.extend(yb.numpy())
        mae = mean_absolute_error(targets, preds)
        if mae < best_mae:
            best_mae = mae
            torch.save(model.state_dict(), model_dir / "gp_predictor.pth")

        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch + 1}/{args.epochs} - val_mae={mae:.2f}")

    metrics = {
        "dataset_path": str(data_path),
        "rows": int(len(df)),
        "features": feature_cols,
        "target": target_col,
        "best_val_mae": round(float(best_mae), 3),
    }
    with open(model_dir / "gp_predictor_metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete")
    print(f"Saved: {model_dir / 'gp_predictor.pth'}")
    print(f"Saved: {model_dir / 'feature_scaler.pkl'}")


if __name__ == "__main__":
    main()
