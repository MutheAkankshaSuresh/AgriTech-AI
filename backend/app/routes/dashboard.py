from fastapi import APIRouter
from app.database import get_db
from datetime import datetime

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats():
    db = get_db()
    total = await db.seed_batches.count_documents({})
    passed = await db.seed_batches.count_documents({"status": "Approved"})
    failed = await db.seed_batches.count_documents({"status": "Rejected"})
    pending = await db.seed_batches.count_documents({"status": "Pending"})
    critical_alerts = await db.alerts.count_documents({"status": "Open", "severity": "Critical"})

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
        "critical_alerts": critical_alerts
    }
