from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from typing import Optional
import os
from urllib.parse import quote_plus, urlparse

class Settings(BaseSettings):
    MONGODB_URL: Optional[str] = None
    DATABASE_NAME: Optional[str] = None
    SECRET_KEY: str = "agritech-super-secret-jwt-key-2024"
    ML_MODELS_PATH: str = "./ml_models"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    class Config:
        env_file = ".env"

settings = Settings()
settings.MONGODB_URL = (
    settings.MONGODB_URL
    or os.getenv("MONGODB_URI")
    or os.getenv("MONGO_URL")
    or "mongodb://localhost:27017/agritech_db"
)

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db = None

db_instance = Database()

def _normalize_mongodb_url(url: str) -> str:
    """Escape user/password in MongoDB URI when raw special chars are used."""
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    creds, host_and_query = rest.rsplit("@", 1)
    if ":" not in creds:
        return url
    username, password = creds.split(":", 1)
    return f"{scheme}://{quote_plus(username)}:{quote_plus(password)}@{host_and_query}"

def _database_name_from_url(url: str) -> Optional[str]:
    parsed = urlparse(url)
    path = (parsed.path or "").strip("/")
    if path:
        return path
    return None

async def connect_db():
    mongodb_url = _normalize_mongodb_url(settings.MONGODB_URL)
    db_name = settings.DATABASE_NAME or _database_name_from_url(mongodb_url) or "agritech_db"
    db_instance.client = AsyncIOMotorClient(mongodb_url)
    db_instance.db = db_instance.client[db_name]
    print(f"Connected to MongoDB: {db_name}")
    await seed_initial_data()

async def close_db():
    if db_instance.client:
        db_instance.client.close()
        print("MongoDB connection closed")

def get_db():
    return db_instance.db

async def seed_initial_data():
    """Insert sample data if collections are empty"""
    db = db_instance.db

    # Seed users
    if await db.users.count_documents({}) == 0:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
        await db.users.insert_many([
            {
                "name": "Admin User",
                "email": "admin@agritech.com",
                "password": pwd_context.hash("Admin@123"),
                "role": "Admin",
                "permissions": ["all"],
                "created_at": "2024-01-01T00:00:00Z"
            },
            {
                "name": "QC Manager",
                "email": "qc@agritech.com",
                "password": pwd_context.hash("QC@123"),
                "role": "QC_Analyst",
                "permissions": ["seed_read", "seed_write", "reports_read"],
                "created_at": "2024-01-01T00:00:00Z"
            }
        ])
        print("✅ Sample users seeded")

    # Seed sample batches
    if await db.seed_batches.count_documents({}) == 0:
        from datetime import datetime, timedelta
        import random

        crops = ["Cotton", "Bajra", "Tomato", "Brinjal", "Chilli"]
        varieties = {
            "Cotton": ["RCH-776", "MRC-7361", "Bollgard-II"],
            "Bajra": ["HHB-67", "Proagro-9444", "Kaveri-Bio-603"],
            "Tomato": ["Arka Vikas", "Pusa Ruby", "NS-515"],
            "Brinjal": ["Pusa Purple", "Arka Navneet", "Brinjal-H-4"],
            "Chilli": ["Pusa Jwala", "G-4", "Byadagi Kaddi"]
        }
        batches = []
        for i in range(1, 21):
            crop = random.choice(crops)
            gp = random.uniform(55, 95)
            predicted_gp = gp + random.uniform(-5, 5)
            batches.append({
                "batch_id": f"BATCH-2024-{crop[:3].upper()}-{i:03d}",
                "crop_type": crop,
                "variety_name": random.choice(varieties[crop]),
                "quantity_kg": random.randint(500, 8000),
                "harvest_date": (datetime.now() - timedelta(days=random.randint(30, 120))).strftime("%Y-%m-%d"),
                "received_date": (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
                "storage": {
                    "location": f"Warehouse-{random.choice(['A','B','C'])}, Rack-{random.randint(1,10)}",
                    "temperature_c": round(random.uniform(15, 25), 1),
                    "humidity_percent": round(random.uniform(40, 60), 1)
                },
                "lab_results": {
                    "moisture_percent": round(random.uniform(7, 12), 1),
                    "thousand_seed_weight_g": round(random.uniform(80, 150), 1),
                    "physical_purity_percent": round(random.uniform(97, 99.9), 1),
                    "actual_gp_percent": round(gp, 1),
                    "test_date": (datetime.now() - timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d")
                },
                "ai_prediction": {
                    "predicted_gp_percent": round(predicted_gp, 1),
                    "defect_class": random.choice(["Healthy", "Mild Discoloration", "Cracked", "Shriveled"]),
                    "confidence_score": round(random.uniform(0.75, 0.97), 2),
                    "pass_fail": "PASS" if predicted_gp >= 70 else "FAIL",
                    "model_version": "v2.1"
                },
                "status": "Approved" if gp >= 70 else "Rejected",
                "created_at": datetime.now().isoformat()
            })
        await db.seed_batches.insert_many(batches)
        print("✅ Sample seed batches seeded")

    # Create indexes
    await db.seed_batches.create_index("batch_id", unique=True)
    await db.seed_batches.create_index("crop_type")
    await db.seed_batches.create_index("status")
    await db.users.create_index("email", unique=True)
    await db.ai_prediction_logs.create_index("analysis_type")
    await db.ai_prediction_logs.create_index("batch_id")
    await db.ai_prediction_logs.create_index("created_at")
    await db.iot_readings.create_index("created_at")
    await db.iot_readings.create_index("device_id")
    await db.iot_chamber_a_readings.create_index("created_at")
    await db.iot_chamber_a_readings.create_index("device_id")
    await db.iot_chamber_b_images.create_index("created_at")
    await db.iot_chamber_b_images.create_index("device_id")
    await db.water_intelligence_logs.create_index("created_at")
    await db.precision_farming_logs.create_index("created_at")
    await db.climate_resilience_logs.create_index("created_at")
    print("✅ Database indexes created")
