import os
import xml.etree.ElementTree as ET
from pathlib import Path

# 🔹 Root dataset folder
DATASET_DIR = Path("data/GermPredDataset")

def convert_box(size, box):
    dw = 1.0 / size[0]
    dh = 1.0 / size[1]

    x_center = (box[0] + box[1]) / 2.0
    y_center = (box[2] + box[3]) / 2.0
    width = box[1] - box[0]
    height = box[3] - box[2]

    return (
        x_center * dw,
        y_center * dh,
        width * dw,
        height * dh
    )

print(f"📁 Scanning dataset folder: {DATASET_DIR}\n")

# Loop through all crop folders
for crop_folder in DATASET_DIR.iterdir():

    if not crop_folder.is_dir():
        continue  # skip files

    print(f"🔄 Processing: {crop_folder.name}")

    img_dir = crop_folder / "img"
    ann_dir = crop_folder / "true_ann"
    label_dir = crop_folder / "labels"

    # Skip if required folders not present
    if not img_dir.exists() or not ann_dir.exists():
        print(f"   ⚠ Skipping {crop_folder.name} (missing img or true_ann)")
        continue

    label_dir.mkdir(exist_ok=True)

    xml_files = list(ann_dir.glob("*.xml"))

    if len(xml_files) == 0:
        print(f"   ⚠ No XML files found in {ann_dir}")
        continue

    for xml_file in xml_files:
        tree = ET.parse(xml_file)
        root = tree.getroot()

        size = root.find("size")
        w = int(size.find("width").text)
        h = int(size.find("height").text)

        txt_file = label_dir / (xml_file.stem + ".txt")

        with open(txt_file, "w") as f:
            for obj in root.findall("object"):

                xmlbox = obj.find("bndbox")

                xmin = float(xmlbox.find("xmin").text)
                xmax = float(xmlbox.find("xmax").text)
                ymin = float(xmlbox.find("ymin").text)
                ymax = float(xmlbox.find("ymax").text)

                bb = convert_box((w, h), (xmin, xmax, ymin, ymax))

                # 0 = single class (seed)
                f.write(f"0 {' '.join([str(a) for a in bb])}\n")

    print(f"   ✅ Converted {len(xml_files)} files\n")

print("🎉 All folders converted successfully!")