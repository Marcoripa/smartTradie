import json
from app.config import settings
from app.schemas.note import RawTranscript, StructuredNoteResponse

SYSTEM_INSTRUCTION = """
You are SmartTradie AI, an expert assistant for Australian field engineers, tradespeople, and regional drivers.
Convert raw, noisy spoken transcripts captured while driving into clean, highly structured JSON note objects.

Remove filler words (um, ah, like, spoken pauses).
Extract:
- client_or_project (Name of client, job site, or project)
- summary (2-3 clear sentences summarizing main technical details)
- action_items (List of concise, actionable follow-up tasks)
- category (e.g. Electrical Audit, Site Inspection, Equipment Maintenance, General Note)
- urgency (LOW, MEDIUM, or HIGH)

Return ONLY valid JSON matching this schema:
{
  "client_or_project": "string",
  "summary": "string",
  "action_items": ["string"],
  "category": "string",
  "urgency": "LOW" | "MEDIUM" | "HIGH"
}
"""

class AIService:
    async def structure_voice_note(self, raw_transcript: RawTranscript) -> dict:
        """
        Clean raw driving transcripts using Gemini 2.0 Flash into structured JSON.
        """
        combined_text = f"""
        [Context / Client Prompt Response]: {raw_transcript.client}
        [Main Content Prompt Response]: {raw_transcript.content}
        [Action Items Prompt Response]: {raw_transcript.actions}
        """

        if settings.GEMINI_API_KEY:
            try:
                from google import genai
                client = genai.Client(api_key=settings.GEMINI_API_KEY)
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[SYSTEM_INSTRUCTION, combined_text],
                    config={"response_mime_type": "application/json"}
                )
                if response.text:
                    parsed = json.loads(response.text)
                    return parsed
            except Exception as e:
                print(f"[AI] Gemini 2.0 Flash processing error: {e}")

        # Smart Fallback parsing logic
        actions_list = [a.strip() for a in raw_transcript.actions.split('.') if a.strip()]
        if not actions_list:
            actions_list = ["Review recorded voice notes upon return to depot"]

        urgency = "HIGH" if any(w in raw_transcript.content.lower() for w in ["leak", "fail", "urgent", "broken", "hazard"]) else "MEDIUM"

        return {
            "client_or_project": raw_transcript.client or "Regional Drive Voice Note",
            "summary": f"{raw_transcript.content.strip()}",
            "action_items": actions_list,
            "category": "Field Inspection",
            "urgency": urgency
        }

ai_service = AIService()
