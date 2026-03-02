import random
import shutil
from pathlib import Path

# 🔹 Your dataset root
SOURCE_DIR = Path("data/GermPredDataset")

# 🔹 Final YOLO dataset folder
DEST_DIR = Path("dataset")

train_img_dir = DEST_DIR / "images/train"
val_img_dir = DEST_DIR / "images/val"
train_label_dir = DEST_DIR / "labels/train"
val_label_dir = DEST_DIR / "labels/val"

# Create folders
for folder in [train_img_dir, val_img_dir, train_label_dir, val_label_dir]:
    folder.mkdir(parents=True, exist_ok=True)

all_data = []

# Collect all images + labels from all crop folders
for crop_folder in SOURCE_DIR.iterdir():

    img_dir = crop_folder / "img"
    label_dir = crop_folder / "labels"

    if not img_dir.exists() or not label_dir.exists():
        continue

    for img_file in img_dir.glob("*.jpg"):
        label_file = label_dir / (img_file.stem + ".txt")

        if label_file.exists():
            all_data.append((img_file, label_file))

print(f"Total images found: {len(all_data)}")

# Shuffle
random.shuffle(all_data)

# 80% train
split_index = int(0.8 * len(all_data))

train_data = all_data[:split_index]
val_data = all_data[split_index:]

# Copy training data
for img_file, label_file in train_data:
    shutil.copy(img_file, train_img_dir / img_file.name)
    shutil.copy(label_file, train_label_dir / label_file.name)

# Copy validation data
for img_file, label_file in val_data:
    shutil.copy(img_file, val_img_dir / img_file.name)
    shutil.copy(label_file, val_label_dir / label_file.name)

print("✅ Dataset successfully split!")
print(f"Training images: {len(train_data)}")
print(f"Validation images: {len(val_data)}")