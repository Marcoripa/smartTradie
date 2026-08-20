import uuid
from datetime import datetime
from typing import Dict, List, Optional
from app.config import settings
from app.schemas.note import StructuredNoteResponse
from app.services.firestore import firestore_service

class DBService:
    def __init__(self):
        self._local_notes_db: Dict[str, dict] = {}

    async def save_note(self, note_data: dict) -> StructuredNoteResponse:
        note_id = note_data.get("local_id") or f"note_{uuid.uuid4().hex[:10]}"
        now_str = datetime.utcnow().isoformat() + "Z"
        biz_id = note_data.get("business_id") or "4hYresNm9x4jeTkMWtYy"

        record = {
            "id": note_id,
            "local_id": note_data.get("local_id"),
            "business_id": biz_id,
            "user_id": note_data.get("user_id", ""),
            "user_name": note_data.get("user_name", "Tradie"),
            "project_id": note_data.get("project_id", ""),
            "project_name": note_data.get("client_or_project", "Field Project"),
            "client_or_project": note_data.get("client_or_project", "Field Project"),
            "raw_transcript": note_data.get("raw_transcript"),
            "summary": note_data.get("summary"),
            "action_items": note_data.get("action_items", []),
            "category": note_data.get("category", "Field Note"),
            "urgency": note_data.get("urgency", "MEDIUM"),
            "created_at": note_data.get("created_at") or now_str,
            "processed_at": now_str,
        }

        # Save to business notes collection in Firestore
        try:
            await firestore_service.save_document(f"businesses/{biz_id}/notes/{note_id}", record)
            print(f"[DB] Saved note {note_id} to Firestore under businesses/{biz_id}/notes")
        except Exception as e:
            print(f"[DB] Firestore write failed: {e}")

        self._local_notes_db[note_id] = record
        return StructuredNoteResponse(**record)

    async def list_notes(self, business_id: Optional[str] = None) -> List[StructuredNoteResponse]:
        biz_id = business_id or "4hYresNm9x4jeTkMWtYy"
        try:
            docs = await firestore_service.list_collection(f"businesses/{biz_id}/notes")
            if docs:
                return [StructuredNoteResponse(**d) for d in docs]
        except Exception as e:
            print(f"[DB] Firestore query failed: {e}")

        sorted_records = sorted(
            self._local_notes_db.values(),
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        return [StructuredNoteResponse(**r) for r in sorted_records]

    async def get_note(self, note_id: str, business_id: Optional[str] = None) -> Optional[StructuredNoteResponse]:
        biz_id = business_id or "4hYresNm9x4jeTkMWtYy"
        try:
            doc = await firestore_service.get_document(f"businesses/{biz_id}/notes/{note_id}")
            if doc:
                return StructuredNoteResponse(**doc)
        except Exception:
            pass

        record = self._local_notes_db.get(note_id)
        if record:
            return StructuredNoteResponse(**record)
        return None

db_service = DBService()
