import uuid
from datetime import datetime
from typing import Dict, List, Optional
from app.config import settings
from app.schemas.note import StructuredNoteResponse

try:
    from google.cloud import firestore
    firestore_available = True
except ImportError:
    firestore_available = False

class DBService:
    def __init__(self):
        self._db = None
        self._local_notes_db: Dict[str, dict] = {}

    @property
    def db(self):
        if not self._db and firestore_available:
            try:
                self._db = firestore.Client(project=settings.GCP_PROJECT_ID)
            except Exception as e:
                print(f"[DB] Could not initialize Firestore Client: {e}")
        return self._db

    async def save_note(self, note_data: dict) -> StructuredNoteResponse:
        note_id = f"note_gcp_{uuid.uuid4().hex[:10]}"
        now_str = datetime.utcnow().isoformat() + "Z"

        record = {
            "id": note_id,
            "local_id": note_data.get("local_id"),
            "client_or_project": note_data.get("client_or_project"),
            "raw_transcript": note_data.get("raw_transcript"),
            "summary": note_data.get("summary"),
            "action_items": note_data.get("action_items", []),
            "category": note_data.get("category", "General"),
            "urgency": note_data.get("urgency", "MEDIUM"),
            "created_at": note_data.get("created_at") or now_str,
            "processed_at": now_str,
        }

        if self.db:
            try:
                self.db.collection("voice_notes").document(note_id).set(record)
                print(f"[DB] Saved note {note_id} to Firestore")
            except Exception as e:
                print(f"[DB] Firestore write failed: {e}")

        self._local_notes_db[note_id] = record
        return StructuredNoteResponse(**record)

    async def list_notes(self) -> List[StructuredNoteResponse]:
        if self.db:
            try:
                docs = self.db.collection("voice_notes").order_by("created_at", direction=firestore.Query.DESCENDING).stream()
                return [StructuredNoteResponse(**doc.to_dict()) for doc in docs]
            except Exception as e:
                print(f"[DB] Firestore query failed: {e}")

        sorted_records = sorted(
            self._local_notes_db.values(),
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        return [StructuredNoteResponse(**r) for r in sorted_records]

    async def get_note(self, note_id: str) -> Optional[StructuredNoteResponse]:
        if self.db:
            try:
                doc = self.db.collection("voice_notes").document(note_id).get()
                if doc.exists:
                    return StructuredNoteResponse(**doc.to_dict())
            except Exception:
                pass

        record = self._local_notes_db.get(note_id)
        if record:
            return StructuredNoteResponse(**record)
        return None

db_service = DBService()
