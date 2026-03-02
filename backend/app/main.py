from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.database import connect_db, close_db
from app.routes import seeds, auth, dashboard, alerts, water, precision, climate
from app.services.ml_service import MLService

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    ml_service = MLService()
    await ml_service.load_models()
    app.state.ml_service = ml_service
    yield
    await close_db()

app = FastAPI(
    title="AgriTech AI Platform",
    description="AI-powered Seed Quality, Water Intelligence, Precision Farming & Climate Resilience",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth.router,      prefix="/api/auth",      tags=["Authentication"])
app.include_router(seeds.router,     prefix="/api/seeds",     tags=["Seed Quality"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(alerts.router,    prefix="/api/alerts",    tags=["Alerts"])
app.include_router(water.router,     prefix="/api/water",     tags=["Water Intelligence"])
app.include_router(precision.router, prefix="/api/precision", tags=["Precision Farming"])
app.include_router(climate.router,   prefix="/api/climate",   tags=["Climate Resilience"])

@app.get("/")
async def root():
    return {"message": "AgriTech AI Platform API", "version": "1.0.0", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
