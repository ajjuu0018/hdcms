"""Calibration Reports + Movement Logs."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from common import (
    db, get_current_user, require_roles, log_audit, push_notification, notify_role,
    new_id, now_iso, CAL_DEPT_NAME
)

router = APIRouter(tags=["calibration"])


class ReadingRow(BaseModel):
    standard: str
    actual: str
    error: str = ""
    tolerance: str = ""
    result: str = "OK"  # OK / NG


class CalibrationReportIn(BaseModel):
    gauge_id: str  # gauges.id
    calibration_date: str
    next_due_date: str
    standard_used: Optional[str] = ""
    instrument_used: Optional[str] = ""
    temperature: Optional[str] = ""
    humidity: Optional[str] = ""
    operator: Optional[str] = ""
    approved_by: Optional[str] = ""
    readings: List[ReadingRow] = []
    overall_result: str = "PASS"  # PASS / FAIL
    remarks: Optional[str] = ""
    certificate_url: Optional[str] = ""
    status: str = "draft"  # draft / submitted


class CalibrationApprovalIn(BaseModel):
    action: str  # approve / reject
    remarks: Optional[str] = ""


@router.post("/calibration-reports")
async def create_cal(payload: CalibrationReportIn, user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    gauge = await db.gauges.find_one({"id": payload.gauge_id})
    if not gauge:
        raise HTTPException(status_code=404, detail="Gauge not found")
    doc = {
        "id": new_id(),
        "report_no": f"CAL-{int(__import__('time').time())}",
        **payload.model_dump(),
        "gauge_ref": gauge["gauge_id"],
        "gauge_name": gauge["name"],
        "department": gauge["department"],
        "created_by": user["id"],
        "created_by_name": user["name"],
        "approval_status": "pending" if payload.status == "submitted" else "draft",
        "approved_by_user_id": None,
        "history": [{
            "action": "created",
            "by_id": user["id"],
            "by_name": user["name"],
            "remarks": "Calibration report created",
            "timestamp": now_iso(),
        }],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.calibrationReports.insert_one(doc)
    await log_audit(user, "create", "calibration_report", entity_id=doc["id"], remarks=f"Calibration report for {gauge['gauge_id']}")
    if payload.status == "submitted":
        await notify_role("cal_head", "Calibration Report Submitted",
                         f"Report {doc['report_no']} for {gauge['gauge_id']} awaiting approval",
                         department=CAL_DEPT_NAME, entity_id=doc["id"], link=f"/calibration/{doc['id']}")
    doc.pop("_id", None)
    return doc


@router.put("/calibration-reports/{rid}")
async def update_cal(rid: str, payload: CalibrationReportIn, user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    target = await db.calibrationReports.find_one({"id": rid})
    if not target:
        raise HTTPException(status_code=404, detail="Not found")
    if target.get("approval_status") == "approved" and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Approved reports cannot be edited")
    upd = payload.model_dump()
    upd["updated_at"] = now_iso()
    if payload.status == "submitted":
        upd["approval_status"] = "pending"
    await db.calibrationReports.update_one({"id": rid}, {"$set": upd})
    await log_audit(user, "update", "calibration_report", entity_id=rid)
    new = await db.calibrationReports.find_one({"id": rid}, {"_id": 0})
    return new


@router.get("/calibration-reports")
async def list_cal(
    gauge_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
):
    query: dict = {}
    if gauge_id:
        query["gauge_id"] = gauge_id
    if status:
        query["approval_status"] = status
    docs = await db.calibrationReports.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@router.get("/calibration-reports/pending")
async def pending_cal(user=Depends(require_roles("cal_head", "admin"))):
    docs = await db.calibrationReports.find({"approval_status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@router.get("/calibration-reports/{rid}")
async def get_cal(rid: str, user=Depends(get_current_user)):
    doc = await db.calibrationReports.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.post("/calibration-reports/{rid}/action")
async def act_cal(rid: str, payload: CalibrationApprovalIn, user=Depends(require_roles("cal_head", "admin"))):
    doc = await db.calibrationReports.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc.get("approval_status") not in ("pending",):
        raise HTTPException(status_code=400, detail="Report is not pending approval")
    if payload.action == "reject" and not payload.remarks:
        raise HTTPException(status_code=400, detail="Rejection requires remarks")
    new_status = "approved" if payload.action == "approve" else "rejected"
    hist = {
        "action": payload.action,
        "by_id": user["id"],
        "by_name": user["name"],
        "by_role": user["role"],
        "remarks": payload.remarks or "",
        "timestamp": now_iso(),
    }
    await db.calibrationReports.update_one({"id": rid}, {
        "$set": {"approval_status": new_status, "approved_by_user_id": user["id"], "approved_by_name": user["name"], "updated_at": now_iso()},
        "$push": {"history": hist},
    })
    # Update gauge calibration dates
    if new_status == "approved":
        await db.gauges.update_one({"id": doc["gauge_id"]}, {"$set": {
            "last_calibration_date": doc["calibration_date"],
            "next_calibration_date": doc["next_due_date"],
            "last_cal_result": doc.get("overall_result", "PASS"),
            "updated_at": now_iso(),
        }})
        await push_notification([doc["created_by"]], "Calibration Approved",
                               f"Report {doc['report_no']} approved", "success",
                               entity_id=rid, link=f"/calibration/{rid}")
    else:
        await push_notification([doc["created_by"]], "Calibration Rejected",
                               f"Report {doc['report_no']} rejected: {payload.remarks}", "error",
                               entity_id=rid, link=f"/calibration/{rid}")
    await log_audit(user, payload.action, "calibration_report", entity_id=rid, remarks=payload.remarks or "")
    new = await db.calibrationReports.find_one({"id": rid}, {"_id": 0})
    return new


# ---------------- Movement Logs ----------------
class MovementIn(BaseModel):
    gauge_id: str
    action: str  # 'send_to_calibration' or 'return_to_user'
    remarks: Optional[str] = ""


@router.post("/movement")
async def create_movement(payload: MovementIn, user=Depends(get_current_user)):
    gauge = await db.gauges.find_one({"id": payload.gauge_id})
    if not gauge:
        raise HTTPException(status_code=404, detail="Gauge not found")
    if payload.action == "send_to_calibration":
        new_holder = "calibration"
        new_dept = CAL_DEPT_NAME
        log_action = "sent_to_calibration"
    elif payload.action == "return_to_user":
        new_holder = "user"
        new_dept = gauge["department"]
        log_action = "returned_to_user"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    log_doc = {
        "id": new_id(),
        "gauge_id": gauge["id"],
        "gauge_ref": gauge["gauge_id"],
        "gauge_name": gauge["name"],
        "from_holder": gauge.get("current_holder"),
        "to_holder": new_holder,
        "from_dept": gauge.get("current_holder_dept"),
        "to_dept": new_dept,
        "action": log_action,
        "date": now_iso(),
        "by_id": user["id"],
        "by_name": user["name"],
        "remarks": payload.remarks or "",
        "received": False if payload.action == "send_to_calibration" else True,
        "received_date": now_iso() if payload.action == "return_to_user" else None,
    }
    await db.movementLogs.insert_one(log_doc)
    await db.gauges.update_one({"id": gauge["id"]}, {"$set": {
        "current_holder": new_holder,
        "current_holder_dept": new_dept,
        "updated_at": now_iso(),
    }})
    await log_audit(user, log_action, "gauge", entity_id=gauge["id"], remarks=payload.remarks or "")
    log_doc.pop("_id", None)
    return log_doc


@router.get("/movement")
async def list_movement(
    gauge_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
):
    query: dict = {}
    if gauge_id:
        query["gauge_id"] = gauge_id
    if status == "pending":
        query["received"] = False
    docs = await db.movementLogs.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return docs


@router.post("/movement/{mid}/receive")
async def receive_movement(mid: str, user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    target = await db.movementLogs.find_one({"id": mid})
    if not target:
        raise HTTPException(status_code=404, detail="Not found")
    await db.movementLogs.update_one({"id": mid}, {"$set": {"received": True, "received_date": now_iso(), "received_by": user["name"]}})
    await log_audit(user, "received", "gauge", entity_id=target["gauge_id"], remarks=f"Received gauge {target['gauge_ref']}")
    new = await db.movementLogs.find_one({"id": mid}, {"_id": 0})
    return new
