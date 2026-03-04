from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db
from bson import ObjectId

router = APIRouter()


class PrecisionRequest(BaseModel):
    field_id: str
    crop_type: str
    ndvi: float
    pest_risk_score: float
    disease_risk_score: float
    soil_nitrogen_ppm: float
    last_season_yield_t_ha: float


def serialize_doc(doc):
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


@router.post("/field-analysis")
async def field_analysis(payload: PrecisionRequest):
    db = get_db()
    now_iso = datetime.now().isoformat()

    vigor = max(0.0, min(1.0, payload.ndvi))
    risk_combo = (payload.pest_risk_score + payload.disease_risk_score) / 2.0

    if vigor < 0.35:
        seeding_density = "Low (2.5 kg/acre)"
    elif vigor < 0.55:
        seeding_density = "Medium (3.2 kg/acre)"
    else:
        seeding_density = "High (4.0 kg/acre)"

    spray_priority = "Immediate" if risk_combo >= 75 else "Planned" if risk_combo >= 45 else "Monitor"
    predicted_yield = round(max(0.2, payload.last_season_yield_t_ha * (0.75 + vigor * 0.5) * (1 - risk_combo / 220)), 2)
    risk_band = "High" if risk_combo >= 75 else "Medium" if risk_combo >= 45 else "Low"
    improvement_steps = []
    if vigor < 0.45:
        improvement_steps.append("Apply variable-rate nutrition and reduce seeding density in low-vigor zones.")
    if payload.pest_risk_score >= 70 or payload.disease_risk_score >= 70:
        improvement_steps.append("Deploy field scouting and preventive spray in the next 24-48 hours.")
    if payload.soil_nitrogen_ppm < 40:
        improvement_steps.append("Apply corrective nitrogen split dose and re-check NDVI in 7 days.")
    if not improvement_steps:
        improvement_steps.append("Field condition is acceptable. Maintain current precision schedule and weekly surveillance.")

    issue = "Field condition is acceptable."
    why = "Risk indicators are currently controlled."
    if risk_band == "High":
        issue = "High field risk for seed production."
        why = "Pest/disease pressure is high and can reduce seed output and quality."
    elif risk_band == "Medium":
        issue = "Moderate field risk detected."
        why = "Some indicators are trending unfavorably and need timely intervention."
    if vigor < 0.45:
        why = f"{why} NDVI/vigor is low, showing weaker crop performance zones."

    prevention_steps = []
    for s in improvement_steps:
        prevention_steps.append(s)

    seed_quality_impact = (
        "Early pest/disease intervention protects hybrid parent lines and prevents quality drop in harvested seed lots."
    )
    cross_module_link = (
        "Precision risk zones are prioritized using Water Intelligence stress flags and Climate Resilience forecasts."
    )

    result = {
        "field_id": payload.field_id,
        "crop_type": payload.crop_type,
        "recommended_seeding_density": seeding_density,
        "spray_priority": spray_priority,
        "predicted_seed_output_t_ha": predicted_yield,
        "risk_band": risk_band,
        "improvement_steps": improvement_steps,
        "seed_quality_impact": seed_quality_impact,
        "cross_module_link": cross_module_link,
        "created_at": now_iso,
    }
    report = {
        "title": f"Precision Farming Report - {payload.field_id}",
        "summary": f"Risk band {risk_band}, spray priority {spray_priority}, predicted seed output {predicted_yield} t/ha.",
        "issue_found": issue,
        "why_it_happened": why,
        "prevention_steps": prevention_steps,
        "improvement_steps": improvement_steps,
        "seed_quality_impact": seed_quality_impact,
        "cross_module_link": cross_module_link,
        "generated_at": now_iso,
    }
    result["report"] = report

    write_result = await db.precision_farming_logs.insert_one(
        {"input": payload.model_dump(), "output": result, "report": report, "created_at": now_iso}
    )

    if spray_priority == "Immediate":
        await db.alerts.insert_one(
            {
                "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                "module": "PrecisionFarming",
                "severity": "Critical",
                "title": "Pest/Disease Outbreak Risk",
                "message": f"Field {payload.field_id} requires immediate scouting and spray action.",
                "linked_entity_id": payload.field_id,
                "status": "Open",
                "created_at": now_iso,
            }
        )

    return {**result, "log_id": str(write_result.inserted_id)}


@router.get("/history")
async def precision_history(page: int = 1, limit: int = 20):
    db = get_db()
    skip = (page - 1) * limit
    cursor = db.precision_farming_logs.find({}).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))
    total = await db.precision_farming_logs.count_documents({})
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/history/{log_id}/report")
async def precision_report(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report id")
    doc = await db.precision_farming_logs.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"log_id": log_id, "report": doc.get("report") or doc.get("output", {}).get("report")}

@router.delete("/history/{log_id}")
async def delete_precision_history(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log id")
    result = await db.precision_farming_logs.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Precision analysis deleted", "log_id": log_id}


@router.get("/stats")
async def precision_stats():
    db = get_db()
    total = await db.precision_farming_logs.count_documents({})
    high_risk = await db.precision_farming_logs.count_documents({"output.risk_band": "High"})

    avg_yield = 0.0
    pipeline = [{"$group": {"_id": None, "avg_yield": {"$avg": "$output.predicted_seed_output_t_ha"}}}]
    async for doc in db.precision_farming_logs.aggregate(pipeline):
        avg_yield = round(float(doc.get("avg_yield", 0.0)), 2)

    return {"total_analyses": total, "high_risk_fields": high_risk, "avg_predicted_yield_t_ha": avg_yield}
