from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.firestore import firestore_service
from app.services.crypto import hash_password, verify_password
from app.config import settings

router = APIRouter(prefix="", tags=["Auth & Admin Users"])

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    business_id: Optional[str] = None

class UserDTO(BaseModel):
    id: str
    name: str
    email: str
    password: Optional[str] = None
    password_hash: Optional[str] = None
    phone: Optional[str] = ""
    role: str
    business_id: str
    business_name: Optional[str] = None
    hourly_wage: Optional[float] = 52.0
    charge_out_rate: Optional[float] = 125.0
    active: bool = True

@router.post("/auth/login")
async def login(req: LoginRequest):
    clean_email = req.email.lower().strip() if req.email else ""
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required.")
        
    matched = None
    
    # 1. Search by business_id if provided
    if req.business_id:
        users = await firestore_service.list_collection(f"businesses/{req.business_id}/users")
        matched = next((u for u in users if u.get("email", "").lower().strip() == clean_email), None)
        
    # 2. If not found or business_id not specified, search across users collectionGroup
    if not matched:
        query_url = f"https://firestore.googleapis.com/v1/projects/{settings.GCP_PROJECT_ID}/databases/{settings.FIRESTORE_DATABASE_ID}/documents:runQuery"
        payload = {
            "structuredQuery": {
                "from": [{"collectionId": "users", "allDescendants": True}],
                "where": {
                    "fieldFilter": {
                        "field": {"fieldPath": "email"},
                        "op": "EQUAL",
                        "value": {"stringValue": clean_email}
                    }
                },
                "limit": 1
            }
        }
        import httpx
        from app.services.firestore import from_firestore_fields
        async with httpx.AsyncClient(timeout=10.0, headers=firestore_service._get_headers()) as client:
            res = await client.post(query_url, json=payload)
            if res.status_code == 200:
                results = res.json()
                for item in results:
                    if "document" in item:
                        doc = item["document"]
                        matched = from_firestore_fields(doc.get("fields", {}))
                        path_parts = doc.get("name", "").split("/")
                        if "businesses" in path_parts:
                            idx = path_parts.index("businesses")
                            matched["business_id"] = path_parts[idx + 1]
                        matched["id"] = path_parts[-1]
                        break

    if not matched:
        raise HTTPException(status_code=401, detail=f"No account found for '{clean_email}'. Please check your credentials.")

    # Cryptographic password check
    stored_secret = matched.get("password_hash") or matched.get("password")
    if stored_secret:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password is required.")
        if not verify_password(req.password, stored_secret):
            raise HTTPException(status_code=401, detail="Incorrect password. Please verify your credentials.")
        
        # Upgrade plaintext to PBKDF2 hash on Firestore if needed
        if not stored_secret.startswith("pbkdf2_sha256$"):
            biz_id = matched.get("business_id")
            user_id = matched.get("id")
            if biz_id and user_id:
                new_hash = hash_password(req.password)
                matched["password_hash"] = new_hash
                matched.pop("password", None)
                await firestore_service.save_document(f"businesses/{biz_id}/users/{user_id}", matched)

    # Never return plain text password in login response
    matched.pop("password", None)

    return {
        "access_token": f"jwt_bearer_{matched.get('id', 'usr')}",
        "token_type": "Bearer",
        "user": matched
    }

@router.get("/admin/users")
async def list_users(business_id: str):
    if not business_id:
        raise HTTPException(status_code=400, detail="business_id query parameter is required.")
    users = await firestore_service.list_collection(f"businesses/{business_id}/users")
    # Clean passwords from list view
    for u in users:
        u.pop("password", None)
    return users

@router.post("/admin/users")
async def create_user(user: UserDTO, business_id: str):
    if not business_id:
        raise HTTPException(status_code=400, detail="business_id query parameter is required.")
    user_dict = user.dict()
    user_dict["business_id"] = business_id
    
    if user_dict.get("password"):
        user_dict["password_hash"] = hash_password(user_dict["password"])
        del user_dict["password"]

    await firestore_service.save_document(f"businesses/{business_id}/users/{user.id}", user_dict)
    user_dict.pop("password", None)
    return user_dict

@router.put("/admin/users/{user_id}")
async def update_user(user_id: str, updates: Dict[str, Any], business_id: str):
    if not business_id:
        raise HTTPException(status_code=400, detail="business_id query parameter is required.")
    path = f"businesses/{business_id}/users/{user_id}"
    existing = await firestore_service.get_document(path)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found in Firestore")
        
    if updates.get("password"):
        updates["password_hash"] = hash_password(updates["password"])
        del updates["password"]

    existing.update(updates)
    await firestore_service.save_document(path, existing)
    existing.pop("password", None)
    return existing

@router.get("/businesses/{business_id}")
async def get_business_profile(business_id: str):
    doc = await firestore_service.get_document(f"businesses/{business_id}")
    if not doc:
        return {"id": business_id, "business_name": "Business Profile", "abn": ""}
    return doc

