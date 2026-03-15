"""Train YOLOv8 model using ml/data.yaml and export best.pt to backend/ml_models."""

from pathlib import Path
import shutil

from ultralytics import YOLO


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_YAML = ROOT_DIR / "ml" / "data.yaml"
MODEL_DIR = ROOT_DIR / "backend" / "ml_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def main():
    model = YOLO("yolov8n.pt")
    result = model.train(
        data=str(DATA_YAML),
        imgsz=640,
        epochs=100,
        batch=16,
        project=str(ROOT_DIR / "ml" / "runs"),
        name="seed_yolo",
        exist_ok=True,
    )

    best_source = Path(result.save_dir) / "weights" / "best.pt"
    if not best_source.exists():
        raise FileNotFoundError(f"best.pt not found at {best_source}")

    best_target = MODEL_DIR / "best.pt"
    shutil.copy2(best_source, best_target)
    print(f"Saved: {best_target}")


if __name__ == "__main__":
    main()
