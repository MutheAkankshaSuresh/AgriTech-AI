from fastapi import APIRouter
from app.database import get_db
from datetime import datetime

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats():
    db = get_db()
    now = datetime.now()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    total = await db.seed_batches.count_documents({})
    passed = await db.seed_batches.count_documents({"status": "Approved"})
    failed = await db.seed_batches.count_documents({"status": "Rejected"})
    pending = await db.seed_batches.count_documents({"status": "Pending"})
    critical_alerts = await db.alerts.count_documents({"status": "Open", "severity": "Critical"})
    iot_readings_today = await db.iot_readings.count_documents({"created_at": {"$gte": day_start}})
    chamber_a_today = await db.iot_chamber_a_readings.count_documents({"created_at": {"$gte": day_start}})
    chamber_b_today = await db.iot_chamber_b_images.count_documents({"created_at": {"$gte": day_start}})
    manual_entries_today = await db.seed_batches.count_documents({"created_at": {"$gte": day_start}, "input_source": {"$ne": "iot"}})

    latest_iot = await db.iot_readings.find_one({}, sort=[("created_at", -1)])
    last_device_sync = latest_iot.get("created_at") if latest_iot else None

    pipeline = [{"$group": {"_id": None, "avg_gp": {"$avg": "$ai_prediction.predicted_gp_percent"}, "total_kg": {"$sum": "$quantity_kg"}}}]
    agg = None
    async for doc in db.seed_batches.aggregate(pipeline):
        agg = doc

    return {
        "total_batches": total,
        "passed_batches": passed,
        "failed_batches": failed,
        "pending_batches": pending,
        "avg_gp_percent": round(agg["avg_gp"], 1) if agg else 0,
        "total_inventory_kg": agg["total_kg"] if agg else 0,
        "critical_alerts": critical_alerts,
        "iot_readings_today": iot_readings_today,
        "chamber_a_readings_today": chamber_a_today,
        "chamber_b_images_today": chamber_b_today,
        "manual_entries_today": manual_entries_today,
        "last_device_sync": last_device_sync
    }
