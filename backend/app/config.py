import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "SmartTradie Tradie Business Management & Voice API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # GCP & Firestore Configs
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "smarttradie-505506")
    FIRESTORE_DATABASE_ID: str = os.getenv("FIRESTORE_DATABASE_ID", "smart-tradie")
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "smart-tradie")
    
    # AI Engine Keys
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", "")
    
    # Local Uploads Storage Directory
    LOCAL_UPLOADS_DIR: str = os.getenv("LOCAL_UPLOADS_DIR", "./uploaded_audio")
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

os.makedirs(settings.LOCAL_UPLOADS_DIR, exist_ok=True)
