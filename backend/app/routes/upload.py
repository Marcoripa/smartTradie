import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.note import ResumableUploadUrlRequest, ResumableUploadUrlResponse, DirectUploadResponse
from app.services.gcs_service import gcs_service

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("/get-presigned-url", response_model=ResumableUploadUrlResponse)
async def get_presigned_url(payload: ResumableUploadUrlRequest):
    """
    Returns a GCS Resumable Signed Upload URL for direct client-to-bucket upload.
    Ensures network interruptions in regional Australia can resume without re-uploading from scratch.
    """
    file_key = f"recordings/{uuid.uuid4().hex[:8]}_{payload.file_name}"
    upload_url = gcs_service.generate_resumable_upload_url(file_key, payload.content_type)
    
    return ResumableUploadUrlResponse(
        upload_url=upload_url,
        file_key=file_key,
        expires_in_seconds=3600
    )

@router.post("/direct", response_model=DirectUploadResponse)
async def direct_file_upload(file: UploadFile = File(...)):
    """
    Direct multipart file upload endpoint for local testing or non-GCS deployments.
    """
    try:
        content = await file.read()
        file_key = f"{uuid.uuid4().hex[:8]}_{file.filename or 'recording.m4a'}"
        saved_path = gcs_service.save_local_file(content, file_key)
        
        return DirectUploadResponse(
            file_path=saved_path,
            file_key=file_key,
            size_bytes=len(content)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
