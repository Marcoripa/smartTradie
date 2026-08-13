import os
import datetime
from app.config import settings

try:
    from google.cloud import storage
    gcs_available = True
except ImportError:
    gcs_available = False

class GCSService:
    def __init__(self):
        self.bucket_name = settings.GCS_BUCKET_NAME
        self._client = None

    @property
    def client(self):
        if not self._client and gcs_available:
            try:
                self._client = storage.Client(project=settings.GCP_PROJECT_ID)
            except Exception as e:
                print(f"[GCS] Unable to initialize GCP Storage Client: {e}")
        return self._client

    def generate_resumable_upload_url(self, object_name: str, content_type: str = "audio/m4a") -> str:
        """
        Generate a GCS Resumable Signed Upload URL to allow mobile app to upload directly
        to GCP Storage over spotty 4G/5G connections without losing progress.
        """
        if self.client:
            try:
                bucket = self.client.bucket(self.bucket_name)
                blob = bucket.blob(object_name)
                url = blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(hours=1),
                    method="POST",
                    content_type=content_type,
                    headers={"x-goog-resumable": "start"}
                )
                return url
            except Exception as e:
                print(f"[GCS] Error generating signed URL, falling back: {e}")

        # Local fallback endpoint URL
        return f"{settings.API_PREFIX}/upload/direct"

    def save_local_file(self, file_content: bytes, filename: str) -> str:
        """Save audio file to local storage directory as fallback."""
        file_path = os.path.join(settings.LOCAL_UPLOADS_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(file_content)
        return file_path

gcs_service = GCSService()
