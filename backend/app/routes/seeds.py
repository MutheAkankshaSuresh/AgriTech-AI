from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Form
from typing import Optional, List
from app.database import get_db
from app.models.schemas import (
    SeedBatchCreate,
    PredictionRequest,
    GPForecastRequest,
)
from datetime import datetime
from bson import ObjectId

router = APIRouter()

def serialize_doc(doc):
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def normalize_input_source(value: Optional[str]) -> str:
    source = (value or "manual").strip().lower()
    return "iot" if source == "iot" else "manual"


def build_seed_report(context: str, values: dict, now_iso: str):
    gp = float(values.get("predicted_gp_percent", 0))
    defect = values.get("defect_class", "Pending Image Analysis")
    confidence = float(values.get("confidence_score", values.get("confidence", 0)))
    pass_fail = values.get("pass_fail", "NA")
    moisture = values.get("moisture_percent")
    steps = []
    issue = "Seed batch looks healthy."
    why = "AI prediction and image checks do not show a major quality risk."

    if defect in ("Shriveled", "Cracked", "Discolored", "Mild Discoloration"):
        issue = f"Seed defect detected: {defect}."
    elif gp < 70:
        issue = "Very low germination chance."
    elif gp < 80:
        issue = "Germination is below the safe target."
    elif defect == "Pending Image Analysis":
        issue = "Image quality check is still pending."

    if gp < 70:
        why = "Low germination prediction means many seeds may fail to sprout."
    elif defect == "Shriveled":
        why = "Shriveled seeds usually happen due to stress during seed fill, poor drying, or storage issues."
    elif defect == "Cracked":
        why = "Cracks often come from rough handling, mechanical damage, or over-dry seed lots."
    elif defect in ("Discolored", "Mild Discoloration"):
        why = "Discoloration can happen due to moisture, fungal load, or prolonged poor storage."
    elif defect == "Pending Image Analysis":
        why = "No final defect verdict is available until image analysis is completed."

    if moisture is not None and float(moisture) > 11:
        why = f"{why} Moisture ({moisture}%) is also high for safe storage."

    if gp < 70:
        steps.append("Stop batch dispatch now and run confirmatory germination lab test.")
    elif gp < 80:
        steps.append("Do one more QA check before approval.")
    else:
        steps.append("Batch can move with normal QC monitoring.")
    if defect not in ("Healthy", "Pending Image Analysis", "ModelError"):
        steps.append("Separate affected bags and re-sort visually to remove damaged seeds.")
    if confidence < 0.65:
        steps.append("Take more samples/images and verify manually because AI confidence is low.")
    if moisture is not None and float(moisture) > 11:
        steps.append("Dry seeds to safe moisture and improve ventilation in storage.")

    return {
        "title": f"Seed Quality Report - {context}",
        "summary": f"GP {gp:.1f}%, verdict {pass_fail}, defect class {defect}, confidence {confidence:.2f}.",
        "issue_found": issue,
        "why_it_happened": why,
        "prevention_steps": steps,
        "improvement_steps": steps,
        "business_impact": "Prevents low-quality batch release and reduces inventory loss risk.",
        "generated_at": now_iso,
    }


def chamber_a_to_predict_features(payload: dict) -> dict:
    return {
        "moisture_percent": payload.get("seed_moisture_percent", payload.get("moisture_percent", 8.0)),
        "thousand_seed_weight_g": payload.get("thousand_seed_weight_g", payload.get("seed_weight_g", 100.0)),
        "physical_purity_percent": payload.get("physical_purity_percent", 98.0),
        "storage_temperature_c": payload.get("temperature_c", 20.0),
        "storage_humidity_percent": payload.get("humidity_percent", 50.0),
        "days_since_harvest": payload.get("storage_days", payload.get("days_since_harvest", 30)),
        "crop_type": payload.get("crop_type", "Cotton"),
    }


# ---------------- IoT ingestion ----------------
@router.post("/iot/ingest")
async def ingest_iot_reading(payload: dict):
    db = get_db()
    now_iso = datetime.now().isoformat()
    reading = {
        "device_id": (payload.get("device_id") or "unknown-device").strip(),
        "batch_id": payload.get("batch_id"),
        "crop_type": payload.get("crop_type"),
        "temperature_c": payload.get("temperature_c"),
        "humidity_percent": payload.get("humidity_percent"),
        "moisture_percent": payload.get("moisture_percent", payload.get("seed_moisture_percent")),
        "seed_moisture_percent": payload.get("seed_moisture_percent"),
        "storage_days": payload.get("storage_days"),
        "chamber": payload.get("chamber"),
        "sensor_payload": payload.get("sensor_payload"),
        "seed_weight_g": payload.get("seed_weight_g"),
        "sample_size": payload.get("sample_size"),
        "image_name": payload.get("image_name"),
        "image_url": payload.get("image_url"),
        "image_base64": payload.get("image_base64"),
        "image_content_type": payload.get("image_content_type") or "image/jpeg",
        "captured_at": payload.get("captured_at") or now_iso,
        "input_source": "iot",
        "created_at": now_iso,
    }
    result = await db.iot_readings.insert_one(reading)
    return {"message": "IoT reading stored", "reading_id": str(result.inserted_id), "saved": True}


@router.get("/iot/latest")
async def get_latest_iot_reading(device_id: str = None):
    db = get_db()
    query = {}
    if device_id:
        query["device_id"] = device_id
    doc = await db.iot_readings.find_one(query, sort=[("created_at", -1)])
    if not doc:
        return {"reading": None}
    return {"reading": serialize_doc(doc)}


@router.get("/iot/history")
async def get_iot_history(device_id: str = None, page: int = 1, limit: int = 20):
    db = get_db()
    query = {}
    if device_id:
        query["device_id"] = device_id
    skip = (page - 1) * limit
    cursor = db.iot_readings.find(query).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))
    total = await db.iot_readings.count_documents(query)
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.post("/iot/chamber-a/readings")
async def ingest_chamber_a_reading(payload: dict, request: Request):
    db = get_db()
    now_iso = datetime.now().isoformat()
    normalized = {
        "device_id": (payload.get("device_id") or "unknown-device").strip(),
        "batch_id": payload.get("batch_id"),
        "crop_type": payload.get("crop_type", "Cotton"),
        "temperature_c": payload.get("temperature_c", payload.get("temperature")),
        "humidity_percent": payload.get("humidity_percent", payload.get("humidity")),
        "seed_moisture_percent": payload.get("seed_moisture_percent", payload.get("seed_moisture", payload.get("moisture_percent"))),
        "storage_days": payload.get("storage_days", 0),
        "light_level": payload.get("light_level"),
        "co2_ppm": payload.get("co2_ppm"),
        "total_seeds": payload.get("total_seeds"),
        "captured_at": payload.get("captured_at"),
        "sensor_payload": payload.get("sensor_payload"),
    }
    if normalized["temperature_c"] is None or normalized["humidity_percent"] is None or normalized["seed_moisture_percent"] is None:
        raise HTTPException(status_code=400, detail="temperature, humidity and seed_moisture are required")

    captured_at = normalized.get("captured_at") or now_iso

    saved = {
        **normalized,
        "captured_at": captured_at,
        "created_at": now_iso,
        "chamber": "A",
        "input_source": "iot",
    }
    result = await db.iot_chamber_a_readings.insert_one(saved)

    ml_service = request.app.state.ml_service
    prediction = ml_service.predict_gp(chamber_a_to_predict_features(normalized))

    await db.ai_prediction_logs.insert_one(
        {
            "analysis_type": "tabular",
            "batch_id": normalized.get("batch_id"),
            "input_source": "iot",
            "device_id": normalized.get("device_id"),
            "chamber": "A",
            "iot_reading_id": str(result.inserted_id),
            "input": normalized,
            "output": prediction,
            "report": build_seed_report(
                normalized.get("batch_id") or normalized.get("device_id") or "Chamber A Reading",
                {**prediction, "moisture_percent": normalized.get("seed_moisture_percent")},
                now_iso,
            ),
            "created_at": now_iso,
        }
    )

    return {
        "message": "Chamber A reading stored",
        "reading_id": str(result.inserted_id),
        "prediction": prediction,
        "saved": True,
    }


@router.get("/iot/chamber-a/latest")
async def get_latest_chamber_a_reading(device_id: Optional[str] = None):
    db = get_db()
    query = {"chamber": "A"}
    if device_id:
        query["device_id"] = device_id
    doc = await db.iot_chamber_a_readings.find_one(query, sort=[("created_at", -1)])
    return {"reading": serialize_doc(doc) if doc else None}


@router.get("/iot/chamber-a/history")
async def get_chamber_a_history(device_id: Optional[str] = None, page: int = 1, limit: int = 20):
    db = get_db()
    query = {"chamber": "A"}
    if device_id:
        query["device_id"] = device_id
    skip = (page - 1) * limit
    cursor = db.iot_chamber_a_readings.find(query).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))
    total = await db.iot_chamber_a_readings.count_documents(query)
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.post("/iot/chamber-b/images")
async def ingest_chamber_b_image(payload: dict):
    db = get_db()
    now_iso = datetime.now().isoformat()
    total_seeds = payload.get("total_seeds")
    germinated_seeds = payload.get("germinated_seeds", payload.get("sprouted_seeds"))
    actual_gp_percent = None
    if total_seeds and germinated_seeds is not None and float(total_seeds) > 0:
        actual_gp_percent = round((float(germinated_seeds) / float(total_seeds)) * 100, 1)

    row = {
        "device_id": (payload.get("device_id") or "unknown-device").strip(),
        "batch_id": payload.get("batch_id"),
        "image_name": payload.get("image_name", payload.get("image", "capture.jpg")),
        "image_url": payload.get("image_url"),
        "image_base64": payload.get("image_base64"),
        "image_content_type": payload.get("image_content_type", "image/jpeg"),
        "total_seeds": total_seeds,
        "germinated_seeds": germinated_seeds,
        "sprouted_seeds": germinated_seeds,
        "damaged_seeds": payload.get("damaged_seeds"),
        "mold_presence": payload.get("mold_presence"),
        "color_uniformity": payload.get("color_uniformity"),
        "defect_percentages": payload.get("defect_percentages"),
        "cnn_defect": payload.get("cnn_defect"),
        "defect_class": payload.get("defect_class"),
        "actual_gp_percent": actual_gp_percent,
        "metadata": payload.get("metadata"),
        "captured_at": payload.get("captured_at"),
    }
    row["captured_at"] = row.get("captured_at") or now_iso
    row["created_at"] = now_iso
    row["chamber"] = "B"
    row["input_source"] = "iot"
    result = await db.iot_chamber_b_images.insert_one(row)
    return {"message": "Chamber B image metadata stored", "image_id": str(result.inserted_id), "saved": True}


@router.get("/iot/chamber-b/latest")
async def get_latest_chamber_b_image(device_id: Optional[str] = None):
    db = get_db()
    query = {"chamber": "B"}
    if device_id:
        query["device_id"] = device_id
    doc = await db.iot_chamber_b_images.find_one(query, sort=[("created_at", -1)])
    return {"record": serialize_doc(doc) if doc else None}


@router.get("/iot/chamber-b/history")
async def get_chamber_b_history(device_id: Optional[str] = None, page: int = 1, limit: int = 20):
    db = get_db()
    query = {"chamber": "B"}
    if device_id:
        query["device_id"] = device_id
    skip = (page - 1) * limit
    cursor = db.iot_chamber_b_images.find(query).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))
    total = await db.iot_chamber_b_images.count_documents(query)
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


# ---------------- Get all batches ----------------
@router.get("/batches")
async def get_all_batches(status: str = None, crop_type: str = None, page: int = 1, limit: int = 10):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if crop_type:
        query["crop_type"] = crop_type

    skip = (page - 1) * limit
    cursor = db.seed_batches.find(query).skip(skip).limit(limit).sort("created_at", -1)
    batches = []
    async for doc in cursor:
        batches.append(serialize_doc(doc))

    total = await db.seed_batches.count_documents(query)
    return {"batches": batches, "total": total, "page": page, "pages": (total + limit - 1) // limit}

# ---------------- Get single batch ----------------
@router.get("/batches/{batch_id}")
async def get_batch(batch_id: str):
    db = get_db()
    doc = await db.seed_batches.find_one({"batch_id": batch_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Batch not found")
    return serialize_doc(doc)

# ---------------- Create new batch ----------------
@router.post("/batches")
async def create_batch(batch: SeedBatchCreate, request: Request):
    db = get_db()
    existing = await db.seed_batches.find_one({"batch_id": batch.batch_id})
    if existing:
        raise HTTPException(status_code=400, detail="Batch ID already exists")

    ml_service = request.app.state.ml_service
    days_since_harvest = (datetime.now() - datetime.strptime(batch.harvest_date, "%Y-%m-%d")).days

    # GP prediction
    prediction = ml_service.predict_gp({
        "moisture_percent": batch.lab_results.moisture_percent,
        "thousand_seed_weight_g": batch.lab_results.thousand_seed_weight_g,
        "physical_purity_percent": batch.lab_results.physical_purity_percent,
        "storage_temperature_c": batch.storage.temperature_c,
        "storage_humidity_percent": batch.storage.humidity_percent,
        "days_since_harvest": days_since_harvest,
        "crop_type": batch.crop_type
    })

    batch_doc = batch.model_dump()
    input_source = normalize_input_source(batch.input_source)
    batch_doc["input_source"] = input_source
    batch_doc["device_id"] = (batch.device_id or "").strip() or None
    batch_doc["captured_at"] = batch.captured_at or datetime.now().isoformat()
    batch_doc["sample_size"] = batch.sample_size
    batch_doc["iot_reading_id"] = batch.iot_reading_id
    batch_doc["sensor_payload"] = batch.sensor_payload
    batch_doc["ai_prediction"] = {
        "predicted_gp_percent": prediction["predicted_gp_percent"],
        "defect_class": "Pending Image Analysis",
        "confidence_score": prediction["confidence_score"],
        "pass_fail": prediction["pass_fail"],
        "model_version": "v2.1"
    }
    batch_doc["quality_report"] = build_seed_report(
        batch.batch_id,
        {
            "predicted_gp_percent": prediction["predicted_gp_percent"],
            "pass_fail": prediction["pass_fail"],
            "defect_class": "Pending Image Analysis",
            "confidence_score": prediction["confidence_score"],
            "moisture_percent": batch.lab_results.moisture_percent,
        },
        datetime.now().isoformat(),
    )
    batch_doc["status"] = "Approved" if prediction["pass_fail"] == "PASS" else "Rejected"
    batch_doc["created_at"] = datetime.now().isoformat()

    result = await db.seed_batches.insert_one(batch_doc)

    # Alert if failed
    if prediction["pass_fail"] == "FAIL":
        await db.alerts.insert_one({
            "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "module": "SeedQuality",
            "severity": "Critical",
            "title": "Batch GP Below Threshold",
            "message": f"Batch {batch.batch_id} predicted GP is {prediction['predicted_gp_percent']}% — below 70% minimum.",
            "linked_entity_id": batch.batch_id,
            "status": "Open",
            "created_at": datetime.now().isoformat()
        })

    return {"message": "Batch created", "batch_id": batch.batch_id, "prediction": prediction}

# ---------------- GP prediction only ----------------
@router.post("/predict")
async def predict_gp(data: PredictionRequest, request: Request):
    db = get_db()
    ml_service = request.app.state.ml_service
    result = ml_service.predict_gp(data.model_dump())
    now_iso = datetime.now().isoformat()
    input_source = normalize_input_source(data.input_source)

    log_doc = {
        "analysis_type": "tabular",
        "batch_id": data.batch_id,
        "input_source": input_source,
        "device_id": (data.device_id or "").strip() or None,
        "iot_reading_id": data.iot_reading_id,
        "sensor_payload": data.sensor_payload,
        "input": data.model_dump(),
        "output": result,
        "report": build_seed_report(
            data.batch_id or "Tabular Prediction",
            {**result, "moisture_percent": data.moisture_percent},
            now_iso,
        ),
        "created_at": now_iso
    }
    log_result = await db.ai_prediction_logs.insert_one(log_doc)

    batch_updated = False
    if data.batch_id:
        batch_exists = await db.seed_batches.find_one({"batch_id": data.batch_id})
        if batch_exists:
            await db.seed_batches.update_one(
                {"batch_id": data.batch_id},
                {
                    "$set": {
                        "ai_prediction.predicted_gp_percent": result["predicted_gp_percent"],
                        "ai_prediction.confidence_score": result["confidence_score"],
                        "ai_prediction.pass_fail": result["pass_fail"],
                        "input_source": input_source,
                        "device_id": (data.device_id or "").strip() or None,
                        "iot_reading_id": data.iot_reading_id,
                        "sensor_payload": data.sensor_payload,
                        "status": "Approved" if result["pass_fail"] == "PASS" else "Rejected",
                        "quality_report": build_seed_report(
                            data.batch_id,
                            {**result, "moisture_percent": data.moisture_percent},
                            now_iso,
                        ),
                        "updated_at": now_iso
                    }
                }
            )
            batch_updated = True

            if result["pass_fail"] == "FAIL":
                await db.alerts.insert_one({
                    "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "module": "SeedQuality",
                    "severity": "Critical",
                    "title": "Batch GP Below Threshold",
                    "message": f"Batch {data.batch_id} predicted GP is {result['predicted_gp_percent']}% below 70% minimum.",
                    "linked_entity_id": data.batch_id,
                    "status": "Open",
                    "created_at": now_iso
                })

    return {
        **result,
        "saved": True,
        "log_id": str(log_result.inserted_id),
        "batch_updated": batch_updated
    }


@router.post("/forecast")
async def forecast_gp(data: GPForecastRequest, request: Request):
    db = get_db()
    ml_service = request.app.state.ml_service
    now_iso = datetime.now().isoformat()

    base_features = {
        "crop_type": data.crop_type,
        "moisture_percent": data.seed_moisture_percent,
        "thousand_seed_weight_g": data.thousand_seed_weight_g,
        "physical_purity_percent": data.physical_purity_percent,
        "storage_temperature_c": data.temperature_c,
        "storage_humidity_percent": data.humidity_percent,
        "days_since_harvest": data.storage_days,
    }

    forecast = ml_service.predict_gp_timeline(base_features, data.forecast_days)
    result = {
        "batch_id": data.batch_id,
        "device_id": data.device_id,
        "current_gp_percent": forecast["current_gp_percent"],
        "quality_status": forecast["quality_status"],
        "timeline": forecast["timeline"],
        "recommendations": forecast["recommendations"],
    }

    await db.ai_prediction_logs.insert_one(
        {
            "analysis_type": "forecast",
            "batch_id": data.batch_id,
            "input_source": "iot" if data.device_id else "manual",
            "device_id": data.device_id,
            "input": data.model_dump(),
            "output": result,
            "created_at": now_iso,
        }
    )
    return result

# ---------------- Analyze image for a specific batch ----------------
@router.post("/batches/{batch_id}/analyze-image")
async def analyze_batch_image(batch_id: str, request: Request, file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    db = get_db()
    existing = await db.seed_batches.find_one({"batch_id": batch_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Batch not found")

    ml_service = request.app.state.ml_service
    image_bytes = await file.read()

    cnn_result = ml_service.predict_image_defect(image_bytes)
    yolo_result = ml_service.predict_image_yolo(image_bytes)

    defect_class = cnn_result.get("defect_class", "Pending Image Analysis")
    confidence = float(cnn_result.get("confidence", 0))
    now_iso = datetime.now().isoformat()

    report = build_seed_report(
        batch_id,
        {
            "predicted_gp_percent": existing.get("ai_prediction", {}).get("predicted_gp_percent", 0),
            "pass_fail": existing.get("ai_prediction", {}).get("pass_fail", "NA"),
            "defect_class": defect_class,
            "confidence_score": confidence,
            "moisture_percent": existing.get("lab_results", {}).get("moisture_percent"),
        },
        now_iso,
    )

    await db.seed_batches.update_one(
        {"batch_id": batch_id},
        {
            "$set": {
                "ai_prediction.defect_class": defect_class,
                "ai_prediction.confidence_score": round(confidence, 2),
                "image_analysis": {
                    "cnn_defect": cnn_result,
                    "yolo_detection": yolo_result,
                    "analyzed_at": now_iso
                },
                "quality_report": report,
                "updated_at": now_iso
            }
        }
    )

    log_doc = {
        "analysis_type": "image",
        "batch_id": batch_id,
        "file_name": file.filename,
        "content_type": file.content_type,
        "output": {
            "cnn_defect": cnn_result,
            "yolo_detection": yolo_result
        },
        "report": report,
        "created_at": now_iso
    }
    log_result = await db.ai_prediction_logs.insert_one(log_doc)

    if defect_class != "Healthy":
        await db.alerts.insert_one({
            "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "module": "SeedQuality",
            "severity": "Warning",
            "title": "Seed Defect Detected",
            "message": f"Batch {batch_id} image analysis detected defect class: {defect_class}.",
            "linked_entity_id": batch_id,
            "status": "Open",
            "created_at": now_iso
        })

    return {
        "message": "Image analyzed and batch updated",
        "batch_id": batch_id,
        "defect_class": defect_class,
        "confidence": round(confidence, 2),
        "cnn_defect": cnn_result,
        "yolo_detection": yolo_result,
        "report": report,
        "saved": True,
        "log_id": str(log_result.inserted_id)
    }

# ---------------- Image analysis (CNN + YOLO) ----------------
@router.post("/analyze-image")
async def analyze_seed_image(request: Request, file: UploadFile = File(...), batch_id: Optional[str] = Form(None)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    db = get_db()
    ml_service = request.app.state.ml_service
    image_bytes = await file.read()

    # CNN defect prediction
    cnn_result = ml_service.predict_image_defect(image_bytes)

    # YOLO detection (bounding boxes)
    yolo_result = ml_service.predict_image_yolo(image_bytes)

    defect_class = cnn_result.get("defect_class", "Pending Image Analysis")
    confidence = float(cnn_result.get("confidence", 0))
    now_iso = datetime.now().isoformat()

    log_doc = {
        "analysis_type": "image",
        "batch_id": batch_id,
        "file_name": file.filename,
        "content_type": file.content_type,
        "output": {
            "cnn_defect": cnn_result,
            "yolo_detection": yolo_result
        },
        "report": build_seed_report(
            batch_id or "Image Analysis",
            {
                "predicted_gp_percent": 0,
                "pass_fail": "NA",
                "defect_class": defect_class,
                "confidence_score": confidence,
            },
            now_iso,
        ),
        "created_at": now_iso
    }
    log_result = await db.ai_prediction_logs.insert_one(log_doc)

    batch_updated = False
    if batch_id:
        batch_exists = await db.seed_batches.find_one({"batch_id": batch_id})
        if batch_exists:
            await db.seed_batches.update_one(
                {"batch_id": batch_id},
                {
                    "$set": {
                        "ai_prediction.defect_class": defect_class,
                        "ai_prediction.confidence_score": round(confidence, 2),
                        "image_analysis": {
                            "cnn_defect": cnn_result,
                            "yolo_detection": yolo_result,
                            "analyzed_at": now_iso
                        },
                        "quality_report": build_seed_report(
                            batch_id,
                            {
                                "predicted_gp_percent": batch_exists.get("ai_prediction", {}).get("predicted_gp_percent", 0),
                                "pass_fail": batch_exists.get("ai_prediction", {}).get("pass_fail", "NA"),
                                "defect_class": defect_class,
                                "confidence_score": confidence,
                                "moisture_percent": batch_exists.get("lab_results", {}).get("moisture_percent"),
                            },
                            now_iso,
                        ),
                        "updated_at": now_iso
                    }
                }
            )
            batch_updated = True

            if defect_class != "Healthy":
                await db.alerts.insert_one({
                    "alert_id": f"ALT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "module": "SeedQuality",
                    "severity": "Warning",
                    "title": "Seed Defect Detected",
                    "message": f"Batch {batch_id} image analysis detected defect class: {defect_class}.",
                    "linked_entity_id": batch_id,
                    "status": "Open",
                    "created_at": now_iso
                })

    return {
        "cnn_defect": cnn_result,
        "yolo_detection": yolo_result,
        "saved": True,
        "log_id": str(log_result.inserted_id),
        "batch_updated": batch_updated
    }

# ---------------- Prediction history ----------------
@router.get("/prediction-history")
async def get_prediction_history(batch_id: str = None, crop_type: str = None, input_source: str = None, page: int = 1, limit: int = 20):
    db = get_db()
    query = {"analysis_type": "tabular"}
    if batch_id:
        query["batch_id"] = batch_id
    if crop_type:
        query["input.crop_type"] = crop_type
    if input_source:
        query["input_source"] = normalize_input_source(input_source)

    skip = (page - 1) * limit
    cursor = db.ai_prediction_logs.find(query).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))

    total = await db.ai_prediction_logs.count_documents(query)
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}

# ---------------- Image analysis history ----------------
@router.get("/image-history")
async def get_image_history(batch_id: str = None, defect_class: str = None, page: int = 1, limit: int = 20):
    db = get_db()
    query = {"analysis_type": "image"}
    if batch_id:
        query["batch_id"] = batch_id
    if defect_class:
        query["output.cnn_defect.defect_class"] = defect_class

    skip = (page - 1) * limit
    cursor = db.ai_prediction_logs.find(query).skip(skip).limit(limit).sort("created_at", -1)
    rows = []
    async for doc in cursor:
        rows.append(serialize_doc(doc))

    total = await db.ai_prediction_logs.count_documents(query)
    return {"records": rows, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/stats")
async def get_seed_stats():
    db = get_db()
    total = await db.seed_batches.count_documents({})
    passed = await db.seed_batches.count_documents({"status": "Approved"})
    failed = await db.seed_batches.count_documents({"status": "Rejected"})
    pending = await db.seed_batches.count_documents({"status": "Pending"})
    chamber_a_readings = await db.iot_chamber_a_readings.count_documents({})
    chamber_b_images = await db.iot_chamber_b_images.count_documents({})

    agg = None
    async for doc in db.seed_batches.aggregate(
        [{"$group": {"_id": None, "avg_gp": {"$avg": "$ai_prediction.predicted_gp_percent"}}}]
    ):
        agg = doc

    return {
        "total_batches": total,
        "passed_batches": passed,
        "failed_batches": failed,
        "pending_batches": pending,
        "avg_gp_percent": round((agg or {}).get("avg_gp", 0), 1),
        "chamber_a_readings": chamber_a_readings,
        "chamber_b_images": chamber_b_images,
    }


@router.get("/gp-trend")
async def get_gp_trend(limit: int = 20):
    db = get_db()
    cursor = db.seed_batches.find(
        {},
        {
            "batch_id": 1,
            "created_at": 1,
            "ai_prediction.predicted_gp_percent": 1,
            "ai_prediction.pass_fail": 1,
        },
    ).sort("created_at", -1).limit(limit)
    rows = []
    async for doc in cursor:
        rows.append(
            {
                "batch_id": doc.get("batch_id"),
                "date": doc.get("created_at"),
                "gp": doc.get("ai_prediction", {}).get("predicted_gp_percent", 0),
                "pass_fail": doc.get("ai_prediction", {}).get("pass_fail", "NA"),
            }
        )
    rows.reverse()
    return {"trend": rows}

@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str):
    db = get_db()
    result = await db.seed_batches.delete_one({"batch_id": batch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": f"Batch {batch_id} deleted", "batch_id": batch_id}

@router.delete("/prediction-history/{log_id}")
async def delete_prediction_history(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log id")
    result = await db.ai_prediction_logs.delete_one({"_id": oid, "analysis_type": "tabular"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prediction record not found")
    return {"message": "Prediction deleted", "log_id": log_id}

@router.delete("/image-history/{log_id}")
async def delete_image_history(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid log id")
    result = await db.ai_prediction_logs.delete_one({"_id": oid, "analysis_type": "image"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Image analysis record not found")
    return {"message": "Image analysis deleted", "log_id": log_id}


@router.get("/batches/{batch_id}/report")
async def get_batch_report(batch_id: str):
    db = get_db()
    doc = await db.seed_batches.find_one({"batch_id": batch_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Batch not found")
    report = doc.get("quality_report")
    if not report:
        report = build_seed_report(
            batch_id,
            {
                "predicted_gp_percent": doc.get("ai_prediction", {}).get("predicted_gp_percent", 0),
                "pass_fail": doc.get("ai_prediction", {}).get("pass_fail", "NA"),
                "defect_class": doc.get("ai_prediction", {}).get("defect_class", "Pending Image Analysis"),
                "confidence_score": doc.get("ai_prediction", {}).get("confidence_score", 0),
                "moisture_percent": doc.get("lab_results", {}).get("moisture_percent"),
            },
            datetime.now().isoformat(),
        )
    return {"batch_id": batch_id, "report": report}


@router.get("/prediction-history/{log_id}/report")
async def get_prediction_log_report(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report id")
    doc = await db.ai_prediction_logs.find_one({"_id": oid, "analysis_type": "tabular"})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    report = doc.get("report") or build_seed_report(
        doc.get("batch_id") or "Tabular Prediction",
        doc.get("output", {}),
        datetime.now().isoformat(),
    )
    return {"log_id": log_id, "report": report}


@router.get("/image-history/{log_id}/report")
async def get_image_log_report(log_id: str):
    db = get_db()
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report id")
    doc = await db.ai_prediction_logs.find_one({"_id": oid, "analysis_type": "image"})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    report = doc.get("report") or build_seed_report(
        doc.get("batch_id") or "Image Analysis",
        {
            "predicted_gp_percent": 0,
            "pass_fail": "NA",
            "defect_class": doc.get("output", {}).get("cnn_defect", {}).get("defect_class", "Unknown"),
            "confidence_score": doc.get("output", {}).get("cnn_defect", {}).get("confidence", 0),
        },
        datetime.now().isoformat(),
    )
    return {"log_id": log_id, "report": report}
