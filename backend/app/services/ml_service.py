import numpy as np
import joblib
import os
from pathlib import Path
from typing import List
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image
import io

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None


class SeedGPPredictor(nn.Module):
    """Neural network for GP prediction from tabular features."""

    def __init__(self, input_dim=8):
        super().__init__()
        # Matches the saved checkpoint in ml/models/gp_predictor.pth
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
        return self.network(x) * 100


class SeedDefectCNN(nn.Module):
    """CNN for seed image defect classification."""

    def __init__(self, num_classes=4):
        super().__init__()
        # Matches the saved checkpoint in ml/models/defect_classifier.pth
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


class MLService:
    def __init__(self):
        env_path = os.getenv("ML_MODELS_PATH")
        if env_path:
            self.models_path = Path(env_path)
        else:
            preferred = Path("backend/ml_models")
            self.models_path = preferred if preferred.exists() else Path("./ml_models")
        self.gp_model = None
        self.defect_model = None
        self.seed_model_yolo = None
        self.scaler = None
        self.defect_classes = ["Healthy", "Cracked", "Discolored", "Shriveled"]
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.crop_encoding = {"Cotton": 0, "Bajra": 1, "Tomato": 2, "Brinjal": 3, "Chilli": 4}

        self.image_size = 224
        self.image_mean = [0.485, 0.456, 0.406]
        self.image_std = [0.229, 0.224, 0.225]
        self.transform = transforms.Compose(
            [
                transforms.Resize((self.image_size, self.image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.image_mean, std=self.image_std),
            ]
        )

    def _build_feature_vector(self, features: dict) -> np.ndarray:
        crop_enc = self.crop_encoding.get(features.get("crop_type", "Cotton"), 0)
        raw = np.array(
            [
                [
                    features.get("moisture_percent", 8.0),
                    features.get("thousand_seed_weight_g", 100.0),
                    features.get("physical_purity_percent", 98.0),
                    features.get("storage_temperature_c", 20.0),
                    features.get("storage_humidity_percent", 50.0),
                    features.get("days_since_harvest", 30),
                    crop_enc,
                    features.get("moisture_percent", 8.0)
                    * features.get("storage_humidity_percent", 50.0)
                    / 100,
                ]
            ],
            dtype=np.float32,
        )
        if self.scaler is not None and hasattr(self.scaler, "mean_"):
            try:
                return self.scaler.transform(raw).astype(np.float32)
            except Exception:
                return raw
        return raw

    async def load_models(self):
        """Load GP, CNN, YOLO models independently so one failure does not break others."""
        gp_path = self.models_path / "gp_model.pth"
        self.gp_model = SeedGPPredictor(input_dim=8)
        try:
            if gp_path.exists():
                self.gp_model.load_state_dict(torch.load(gp_path, map_location=self.device))
                print("GP Predictor loaded")
            else:
                print("GP model not found, using default untrained model")
        except Exception as e:
            print(f"GP model load failed, using untrained model: {e}")
        self.gp_model.to(self.device).eval()

        defect_path = self.models_path / "cnn_model.pth"
        self.defect_model = SeedDefectCNN(num_classes=4)
        try:
            if defect_path.exists():
                self.defect_model.load_state_dict(torch.load(defect_path, map_location=self.device))
                print("CNN Defect Classifier loaded")
            else:
                print("CNN model not found, using default untrained model")
        except Exception as e:
            print(f"CNN model load failed, using untrained model: {e}")
        self.defect_model.to(self.device).eval()

        scaler_path = self.models_path / "scaler.pkl"
        try:
            if scaler_path.exists():
                self.scaler = joblib.load(scaler_path)
            else:
                from sklearn.preprocessing import StandardScaler

                self.scaler = StandardScaler()
        except Exception as e:
            print(f"Scaler load failed: {e}")
            from sklearn.preprocessing import StandardScaler

            self.scaler = StandardScaler()

        yolo_path = self.models_path / "best.pt"
        try:
            if yolo_path.exists() and YOLO is not None:
                self.seed_model_yolo = YOLO(str(yolo_path))
                print(f"YOLO model loaded from {yolo_path}")
            elif yolo_path.exists() and YOLO is None:
                print("ultralytics not installed; YOLO disabled")
            else:
                print(f"YOLO best.pt not found in {yolo_path}")
        except Exception as e:
            print(f"YOLO model load failed: {e}")

    def predict_gp(self, features: dict) -> dict:
        try:
            feature_vector = self._build_feature_vector(features)

            with torch.no_grad():
                tensor = torch.FloatTensor(feature_vector).to(self.device)
                predicted_gp = self.gp_model(tensor).item()

            if features.get("moisture_percent", 8.0) > 13:
                predicted_gp *= 0.85
            if features.get("days_since_harvest", 30) > 180:
                predicted_gp *= 0.90
            if features.get("storage_temperature_c", 20.0) > 30:
                predicted_gp *= 0.88

            predicted_gp = max(0, min(100, predicted_gp))
            pass_fail = "PASS" if predicted_gp >= 70 else "FAIL"
            confidence = min(0.97, abs(predicted_gp - 70) / 30 + 0.70)
            recommendations = self._generate_recommendations(features, predicted_gp)
            defect_risk = "Low" if predicted_gp >= 80 else "Medium" if predicted_gp >= 70 else "High"

            return {
                "predicted_gp_percent": round(predicted_gp, 1),
                "pass_fail": pass_fail,
                "confidence_score": round(confidence, 2),
                "defect_risk": defect_risk,
                "recommendations": recommendations,
            }
        except Exception as e:
            print(f"GP Prediction error: {e}")
            return {
                "predicted_gp_percent": 75.0,
                "pass_fail": "PASS",
                "confidence_score": 0.70,
                "defect_risk": "Medium",
                "recommendations": ["Run full lab test for accurate results"],
            }

    def predict_gp_timeline(self, base_features: dict, forecast_days: List[int]) -> dict:
        points = sorted(set([int(x) for x in forecast_days if int(x) >= 0]))
        if 0 not in points:
            points = [0] + points

        timeline = []
        for extra_days in points:
            features = {**base_features, "days_since_harvest": int(base_features.get("days_since_harvest", 0)) + extra_days}
            out = self.predict_gp(features)
            timeline.append(
                {
                    "storage_days": features["days_since_harvest"],
                    "predicted_gp_percent": out["predicted_gp_percent"],
                    "pass_fail": out["pass_fail"],
                }
            )

        current_gp = timeline[0]["predicted_gp_percent"] if timeline else 0
        quality_status = "PASS" if current_gp >= 70 else "FAIL"
        final_gp = timeline[-1]["predicted_gp_percent"] if timeline else current_gp
        decay = round(current_gp - final_gp, 1)

        recommendations = [
            "Keep storage temperature between 15C and 20C.",
            "Keep storage humidity between 40% and 55%.",
            "Target seed moisture below 10% for long storage.",
        ]
        if decay >= 10:
            recommendations.append("Shelf-life decay is high; schedule dispatch sooner or re-test monthly.")
        if quality_status == "FAIL":
            recommendations.append("Current GP is below release threshold; perform confirmatory germination test.")

        return {
            "current_gp_percent": round(current_gp, 1),
            "quality_status": quality_status,
            "timeline": timeline,
            "recommendations": recommendations,
        }

    def predict_image_defect(self, image_bytes: bytes) -> dict:
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            tensor = self.transform(image).unsqueeze(0).to(self.device)

            with torch.no_grad():
                outputs = self.defect_model(tensor)
                probs = torch.softmax(outputs, dim=1)[0]
                pred_class = torch.argmax(probs).item()
                confidence = probs[pred_class].item()

            return {
                "defect_class": self.defect_classes[pred_class],
                "confidence": round(confidence, 2),
                "class_probabilities": {cls: round(probs[i].item(), 3) for i, cls in enumerate(self.defect_classes)},
            }
        except Exception as e:
            print(f"CNN Image prediction error: {e}")
            return {
                "defect_class": "ModelError",
                "confidence": 0.0,
                "class_probabilities": {
                    "Healthy": 0.0,
                    "Cracked": 0.0,
                    "Discolored": 0.0,
                    "Shriveled": 0.0,
                },
            }

    def predict_image_yolo(self, image_bytes: bytes) -> dict:
        if self.seed_model_yolo is None:
            return {"error": "YOLO model not loaded"}

        try:
            temp_path = "temp_seed.jpg"
            with open(temp_path, "wb") as f:
                f.write(image_bytes)

            results = self.seed_model_yolo.predict(temp_path)
            summary = {}
            if results and results[0].boxes:
                for cls_id in results[0].boxes.cls:
                    cls_name = self.defect_classes[int(cls_id)] if cls_id < len(self.defect_classes) else str(int(cls_id))
                    summary[cls_name] = summary.get(cls_name, 0) + 1

            return {
                "summary": summary,
                "boxes": results[0].boxes.xyxy.tolist() if results[0].boxes else [],
            }

        except Exception as e:
            print(f"YOLO prediction error: {e}")
            return {"error": str(e)}

    def _generate_recommendations(self, features: dict, predicted_gp: float) -> list:
        recommendations = []
        if features.get("moisture_percent", 8) > 11:
            recommendations.append("High moisture detected. Dry seeds to below 10% before storage.")
        if features.get("storage_temperature_c", 20) > 25:
            recommendations.append("Reduce storage temperature to 15-20 C to preserve germination rate.")
        if features.get("storage_humidity_percent", 50) > 60:
            recommendations.append("Reduce storage humidity to 40-50% to prevent mold growth.")
        if features.get("days_since_harvest", 30) > 150:
            recommendations.append("Batch is aging. Prioritize for early dispatch or re-test GP.")
        if predicted_gp < 70:
            recommendations.append("CRITICAL: Predicted GP below 70%. Do NOT release this batch.")
            recommendations.append("Conduct full lab germination test immediately.")
        elif predicted_gp < 80:
            recommendations.append("GP near threshold. Conduct additional lab verification before approval.")
        else:
            recommendations.append("Batch quality is acceptable. Proceed with standard QC checks.")
        return recommendations
