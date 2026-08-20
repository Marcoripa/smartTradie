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

        # 2. Strict Auth test: Non-existent user must fail with 401 (no auto-creation)
        res = await client.post("/api/v1/auth/login", json={"email": "nonexistent_user_999@domain.com"})
        print("Non-existent Auth Response:", res.status_code, "(Correctly rejected with 401)")
        assert res.status_code == 401

        # 3. Projects list endpoint
        res = await client.get("/api/v1/projects?business_id=4hYresNm9x4jeTkMWtYy")
        print("Projects Response:", res.status_code, "Items:", len(res.json()))
        assert res.status_code == 200

        # 4. Inventory list endpoint
        res = await client.get("/api/v1/inventory?business_id=4hYresNm9x4jeTkMWtYy")
        print("Inventory Response:", res.status_code, "Items:", len(res.json()))
        assert res.status_code == 200

        # 5. Invoices list endpoint
        res = await client.get("/api/v1/invoices?business_id=4hYresNm9x4jeTkMWtYy")
        print("Invoices Response:", res.status_code, "Items:", len(res.json()))
        assert res.status_code == 200

        # 6. Upload Presigned URL endpoint
        res = await client.post("/api/v1/upload/get-presigned-url", json={"file_name": "prompt_1_client.m4a"})
        print("Presigned URL Response:", res.status_code, res.json())
        assert res.status_code == 200

        print("\n🎉 ALL LIVE STRICT FIRESTORE BACKEND ENDPOINTS PASSED VERIFICATION!")

if __name__ == "__main__":
    asyncio.run(test_endpoints())
