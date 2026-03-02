from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db
from bson import ObjectId

router = APIRouter()


class ClimateRequest(BaseModel):
    region: str
    crop_type: str
    heatwave_risk: float
    flood_risk: float
    rainfall_anomaly_percent: float
    forecast_rainfall_mm_3m: float
    baseline_carbon_tco2e: float


def serialize_doc(doc):
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


@router.post("/resilience-plan")
async def resilience_plan(payload: ClimateRequest):
    db = get_db()
    now_iso = datetime.now().isoformat()

    climate_risk = min(
        100.0,
        round(
            payload.heatwave_risk * 0.45
            + payload.flood_risk * 0.45
            + abs(payload.rainfall_anomaly_percent) * 0.2,
            1,
        ),
    )

    if climate_risk >= 75:
        planting_window = "Window-B (Delay 5-7 days)"
    elif climate_risk >= 45:
        planting_window = "Window-A (Normal with contingency)"
    else:
        planting_window = "Window-A (Normal)"

    if payload.crop_type == "Bajra" and payload.heatwave_risk >= 60:
        variety = "Drought-Resistant Bajra Hybrid"
    elif payload.crop_type == "Cotton" and payload.flood_risk >= 60:
        variety = "Waterlogging-Tolerant Cotton Hybrid"
    else:
        variety = f"Standard {payload.crop_type} Hybrid"

    sustainability_score = round(
        max(
            0.0,
            min(
                100.0,
                82
                - payload.baseline_carbon_tco2e * 4
                + (18 - abs(payload.rainfall_anomaly_percent) * 0.2),
            ),
        ),
        1,
    )

    improvement_steps = []
    if payload.heatwave_risk >= 70:
        improvement_steps.append(
            "Advance irrigation and apply heat mitigation schedule for critical flowering windows."
        )
    if payload.flood_risk >= 60:
        improvement_steps.append(
            "Pre-position drainage and avoid low-lying blocks for sensitive parent lines."
        )
    if abs(payload.rainfall_anomaly_percent) >= 20:
        improvement_steps.append(
            "Use adaptive planting window and diversify block allocation by risk zone."
        )
    if payload.baseline_carbon_tco2e > 6:
        improvement_steps.append(
            "Reduce diesel pump hours and optimize water-energy cycles to improve sustainability score."
        )
    if not improvement_steps:
        improvement_steps.append(
            "Climate outlook is manageable. Follow planned schedule with fortnightly forecast refresh."
        )

    issue = "Climate risk is manageable."
    why = "Current heat/flood/rainfall indicators are within manageable range."
    if climate_risk >= 75:
        issue = "High climate exposure for this region."
        why = "Heat, flood, and rainfall anomaly together are creating strong production risk."
    elif climate_risk >= 45:
        issue = "Moderate climate risk detected."
        why = "One or more climate signals are unstable and can impact seed quality if unmanaged."

    prevention_steps = []
    for s in improvement_steps:
        prevention_steps.append(s)

    seed_quality_impact = (
        "Climate-aligned planting windows and variety matching reduce stress shocks that degrade germination and seed vigor."
    )
    cross_module_link = (
        "Climate risk adjusts Water scheduling and Precision scouting intensity for end-to-end seed quality protection."
    )

    result = {
        "region": payload.region,
        "crop_type": payload.crop_type,
        "climate_risk_score": climate_risk,
        "recommended_planting_window": planting_window,
        "recommended_variety": variety,
        "sustainability_score": sustainability_score,
        "improvement_steps": improvement_steps,
        "seed_quality_impact": seed_quality_impact,
        "cross_module_link": cross_module_link,
        "created_at": now_iso,
    }
    report = {
        "title": f"Climate Resilience Report - {payload.region}",
        "summary": f"Climate risk {climate_risk}, window '{planting_window}', recommended variety '{variety}'.",
        "issue_found": issue,
        "why_it_happened": why,
        "prevention_steps": prevention_steps,
        "improvement_steps": improvement_steps,
        "seed_quality_impact": seed_quality_impact,
        "cross_module_link": cross_module_link,
        "generated_at": now_iso,
    }
    result["report"] = report

    write_result = await db.climate_resilience_logs.insert_one(
        {"input": payload.model_dump(), "output": result, "report": report, "created_at": now_iso}
    )

    if climate_risk >= 75:
        await db.alerts.insert_one(
            {
                "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                "module": "ClimateResilience",
                "severity": "Critical",
                "title": "High Climate Exposure",
                "message": f"Region {payload.region} has high climate risk score ({climate_risk}).",
                "linked_entity_id": payload.region,
                "status": "Open",
                "created_at": now_iso,
            }
        )

    return {**result, "log_id": str(write_result.inserted_id)}


@router.get("/history")
async def climate_history(page: int = 1, limit: int = 20):
    db = get_db()
    skip = (page - 1) * limit
    cursor = db.climate_resilience_logs.find({}).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))
    total = await db.climate_resilience_logs.count_documents({})
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/history/{log_id}/report")
async def climate_report(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report id")
    doc = await db.climate_resilience_logs.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"log_id": log_id, "report": doc.get("report") or doc.get("output", {}).get("report")}


@router.get("/stats")
async def climate_stats():
    db = get_db()
    total = await db.climate_resilience_logs.count_documents({})
    high_risk = await db.climate_resilience_logs.count_documents(
        {"output.climate_risk_score": {"$gte": 75}}
    )

    avg_sustainability = 0.0
    pipeline = [
        {"$group": {"_id": None, "avg_score": {"$avg": "$output.sustainability_score"}}}
    ]
    async for doc in db.climate_resilience_logs.aggregate(pipeline):
        avg_sustainability = round(float(doc.get("avg_score", 0.0)), 1)

    return {
        "total_assessments": total,
        "high_risk_regions": high_risk,
        "avg_sustainability_score": avg_sustainability,
    }
