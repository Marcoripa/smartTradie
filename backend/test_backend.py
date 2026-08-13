import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

async def test_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/v1/health")
        print("Health Response:", res.status_code, res.json())
        assert res.status_code == 200

        # 2. Upload Presigned URL endpoint
        res = await client.post("/api/v1/upload/get-presigned-url", json={"file_name": "prompt_1_client.m4a"})
        print("Presigned URL Response:", res.status_code, res.json())
        assert res.status_code == 200

        # 3. Direct upload endpoint
        files = {"file": ("test_recording.m4a", b"dummy audio content", "audio/m4a")}
        res = await client.post("/api/v1/upload/direct", files=files)
        print("Direct Upload Response:", res.status_code, res.json())
        assert res.status_code == 200
        file_path = res.json()["file_path"]

        # 4. Note processing endpoint (STT + Gemini 2.0 Flash)
        process_payload = {
            "local_id": "test_note_123",
            "client_audio_path": file_path,
            "content_audio_path": file_path,
            "actions_audio_path": file_path,
        }
        res = await client.post("/api/v1/notes/process", json=process_payload)
        print("Process Note Response:", res.status_code, res.json())
        assert res.status_code == 200

        # 5. List notes endpoint
        res = await client.get("/api/v1/notes")
        print("List Notes Response:", res.status_code, len(res.json()), "item(s)")
        assert res.status_code == 200

        print("\n🎉 ALL BACKEND ENDPOINTS PASSED VERIFICATION!")

if __name__ == "__main__":
    asyncio.run(test_endpoints())
