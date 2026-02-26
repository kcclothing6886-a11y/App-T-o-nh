from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
import os
import uuid
from typing import List

app = FastAPI(title="Outfit Swap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("results", exist_ok=True)

# Mock task status storage
tasks_db = {}

@app.post("/api/v1/tryon")
async def create_tryon_task(
    model_img: UploadFile = File(...),
    garment_img: UploadFile = File(...),
    mode: str = Form("tryon")
):
    task_id = str(uuid.uuid4())
    model_path = f"uploads/{task_id}_model.jpg"
    garment_path = f"uploads/{task_id}_garment.jpg"
    
    with open(model_path, "wb") as buffer:
        shutil.copyfileobj(model_img.file, buffer)
    with open(garment_path, "wb") as buffer:
        shutil.copyfileobj(garment_img.file, buffer)
        
    # In a real app, send to Celery worker:
    # task = process_tryon_task.delay(task_id, model_path, garment_path, mode)
    
    tasks_db[task_id] = {"status": "processing"}
    
    return {"task_id": task_id, "status": "processing"}

@app.get("/api/v1/tasks/{task_id}")
async def get_task_status(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return task

@app.post("/api/v1/batch")
async def create_batch_task(
    model_img: UploadFile = File(...),
    garment_imgs: List[UploadFile] = File(...)
):
    batch_id = str(uuid.uuid4())
    # Process multiple garments for one model
    return {"batch_id": batch_id, "garments_count": len(garment_imgs)}

@app.post("/api/v1/video")
async def export_video(payload: dict):
    # Generate Ken Burns effect video from result image
    image_url = payload.get("image_url")
    duration = payload.get("duration", 5)
    return {"status": "processing", "message": f"Generating {duration}s video"}
