from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.services.firestore import firestore_service

router = APIRouter(prefix="/invoices", tags=["Invoices & ATO Tax Invoices"])

@router.get("")
async def get_invoices(business_id: str = Query(...)):
    return await firestore_service.list_collection(f"businesses/{business_id}/invoices")

@router.post("")
async def create_invoice(invoice: Dict[str, Any], business_id: str = Query(...)):
    invoice_id = invoice.get("id") or f"inv_{int(datetime.now().timestamp())}"
    invoice["id"] = invoice_id
    invoice["business_id"] = business_id
    await firestore_service.save_document(f"businesses/{business_id}/invoices/{invoice_id}", invoice)
    return invoice

@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, business_id: str = Query(...)):
    inv = await firestore_service.get_document(f"businesses/{business_id}/invoices/{invoice_id}")
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found in Firestore")
    return inv

@router.post("/generate-from-project/{project_id}")
async def generate_invoice_from_project(project_id: str, business_id: str = Query(...)):
    # 1. Fetch project from Firestore
    project = await firestore_service.get_document(f"businesses/{business_id}/projects/{project_id}")
    if not project:
        raise HTTPException(status_code=404, detail="Project not found in Firestore")
    
    # 2. Fetch business profile from Firestore
    seller = await firestore_service.get_document(f"businesses/{business_id}")
    if not seller:
        raise HTTPException(status_code=400, detail=f"Business profile not found in Firestore for business '{business_id}'.")
    
    # 3. Fetch project notes & approved materials
    notes = await firestore_service.list_collection(f"businesses/{business_id}/notes")
    project_notes = [n for n in notes if n.get("project_id") == project_id or n.get("matched_project_id") == project_id]
    
    line_items = []
    for note in project_notes:
        for mat in note.get("extracted_materials", []):
            if isinstance(mat, dict) and mat.get("approved"):
                qty = float(mat.get("quantity", 1))
                price = float(mat.get("sell_price", 0))
                subtotal = qty * price
                gst = subtotal * 0.10
                line_items.append({
                    "id": f"li_{int(datetime.now().timestamp())}_{mat.get('id', 'm')}",
                    "description": f"{mat.get('item_name')} (Voice Verified)",
                    "quantity": qty,
                    "unit": mat.get("unit", "pcs"),
                    "unit_price": price,
                    "is_gst_taxable": True,
                    "line_subtotal": subtotal,
                    "line_gst": gst,
                    "line_total": subtotal + gst,
                    "item_type": "MATERIAL",
                    "inventory_sku": mat.get("matched_inventory_sku")
                })

    # Labor hours line item
    hours = float(project.get("logged_hours") or project.get("estimated_hours") or 0)
    rate = 125.0
    labor_subtotal = hours * rate
    labor_gst = labor_subtotal * 0.10
    if hours > 0:
        line_items.insert(0, {
            "id": f"li_{int(datetime.now().timestamp())}_labor",
            "description": f"Trade Labor Services ({hours} hrs logged)",
            "quantity": hours,
            "unit": "hours",
            "unit_price": rate,
            "is_gst_taxable": True,
            "line_subtotal": labor_subtotal,
            "line_gst": labor_gst,
            "line_total": labor_subtotal + labor_gst,
            "item_type": "LABOR"
        })

    subtotal = sum(i["line_subtotal"] for i in line_items)
    total_gst = sum(i["line_gst"] for i in line_items)
    total_inc = subtotal + total_gst

    invoices = await firestore_service.list_collection(f"businesses/{business_id}/invoices")
    invoice_num = f"INV-2026-{str(len(invoices) + 1).zfill(4)}"
    invoice_id = f"inv_{int(datetime.now().timestamp())}"

    new_invoice = {
        "id": invoice_id,
        "invoice_number": invoice_num,
        "business_id": business_id,
        "project_id": project_id,
        "project_name": project.get("name", "Project Billing"),
        "status": "DRAFT",
        "issue_date": datetime.now().isoformat(),
        "due_date": (datetime.now() + timedelta(days=14)).isoformat(),
        "payment_terms": "14 Days from date of invoice",
        "seller": seller,
        "buyer": {
            "name": f"{project.get('client_name', 'Client')} Accounts",
            "company_name": project.get("client_name"),
            "abn": project.get("client_abn"),
            "address": project.get("site_address", "Site Location"),
            "email": project.get("client_email"),
            "phone": project.get("client_phone")
        },
        "line_items": line_items,
        "subtotal_ex_gst": subtotal,
        "total_gst": total_gst,
        "total_inc_gst": total_inc,
        "amount_paid": 0.0,
        "balance_due": total_inc,
        "notes": "Thank you for your business. Please quote invoice number when making electronic transfer.",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    await firestore_service.save_document(f"businesses/{business_id}/invoices/{invoice_id}", new_invoice)
    
    # Mark project as INVOICED on Firestore
    project["status"] = "INVOICED"
    await firestore_service.save_document(f"businesses/{business_id}/projects/{project_id}", project)
    
    return new_invoice
