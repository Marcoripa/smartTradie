import httpx
import subprocess
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.config import settings

_cached_token: Optional[str] = None
_token_expiry: datetime = datetime.min

def get_gcp_access_token() -> Optional[str]:
    """
    Get a valid GCP access token via Application Default Credentials or gcloud CLI.
    """
    global _cached_token, _token_expiry
    if _cached_token and datetime.now() < _token_expiry:
        return _cached_token

    # 1. Try google.auth
    try:
        import google.auth
        import google.auth.transport.requests
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/datastore"])
        req = google.auth.transport.requests.Request()
        creds.refresh(req)
        if creds.token:
            _cached_token = creds.token
            _token_expiry = datetime.now() + timedelta(minutes=45)
            return _cached_token
    except Exception:
        pass

    # 2. Try gcloud CLI
    try:
        out = subprocess.check_output(
            ["gcloud", "auth", "print-access-token"],
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
        if out:
            _cached_token = out
            _token_expiry = datetime.now() + timedelta(minutes=45)
            return _cached_token
    except Exception:
        pass

    return None

def to_firestore_fields(obj: Dict[str, Any]) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}
    for key, value in obj.items():
        if value is None:
            fields[key] = {"nullValue": None}
        elif isinstance(value, bool):
            fields[key] = {"booleanValue": value}
        elif isinstance(value, int):
            fields[key] = {"integerValue": str(value)}
        elif isinstance(value, float):
            fields[key] = {"doubleValue": value}
        elif isinstance(value, str):
            fields[key] = {"stringValue": value}
        elif isinstance(value, list):
            items = []
            for item in value:
                if isinstance(item, str):
                    items.append({"stringValue": item})
                elif isinstance(item, bool):
                    items.append({"booleanValue": item})
                elif isinstance(item, int):
                    items.append({"integerValue": str(item)})
                elif isinstance(item, float):
                    items.append({"doubleValue": item})
                elif isinstance(item, dict):
                    items.append({"mapValue": {"fields": to_firestore_fields(item)}})
                else:
                    items.append({"stringValue": str(item)})
            fields[key] = {"arrayValue": {"values": items}}
        elif isinstance(value, dict):
            fields[key] = {"mapValue": {"fields": to_firestore_fields(value)}}
    return fields

def from_firestore_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
    obj: Dict[str, Any] = {}
    if not fields:
        return obj

    for key, val in fields.items():
        if "stringValue" in val:
            obj[key] = val["stringValue"]
        elif "integerValue" in val:
            obj[key] = int(val["integerValue"])
        elif "doubleValue" in val:
            obj[key] = float(val["doubleValue"])
        elif "booleanValue" in val:
            obj[key] = val["booleanValue"]
        elif "nullValue" in val:
            obj[key] = None
        elif "timestampValue" in val:
            obj[key] = val["timestampValue"]
        elif "arrayValue" in val:
            res_list = []
            for item_val in val["arrayValue"].get("values", []):
                if "stringValue" in item_val:
                    res_list.append(item_val["stringValue"])
                elif "integerValue" in item_val:
                    res_list.append(int(item_val["integerValue"]))
                elif "doubleValue" in item_val:
                    res_list.append(float(item_val["doubleValue"]))
                elif "booleanValue" in item_val:
                    res_list.append(item_val["booleanValue"])
                elif "mapValue" in item_val:
                    res_list.append(from_firestore_fields(item_val["mapValue"].get("fields", {})))
            obj[key] = res_list
        elif "mapValue" in val:
            obj[key] = from_firestore_fields(val["mapValue"].get("fields", {}))
    return obj

class FirestoreBackendService:
    def __init__(self):
        self.project_id = settings.GCP_PROJECT_ID
        self.database_id = settings.FIRESTORE_DATABASE_ID

    @property
    def base_url(self) -> str:
        return f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/{self.database_id}/documents"

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        token = get_gcp_access_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def get_document(self, relative_path: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/{relative_path.strip('/')}"
        async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
            res = await client.get(url)
            if res.status_code == 200:
                doc = res.json()
                data = from_firestore_fields(doc.get("fields", {}))
                data["_firestore_id"] = doc.get("name", "").split("/")[-1]
                return data
            return None

    async def list_collection(self, relative_path: str) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/{relative_path.strip('/')}"
        async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
            res = await client.get(url)
            if res.status_code == 200:
                body = res.json()
                docs = body.get("documents", [])
                results = []
                for doc in docs:
                    data = from_firestore_fields(doc.get("fields", {}))
                    doc_id = doc.get("name", "").split("/")[-1]
                    if "id" not in data:
                        data["id"] = doc_id
                    data["_firestore_id"] = doc_id
                    results.append(data)
                return results
            return []

    async def save_document(self, relative_path: str, data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/{relative_path.strip('/')}"
        fields = to_firestore_fields(data)
        async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
            res = await client.patch(url, json={"fields": fields})
            if res.status_code == 200:
                doc = res.json()
                return from_firestore_fields(doc.get("fields", {}))
            return data

    async def delete_document(self, relative_path: str) -> bool:
        url = f"{self.base_url}/{relative_path.strip('/')}"
        async with httpx.AsyncClient(timeout=10.0, headers=self._get_headers()) as client:
            res = await client.delete(url)
            return res.status_code == 200

firestore_service = FirestoreBackendService()
