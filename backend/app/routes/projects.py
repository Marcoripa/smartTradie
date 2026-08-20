from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.firestore import firestore_service

router = APIRouter(prefix="/projects", tags=["Projects & Voice Notes"])

class MaterialApprovalRequest(BaseModel):
    voice_log_id: str
    material_id: str
    deduct_inventory: bool = True

@router.get("")
async def get_projects(business_id: str = Query(...)):
    projects = await firestore_service.list_collection(f"businesses/{business_id}/projects")
    print(projects)
    notes = await firestore_service.list_collection(f"businesses/{business_id}/notes")
    
    # Attach voice logs to their respective projects
    for p in projects:
        p_id = p.get("id") or p.get("_firestore_id")
        p_name = p.get("name", "").lower()
        p["voice_logs"] = [
            n for n in notes
            if n.get("project_id") == p_id or n.get("matched_project_id") == p_id or n.get("project_name", "").lower() == p_name
        ]
    return projects

@router.post("")
async def create_project(project: Dict[str, Any], business_id: str = Query(...)):
    project_id = project.get("id") or f"proj_{len(project)}"
    project["id"] = project_id
    project["business_id"] = business_id
    if not project.get("status"):
        project["status"] = "IN_PROGRESS"
    await firestore_service.save_document(f"businesses/{business_id}/projects/{project_id}", project)
    return project

@router.get("/{project_id}")
async def get_project(project_id: str, business_id: str = Query(...)):
    p = await firestore_service.get_document(f"businesses/{business_id}/projects/{project_id}")
    if not p:
        raise HTTPException(status_code=404, detail="Project not found in Firestore")
    
    # Attach voice notes
    notes = await firestore_service.list_collection(f"businesses/{business_id}/notes")
    p_name = p.get("name", "").lower()
    p["voice_logs"] = [
        n for n in notes
        if n.get("project_id") == project_id or n.get("matched_project_id") == project_id or n.get("project_name", "").lower() == p_name
    ]
    return p

@router.put("/{project_id}")
async def update_project(project_id: str, updates: Dict[str, Any], business_id: str = Query(...)):
    path = f"businesses/{business_id}/projects/{project_id}"
    p = await firestore_service.get_document(path)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found in Firestore")
    p.update(updates)
    await firestore_service.save_document(path, p)
    return p

@router.delete("/{project_id}")
async def delete_project(project_id: str, business_id: str = Query(...)):
    success = await firestore_service.delete_document(f"businesses/{business_id}/projects/{project_id}")
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted", "id": project_id}

@router.get("/{project_id}/voice-notes")
async def get_project_voice_notes(project_id: str, business_id: str = Query(...)):
    notes = await firestore_service.list_collection(f"businesses/{business_id}/notes")
    return [n for n in notes if n.get("project_id") == project_id or n.get("matched_project_id") == project_id]

@router.post("/{project_id}/materials/approve")
async def approve_material(project_id: str, req: MaterialApprovalRequest, business_id: str = Query(...)):
    note_path = f"businesses/{business_id}/notes/{req.voice_log_id}"
    note = await firestore_service.get_document(note_path)
    
    if not note:
        raise HTTPException(status_code=404, detail="Voice note not found in Firestore")
    
    materials = note.get("extracted_materials", [])
    target_mat = None
    
    for mat in materials:
        if isinstance(mat, dict) and mat.get("id") == req.material_id:
            mat["approved"] = True
            if req.deduct_inventory:
                mat["inventory_deducted"] = True
                
                sku = mat.get("matched_inventory_sku")
                if sku:
                    inv_path = f"businesses/{business_id}/inventory/{sku}"
                    item = await firestore_service.get_document(inv_path)
                    if item:
                        current_qty = item.get("stock_quantity", 0)
                        item["stock_quantity"] = max(0, current_qty - mat.get("quantity", 1))
                        await firestore_service.save_document(inv_path, item)
            target_mat = mat
            break

    if target_mat:
        note["extracted_materials"] = materials
        await firestore_service.save_document(note_path, note)
        return {"status": "approved", "material": target_mat}

    raise HTTPException(status_code=404, detail="Material ID not found in note")
