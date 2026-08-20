import asyncio
import subprocess
import httpx
from app.services.firestore import from_firestore_fields
from app.config import settings

def get_token():
    try:
        out = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
        return out
    except Exception as e:
        print("Error getting gcloud token:", e)
        return None

async def check_db():
    token = get_token()
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print(f"🔑 Using gcloud Access Token ({token[:15]}...)")
    
    base_url = f"https://firestore.googleapis.com/v1/projects/{settings.GCP_PROJECT_ID}/databases/{settings.FIRESTORE_DATABASE_ID}/documents"
    
    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        # 1. List root businesses
        res = await client.get(f"{base_url}/businesses")
        print("\n--- Root /businesses ---")
        if res.status_code == 200:
            docs = res.json().get("documents", [])
            print(f"Found {len(docs)} businesses:")
            for d in docs:
                b_id = d["name"].split("/")[-1]
                data = from_firestore_fields(d.get("fields", {}))
                print(f"  • Business ID: {b_id} -> {data.get('business_name') or data.get('name')}")
                
                # Check users inside this business
                u_res = await client.get(f"{base_url}/businesses/{b_id}/users")
                if u_res.status_code == 200:
                    u_docs = u_res.json().get("documents", [])
                    print(f"    ↳ Users ({len(u_docs)}):")
                    for u in u_docs:
                        u_id = u["name"].split("/")[-1]
                        u_data = from_firestore_fields(u.get("fields", {}))
                        print(f"       - User ID: {u_id} | Email: {u_data.get('email')} | Name: {u_data.get('name')} | Role: {u_data.get('role')}")
                else:
                    print(f"    ↳ Users query status: {u_res.status_code}")
        else:
            print(f"Businesses query status: {res.status_code} - {res.text}")

        # 2. Check collectionGroup query on 'users'
        print("\n--- Collection Group Query ('users') ---")
        query_url = f"{base_url}:runQuery"
        payload = {
            "structuredQuery": {
                "from": [{"collectionId": "users", "allDescendants": True}],
                "limit": 50
            }
        }
        res = await client.post(query_url, json=payload)
        if res.status_code == 200:
            results = res.json()
            print(f"Collection group results count: {len(results)}")
            for item in results:
                if "document" in item:
                    doc = item["document"]
                    data = from_firestore_fields(doc.get("fields", {}))
                    print(f"  • Doc: {doc.get('name')} -> Email: {data.get('email')}, Name: {data.get('name')}")
        else:
            print(f"Collection group query status: {res.status_code} - {res.text}")

if __name__ == "__main__":
    asyncio.run(check_db())
