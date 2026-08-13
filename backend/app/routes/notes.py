from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.note import ProcessNoteRequest, StructuredNoteResponse, RawTranscript
from app.services.stt_service import stt_service
from app.services.ai_service import ai_service
from app.services.db_service import db_service

router = APIRouter(prefix="/notes", tags=["Voice Notes"])

@router.post("/process", response_model=StructuredNoteResponse)
async def process_voice_note(payload: ProcessNoteRequest):
    """
    Receives 3 recorded audio segment paths/keys (Client Context, Main Content, Action Items),
    transcribes them using Speech-to-Text, structures them using Gemini 2.0 Flash,
    and persists the result in Firestore / Database.
    """
    try:
        print(f"[Backend] Processing voice note payload: {payload.local_id}")

        # 1. Transcribe audio files
        client_tx = await stt_service.transcribe_audio(payload.client_audio_path, prompt_context="Client or Project Name")
        content_tx = await stt_service.transcribe_audio(payload.content_audio_path, prompt_context="Main Engineering Voice Note")
        actions_tx = await stt_service.transcribe_audio(payload.actions_audio_path, prompt_context="Action Items and Next Steps")

        raw_transcript = RawTranscript(
            client=client_tx,
            content=content_tx,
            actions=actions_tx
        )

        # 2. Gemini 2.0 Flash AI Structuring
        structured = await ai_service.structure_voice_note(raw_transcript)

        # 3. Store in Database
        db_payload = {
            "local_id": payload.local_id,
            "created_at": payload.created_at,
            "client_or_project": structured.get("client_or_project", client_tx),
            "raw_transcript": raw_transcript.model_dump(),
            "summary": structured.get("summary", content_tx),
            "action_items": structured.get("action_items", []),
            "category": structured.get("category", "Field Note"),
            "urgency": structured.get("urgency", "MEDIUM"),
        }

        saved_note = await db_service.save_note(db_payload)
        return saved_note
    except Exception as e:
        print(f"[Backend] Error processing voice note: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process note: {str(e)}")

@router.get("", response_model=List[StructuredNoteResponse])
async def list_notes():
    """Returns list of synchronized voice notes."""
    return await db_service.list_notes()

@router.get("/{note_id}", response_model=StructuredNoteResponse)
async def get_note(note_id: str):
    """Retrieve details for a specific note."""
    note = await db_service.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note
