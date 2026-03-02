from fastapi import APIRouter
from app.database import get_db
from typing import Optional

router = APIRouter()

def serialize(doc):
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

@router.get("/")
async def get_alerts(status: Optional[str] = None, severity: Optional[str] = None):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    alerts = []
    async for doc in db.alerts.find(query).sort("created_at", -1).limit(50):
        alerts.append(serialize(doc))
    return alerts

@router.patch("/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    db = get_db()
    from datetime import datetime
    await db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"status": "Resolved", "resolved_at": datetime.now().isoformat()}}
    )
    return {"message": "Alert resolved"}
