from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db
from bson import ObjectId

router = APIRouter()


class WaterAdviceRequest(BaseModel):
    plot_id: str
    crop_type: str
    soil_moisture_percent: float
    rainfall_forecast_mm: float
    evapotranspiration_mm: float
    pump_flow_lpm: float
    hours_since_last_irrigation: float


def serialize_doc(doc):
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


@router.post("/irrigation-advice")
async def irrigation_advice(payload: WaterAdviceRequest):
    db = get_db()
    now_iso = datetime.now().isoformat()

    # Simple operational heuristic for B2B seed production plots
    moisture_deficit = max(0.0, 32.0 - payload.soil_moisture_percent)
    climate_pressure = max(0.0, payload.evapotranspiration_mm - payload.rainfall_forecast_mm)
    irrigation_need_mm = round(max(0.0, moisture_deficit * 1.5 + climate_pressure), 1)

    if irrigation_need_mm >= 18 or payload.hours_since_last_irrigation > 30:
        priority = "Critical"
    elif irrigation_need_mm >= 10 or payload.hours_since_last_irrigation > 20:
        priority = "High"
    else:
        priority = "Normal"

    leak_risk = "High" if payload.pump_flow_lpm < 35 else "Medium" if payload.pump_flow_lpm < 50 else "Low"
    recommended_window_hours = 2 if priority == "Critical" else 6 if priority == "High" else 12
    estimated_water_saving_percent = round(min(35.0, 8 + payload.rainfall_forecast_mm * 0.6), 1)
    improvement_steps = []
    if payload.soil_moisture_percent < 20:
        improvement_steps.append("Increase irrigation frequency for the next 3 days to restore soil moisture above 24%.")
    if payload.pump_flow_lpm < 35:
        improvement_steps.append("Inspect pump and mainline for leakage or pressure drop within 24 hours.")
    if payload.rainfall_forecast_mm < 5 and payload.evapotranspiration_mm > 6:
        improvement_steps.append("Shift irrigation schedule to early morning/evening to reduce evaporative losses.")
    if not improvement_steps:
        improvement_steps.append("Current irrigation setup is stable. Continue monitored scheduling and weekly audit.")

    issue = "Water condition is stable."
    why = "Soil moisture and irrigation timing are in acceptable range."
    if priority == "Critical":
        issue = "Critical irrigation stress detected."
        why = "Soil is too dry or irrigation delay is too long for current weather demand."
    elif priority == "High":
        issue = "High irrigation need detected."
        why = "Moisture deficit and weather pressure are increasing crop water stress."
    if leak_risk == "High":
        issue = "Possible pump/line problem with high leak risk."
        why = "Low pump flow suggests pressure loss or leakage in irrigation system."

    prevention_steps = []
    for s in improvement_steps:
        prevention_steps.append(s)

    seed_quality_impact = (
        "Stable moisture in parent seed plots protects seed fill quality, improves viability, and reduces downstream rejection risk."
    )
    cross_module_link = (
        "Water stress risk feeds Precision Farming scouting priority; combined trend feeds Climate Resilience planning windows."
    )

    result = {
        "plot_id": payload.plot_id,
        "crop_type": payload.crop_type,
        "irrigation_need_mm": irrigation_need_mm,
        "priority": priority,
        "recommended_window_hours": recommended_window_hours,
        "leak_risk": leak_risk,
        "estimated_water_saving_percent": estimated_water_saving_percent,
        "improvement_steps": improvement_steps,
        "seed_quality_impact": seed_quality_impact,
        "cross_module_link": cross_module_link,
        "created_at": now_iso,
    }
    report = {
        "title": f"Water Intelligence Report - {payload.plot_id}",
        "summary": f"Priority {priority} with irrigation need {irrigation_need_mm} mm and leak risk {leak_risk}.",
        "issue_found": issue,
        "why_it_happened": why,
        "prevention_steps": prevention_steps,
        "improvement_steps": improvement_steps,
        "seed_quality_impact": seed_quality_impact,
        "cross_module_link": cross_module_link,
        "generated_at": now_iso,
    }
    result["report"] = report

    write_result = await db.water_intelligence_logs.insert_one(
        {
            "input": payload.model_dump(),
            "output": result,
            "report": report,
            "created_at": now_iso,
        }
    )

    if priority == "Critical" or leak_risk == "High":
        await db.alerts.insert_one(
            {
                "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                "module": "WaterIntelligence",
                "severity": "Critical" if priority == "Critical" else "Warning",
                "title": "Irrigation Risk Detected",
                "message": f"Plot {payload.plot_id} requires urgent irrigation action. Leak risk: {leak_risk}.",
                "linked_entity_id": payload.plot_id,
                "status": "Open",
                "created_at": now_iso,
            }
        )

    return {**result, "log_id": str(write_result.inserted_id)}


@router.get("/history")
async def water_history(page: int = 1, limit: int = 20):
    db = get_db()
    skip = (page - 1) * limit
    cursor = db.water_intelligence_logs.find({}).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))
    total = await db.water_intelligence_logs.count_documents({})
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/history/{log_id}/report")
async def water_report(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report id")
    doc = await db.water_intelligence_logs.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"log_id": log_id, "report": doc.get("report") or doc.get("output", {}).get("report")}


@router.get("/stats")
async def water_stats():
    db = get_db()
    total = await db.water_intelligence_logs.count_documents({})
    critical = await db.water_intelligence_logs.count_documents({"output.priority": "Critical"})

    avg_saving = 0.0
    pipeline = [{"$group": {"_id": None, "avg_saving": {"$avg": "$output.estimated_water_saving_percent"}}}]
    async for doc in db.water_intelligence_logs.aggregate(pipeline):
        avg_saving = round(float(doc.get("avg_saving", 0.0)), 1)

    return {
        "total_assessments": total,
        "critical_cases": critical,
        "avg_estimated_saving_percent": avg_saving,
    }
