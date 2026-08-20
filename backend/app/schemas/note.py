from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ResumableUploadUrlRequest(BaseModel):
    file_name: str
    content_type: str = "audio/m4a"

class ResumableUploadUrlResponse(BaseModel):
    upload_url: str
    file_key: str
    expires_in_seconds: int = 3600

class DirectUploadResponse(BaseModel):
    file_path: str
    file_key: str
    size_bytes: int

class ProcessNoteRequest(BaseModel):
    local_id: str
    business_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    project_id: Optional[str] = None
    created_at: Optional[str] = None
    client_audio_path: str
    content_audio_path: str
    actions_audio_path: str

class RawTranscript(BaseModel):
    client: str
    content: str
    actions: str

class StructuredNoteResponse(BaseModel):
    id: str
    local_id: Optional[str] = None
    business_id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    project_id: Optional[str] = None
    client_or_project: str
    raw_transcript: RawTranscript
    summary: str
    action_items: List[str]
    category: str
    urgency: str  # LOW, MEDIUM, HIGH
    created_at: str
    processed_at: str
