from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.services.firestore import firestore_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("")
async def get_inventory(business_id: str = Query(...)):
    return await firestore_service.list_collection(f"businesses/{business_id}/inventory")

@router.post("")
async def create_inventory_item(item: Dict[str, Any], business_id: str = Query(...)):
    item_id = item.get("sku") or item.get("id") or f"inv_{len(item)}"
    item["id"] = item_id
    item["business_id"] = business_id
    
    cost = float(item.get("cost_price", 0))
    sell = float(item.get("sell_price", 0))
    if cost > 0:
        item["markup_percent"] = round(((sell - cost) / cost) * 100, 1)
        
    await firestore_service.save_document(f"businesses/{business_id}/inventory/{item_id}", item)
    return item

@router.put("/{item_id}")
async def update_inventory_item(item_id: str, updates: Dict[str, Any], business_id: str = Query(...)):
    path = f"businesses/{business_id}/inventory/{item_id}"
    item = await firestore_service.get_document(path)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found in Firestore")
    item.update(updates)
    
    cost = float(item.get("cost_price", 0))
    sell = float(item.get("sell_price", 0))
    if cost > 0:
        item["markup_percent"] = round(((sell - cost) / cost) * 100, 1)
        
    await firestore_service.save_document(path, item)
    return item

@router.delete("/{item_id}")
async def delete_inventory_item(item_id: str, business_id: str = Query(...)):
    success = await firestore_service.delete_document(f"businesses/{business_id}/inventory/{item_id}")
    if not success:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return {"status": "deleted", "id": item_id}
