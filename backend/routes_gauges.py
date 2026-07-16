"""Gauges: Master list, CRUD, lock/unlock, details."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from common import (
    db, get_current_user, require_roles, log_audit, push_notification,
    new_id, now_iso, gauge_color_for, gauge_color_name, CAL_DEPT_NAME
)

router = APIRouter(prefix="/gauges", tags=["gauges"])


class GaugeIn(BaseModel):
    gauge_id: str
    name: str
    type: str
    department: str
    machine: Optional[str] = ""
    machine_number: Optional[str] = ""
    location: Optional[str] = ""
    manufacturer: Optional[str] = ""
    model: Optional[str] = ""
    range: Optional[str] = ""
    least_count: Optional[str] = ""


class GaugeUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    department: Optional[str] = None
    machine: Optional[str] = None
    machine_number: Optional[str] = None
    location: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    range: Optional[str] = None
    least_count: Optional[str] = None
    status: Optional[str] = None


def enrich(doc: dict) -> dict:
    holder = doc.get("current_holder", "user")
    # determine month based on recent calibration dates when available
    month = None
    for dkey in ("last_calibration_date", "next_calibration_date"):
        if doc.get(dkey):
            try:
                month = datetime.fromisoformat(doc.get(dkey)).month
                break
            except Exception:
                month = None
    doc["color_hex"] = gauge_color_for(holder, month)
    doc["color_name"] = gauge_color_name(holder, month)
    # due flag
    nd = doc.get("next_calibration_date")
    if nd:
        try:
            dd = datetime.fromisoformat(nd).date()
            today = datetime.now(timezone.utc).date()
            doc["days_to_due"] = (dd - today).days
            doc["calibration_overdue"] = dd < today
        except Exception:
            doc["days_to_due"] = None
            doc["calibration_overdue"] = False
    return doc


@router.get("")
async def list_gauges(
    q: Optional[str] = None,
    department: Optional[str] = None,
    gauge_type: Optional[str] = None,
    machine: Optional[str] = None,
    location: Optional[str] = None,
    status: Optional[str] = None,
    due_in_days: Optional[int] = None,
    user=Depends(get_current_user),
):
    query: dict = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"gauge_id": {"$regex": q, "$options": "i"}},
            {"manufacturer": {"$regex": q, "$options": "i"}},
            {"model": {"$regex": q, "$options": "i"}},
        ]
    if department:
        query["department"] = department
    if gauge_type:
        query["type"] = gauge_type
    if machine:
        query["machine"] = {"$regex": machine, "$options": "i"}
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if status:
        query["status"] = status
    if due_in_days is not None:
        cutoff = (datetime.now(timezone.utc).date() + timedelta(days=due_in_days)).isoformat()
        query["next_calibration_date"] = {"$lte": cutoff}
    docs = await db.gauges.find(query, {"_id": 0}).sort("gauge_id", 1).to_list(5000)
    return [enrich(d) for d in docs]


@router.get("/types")
async def gauge_types(user=Depends(get_current_user)):
    docs = await db.gauges.distinct("type")
    return sorted([d for d in docs if d])


@router.get("/{gauge_id}")
async def gauge_details(gauge_id: str, user=Depends(get_current_user)):
    doc = await db.gauges.find_one({"id": gauge_id}, {"_id": 0}) or await db.gauges.find_one({"gauge_id": gauge_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Gauge not found")
    enrich(doc)
    # related
    cals = await db.calibrationReports.find({"gauge_id": doc["id"]}, {"_id": 0}).sort("calibration_date", -1).to_list(1000)
    moves = await db.movementLogs.find({"gauge_id": doc["id"]}, {"_id": 0}).sort("date", -1).to_list(1000)
    missings = await db.missingReports.find({"gauge_id": doc["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    requests = await db.requests.find({"linked_gauge_id": doc["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {
        "gauge": doc,
        "calibration_reports": cals,
        "movement_logs": moves,
        "missing_reports": missings,
        "requests": requests,
    }


@router.post("")
async def create_gauge(payload: GaugeIn, user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    if await db.gauges.find_one({"gauge_id": payload.gauge_id}):
        raise HTTPException(status_code=400, detail="Gauge ID already exists")
    doc = {
        "id": new_id(),
        "gauge_id": payload.gauge_id.strip().upper(),
        "name": payload.name,
        "type": payload.type,
        "department": payload.department,
        "machine": payload.machine or "",
        "machine_number": payload.machine_number or payload.machine or "",
        "location": payload.location or "",
        "manufacturer": payload.manufacturer or "",
        "model": payload.model or "",
        "range": payload.range or "",
        "least_count": payload.least_count or "",
        "status": "Active",
        "current_holder": "user",
        "current_holder_dept": payload.department,
        "last_calibration_date": None,
        "next_calibration_date": None,
        "locked": False,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.gauges.insert_one(doc)
    await log_audit(user, "create", "gauge", entity_id=doc["id"], remarks=f"Created gauge {doc['gauge_id']}")
    return enrich({**doc})


@router.put("/{gauge_id}")
async def update_gauge(gauge_id: str, payload: GaugeUpdate, user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    target = await db.gauges.find_one({"id": gauge_id})
    if not target:
        raise HTTPException(status_code=404, detail="Gauge not found")
    if target.get("locked") and user["role"] not in ("cal_head", "admin"):
        raise HTTPException(status_code=403, detail="Gauge is locked")
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if upd:
        upd["updated_at"] = now_iso()
        await db.gauges.update_one({"id": gauge_id}, {"$set": upd})
    await log_audit(user, "update", "gauge", entity_id=gauge_id, details=upd)
    new = await db.gauges.find_one({"id": gauge_id}, {"_id": 0})
    return enrich(new)


@router.delete("/{gauge_id}")
async def delete_gauge(gauge_id: str, user=Depends(require_roles("cal_head", "admin"))):
    settings = await db.settings.find_one({"key": "system"})
    if user["role"] != "admin" and not (settings or {}).get("allow_gauge_delete"):
        raise HTTPException(status_code=403, detail="Gauge deletion not allowed by admin")
    target = await db.gauges.find_one({"id": gauge_id})
    if not target:
        raise HTTPException(status_code=404, detail="Gauge not found")
    await db.gauges.delete_one({"id": gauge_id})
    await log_audit(user, "delete", "gauge", entity_id=gauge_id, remarks=f"Deleted {target['gauge_id']}")
    return {"ok": True}


@router.post("/{gauge_id}/lock")
async def lock_gauge(gauge_id: str, user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    await db.gauges.update_one({"id": gauge_id}, {"$set": {"locked": True, "updated_at": now_iso()}})
    await log_audit(user, "lock", "gauge", entity_id=gauge_id)
    return {"ok": True}


@router.post("/{gauge_id}/unlock")
async def unlock_gauge(gauge_id: str, user=Depends(require_roles("cal_head", "admin"))):
    await db.gauges.update_one({"id": gauge_id}, {"$set": {"locked": False, "updated_at": now_iso()}})
    await log_audit(user, "unlock", "gauge", entity_id=gauge_id)
    return {"ok": True}
