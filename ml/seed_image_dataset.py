from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image
from torch.utils.data import Dataset


class SeedImageDataset(Dataset):
    """Generic image-folder dataset for seed defect classification.

    Expected structure:
      root/
        Healthy/*.jpg
        Cracked/*.jpg
        Discolored/*.jpg
        Shriveled/*.jpg
    """

    IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    def __init__(self, root_dir: str, class_to_idx: Dict[str, int], transform=None):
        self.root_dir = Path(root_dir)
        self.class_to_idx = class_to_idx
        self.transform = transform
        self.samples: List[Tuple[Path, int]] = self._discover_samples()

        if not self.samples:
            raise ValueError(f"No seed images found in {self.root_dir}")

    def _discover_samples(self) -> List[Tuple[Path, int]]:
        samples: List[Tuple[Path, int]] = []
        for class_name, class_idx in self.class_to_idx.items():
            class_dir = self.root_dir / class_name
            if not class_dir.exists():
                continue
            for img_path in class_dir.rglob("*"):
                if img_path.suffix.lower() in self.IMG_EXTS:
                    samples.append((img_path, class_idx))
        return samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, label = self.samples[idx]
        image = Image.open(img_path).convert("RGB")
        if self.transform is not None:
            image = self.transform(image)
        return image, label
