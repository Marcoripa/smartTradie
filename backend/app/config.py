import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartTradie Hands-Free Voice Note API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # GCP Configs
    GCP_PROJECT_ID: Optional[str] = os.getenv("GCP_PROJECT_ID", "smart-tradie-dev")
    GCS_BUCKET_NAME: Optional[str] = os.getenv("GCS_BUCKET_NAME", "smart-tradie-voice-notes")
    
    # AI Engine Keys
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")
    
    # Local Uploads Storage Directory (Fallback when GCS credentials not set)
    LOCAL_UPLOADS_DIR: str = os.getenv("LOCAL_UPLOADS_DIR", "./uploaded_audio")
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

os.makedirs(settings.LOCAL_UPLOADS_DIR, exist_ok=True)
