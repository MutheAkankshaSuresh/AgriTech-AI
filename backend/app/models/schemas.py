from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class CropType(str, Enum):
    cotton = "Cotton"
    bajra = "Bajra"
    tomato = "Tomato"
    brinjal = "Brinjal"
    chilli = "Chilli"

class BatchStatus(str, Enum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"
    under_review = "Under Review"

class StorageInfo(BaseModel):
    location: str
    temperature_c: float
    humidity_percent: float

class LabResults(BaseModel):
    moisture_percent: float
    thousand_seed_weight_g: float
    physical_purity_percent: float
    actual_gp_percent: Optional[float] = None
    test_date: Optional[str] = None

class AIPrediction(BaseModel):
    predicted_gp_percent: float
    defect_class: str
    confidence_score: float
    pass_fail: str
    model_version: str = "v2.1"

class SeedBatchCreate(BaseModel):
    batch_id: str
    crop_type: CropType
    variety_name: str
    quantity_kg: float
    harvest_date: str
    received_date: str
    storage: StorageInfo
    lab_results: LabResults
    input_source: str = "manual"
    device_id: Optional[str] = None
    captured_at: Optional[str] = None
    sample_size: Optional[int] = None
    iot_reading_id: Optional[str] = None
    sensor_payload: Optional[dict] = None

class SeedBatchResponse(BaseModel):
    id: Optional[str] = None
    batch_id: str
    crop_type: str
    variety_name: str
    quantity_kg: float
    harvest_date: str
    received_date: str
    storage: StorageInfo
    lab_results: LabResults
    ai_prediction: Optional[AIPrediction] = None
    status: str
    created_at: str

class PredictionRequest(BaseModel):
    moisture_percent: float
    thousand_seed_weight_g: float
    physical_purity_percent: float
    storage_temperature_c: float
    storage_humidity_percent: float
    days_since_harvest: int
    crop_type: str
    batch_id: Optional[str] = None
    input_source: str = "manual"
    device_id: Optional[str] = None
    iot_reading_id: Optional[str] = None
    sensor_payload: Optional[dict] = None

class PredictionResponse(BaseModel):
    predicted_gp_percent: float
    pass_fail: str
    confidence_score: float
    defect_risk: str
    recommendations: List[str]


class ChamberAReadingCreate(BaseModel):
    device_id: str
    batch_id: Optional[str] = None
    crop_type: Optional[str] = None
    temperature_c: float
    humidity_percent: float
    seed_moisture_percent: float
    storage_days: int = 0
    light_level: Optional[float] = None
    co2_ppm: Optional[float] = None
    total_seeds: Optional[int] = None
    captured_at: Optional[str] = None
    sensor_payload: Optional[dict] = None


class ChamberBImageCreate(BaseModel):
    device_id: str
    batch_id: Optional[str] = None
    image_name: str
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    image_content_type: str = "image/jpeg"
    total_seeds: Optional[int] = None
    germinated_seeds: Optional[int] = None
    damaged_seeds: Optional[int] = None
    mold_presence: Optional[bool] = None
    captured_at: Optional[str] = None
    metadata: Optional[dict] = None


class GPForecastRequest(BaseModel):
    device_id: Optional[str] = None
    batch_id: Optional[str] = None
    crop_type: str
    temperature_c: float
    humidity_percent: float
    seed_moisture_percent: float
    storage_days: int
    thousand_seed_weight_g: Optional[float] = 100.0
    physical_purity_percent: Optional[float] = 98.0
    damaged_seeds: Optional[int] = 0
    color_uniformity: Optional[float] = 85.0
    total_seeds: Optional[int] = 20
    forecast_days: List[int] = Field(default_factory=lambda: [0, 30, 90, 180])


class GPForecastPoint(BaseModel):
    storage_days: int
    predicted_gp_percent: float
    pass_fail: str


class GPForecastResponse(BaseModel):
    batch_id: Optional[str] = None
    device_id: Optional[str] = None
    current_gp_percent: float
    quality_status: str
    timeline: List[GPForecastPoint]
    recommendations: List[str]

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class DashboardStats(BaseModel):
    total_batches: int
    passed_batches: int
    failed_batches: int
    pending_batches: int
    avg_gp_percent: float
    total_inventory_kg: float
    critical_alerts: int

class AlertModel(BaseModel):
    alert_id: str
    module: str
    severity: str
    title: str
    message: str
    linked_entity_id: Optional[str] = None
    status: str
    created_at: str
