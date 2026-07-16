"""New Gauge Requests workflow + Missing Gauge Reports."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from common import (
    db, get_current_user, require_roles, log_audit,
    push_notification, notify_role, new_id, now_iso,
    REQUEST_STATUS, CAL_DEPT_NAME
)

router = APIRouter(tags=["requests"])


# ---------------- New Gauge Request ----------------
class RequestIn(BaseModel):
    gauge_name: str
    gauge_number: Optional[str] = ""
    gauge_type: str
    manufacturer: Optional[str] = ""
    model: Optional[str] = ""
    range: Optional[str] = ""
    least_count: Optional[str] = ""
    department: str
    machine: Optional[str] = ""
    machine_number: Optional[str] = ""
    location: Optional[str] = ""
    purpose: str
    quantity: int = 1
    reason: Optional[str] = ""
    attachment_url: Optional[str] = ""


class ApprovalIn(BaseModel):
    action: str  # 'approve' or 'reject'
    remarks: Optional[str] = ""


def _next_status(current: str, action: str) -> str:
    if action == "reject":
        return "rejected"
    flow = {
        "pending_user_head": "pending_cal_dept",
        "pending_cal_dept": "pending_cal_head",
        "pending_cal_head": "approved",
    }
    return flow.get(current, current)


@router.post("/requests")
async def create_request(payload: RequestIn, user=Depends(require_roles("user_emp", "user_head", "admin"))):
    doc = {
        "id": new_id(),
        "request_no": f"REQ-{int(__import__('time').time())}",
        "type": "new_gauge",
        **payload.model_dump(),
        "status": "pending_user_head",
        "requested_by": user["id"],
        "requested_by_emp_id": user["employee_id"],
        "requested_by_name": user["name"],
        "requested_by_department": user["department"],
        "history": [{
            "action": "submitted",
            "by_id": user["id"],
            "by_name": user["name"],
            "by_role": user["role"],
            "remarks": "Request submitted",
            "timestamp": now_iso(),
        }],
        "linked_gauge_id": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.requests.insert_one(doc)
    await log_audit(user, "create", "request", entity_id=doc["id"], remarks=f"New gauge request {doc['request_no']}")
    # Notify user head of same department
    await notify_role("user_head", "New Gauge Request",
                     f"{user['name']} submitted a new gauge request: {payload.gauge_name}",
                     type_="info", department=user["department"], entity_id=doc["id"], link=f"/requests/{doc['id']}")
    doc.pop("_id", None)
    return doc


@router.get("/requests")
async def list_requests(
    status: Optional[str] = None,
    mine: bool = False,
    user=Depends(get_current_user),
):
    query: dict = {}
    role = user["role"]
    if mine:
        query["requested_by"] = user["id"]
    elif role == "user_emp":
        query["requested_by"] = user["id"]
    elif role == "user_head":
        query["requested_by_department"] = user["department"]
    elif role == "cal_emp":
        query["status"] = {"$in": ["pending_cal_dept", "pending_cal_head", "approved", "rejected"]}
    elif role == "cal_head":
        query["status"] = {"$in": ["pending_cal_head", "approved", "rejected", "pending_cal_dept"]}
    if status:
        query["status"] = status
    docs = await db.requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@router.get("/requests/pending")
async def pending_for_me(user=Depends(get_current_user)):
    """Items waiting on the current user/role for approval."""
    role = user["role"]
    if role == "user_head":
        q = {"status": "pending_user_head", "requested_by_department": user["department"]}
    elif role == "cal_emp":
        q = {"status": "pending_cal_dept"}
    elif role == "cal_head":
        q = {"status": "pending_cal_head"}
    elif role == "admin":
        q = {"status": {"$in": ["pending_user_head", "pending_cal_dept", "pending_cal_head"]}}
    else:
        return []
    docs = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@router.get("/requests/{req_id}")
async def request_detail(req_id: str, user=Depends(get_current_user)):
    doc = await db.requests.find_one({"id": req_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    return doc


@router.post("/requests/{req_id}/action")
async def act_on_request(req_id: str, payload: ApprovalIn, user=Depends(get_current_user)):
    doc = await db.requests.find_one({"id": req_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    role = user["role"]
    status = doc["status"]
    # Permission map
    allowed = {
        "pending_user_head": ["user_head", "admin"],
        "pending_cal_dept": ["cal_emp", "cal_head", "admin"],
        "pending_cal_head": ["cal_head", "admin"],
    }
    if status not in allowed or role not in allowed[status]:
        raise HTTPException(status_code=403, detail="You cannot act on this request right now")
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action")
    if payload.action == "reject" and not payload.remarks:
        raise HTTPException(status_code=400, detail="Rejection requires remarks")

    new_status = _next_status(status, payload.action)
    history_entry = {
        "action": payload.action,
        "from_status": status,
        "to_status": new_status,
        "by_id": user["id"],
        "by_name": user["name"],
        "by_role": user["role"],
        "remarks": payload.remarks or "",
        "timestamp": now_iso(),
    }
    upd = {"status": new_status, "updated_at": now_iso()}
    await db.requests.update_one({"id": req_id}, {"$set": upd, "$push": {"history": history_entry}})

    # Auto-create gauge if final approved
    if new_status == "approved" and doc["type"] == "new_gauge":
        # Generate gauge_id
        prefix = "HG"
        count = await db.gauges.count_documents({})
        gid = f"{prefix}-{1000 + count:04d}"
        gdoc = {
            "id": new_id(),
            "gauge_id": gid,
            "name": doc["gauge_name"],
            "type": doc["gauge_type"],
            "department": doc["department"],
            "machine": doc.get("machine", ""),
            "machine_number": doc.get("machine_number", ""),
            "location": doc.get("location", ""),
            "manufacturer": doc.get("manufacturer", ""),
            "model": doc.get("model", ""),
            "range": doc.get("range", ""),
            "least_count": doc.get("least_count", ""),
            "status": "Active",
            "current_holder": "user",
            "current_holder_dept": doc["department"],
            "last_calibration_date": None,
            "next_calibration_date": None,
            "locked": False,
            "created_at": now_iso(),
            "created_from_request_id": req_id,
        }
        await db.gauges.insert_one(gdoc)
        await db.requests.update_one({"id": req_id}, {"$set": {"linked_gauge_id": gdoc["id"]}})
        await log_audit(user, "auto_create", "gauge", entity_id=gdoc["id"], remarks=f"Auto-added from request {doc['request_no']}")

    await log_audit(user, payload.action, "request", entity_id=req_id, remarks=payload.remarks or "")

    # Notifications
    requester_id = doc["requested_by"]
    if payload.action == "reject":
        await push_notification([requester_id], "Request Rejected",
                                f"Your request {doc['request_no']} was rejected by {user['name']}",
                                "error", entity_id=req_id, link=f"/requests/{req_id}")
    else:
        await push_notification([requester_id], "Request Update",
                                f"Your request {doc['request_no']} moved to {REQUEST_STATUS.get(new_status, new_status)}",
                                "success", entity_id=req_id, link=f"/requests/{req_id}")
        if new_status == "pending_cal_dept":
            await notify_role("cal_emp", "New Approval Pending",
                              f"Request {doc['request_no']} forwarded for calibration department",
                              department=CAL_DEPT_NAME, entity_id=req_id, link=f"/requests/{req_id}")
        elif new_status == "pending_cal_head":
            await notify_role("cal_head", "Final Approval Pending",
                              f"Request {doc['request_no']} awaiting final approval",
                              department=CAL_DEPT_NAME, entity_id=req_id, link=f"/requests/{req_id}")

    new_doc = await db.requests.find_one({"id": req_id}, {"_id": 0})
    return new_doc


# ---------------- Missing Gauge Reports ----------------
class MissingIn(BaseModel):
    gauge_id: str  # ref to gauges.id
    reason: str
    date_missing: str
    remarks: Optional[str] = ""
    attachment_url: Optional[str] = ""


@router.post("/missing-reports")
async def create_missing(payload: MissingIn, user=Depends(get_current_user)):
    gauge = await db.gauges.find_one({"id": payload.gauge_id})
    if not gauge:
        raise HTTPException(status_code=404, detail="Gauge not found")
    doc = {
        "id": new_id(),
        "report_no": f"MIS-{int(__import__('time').time())}",
        "gauge_id": gauge["id"],
        "gauge_ref": gauge["gauge_id"],
        "gauge_name": gauge["name"],
        "department": gauge["department"],
        "reason": payload.reason,
        "date_missing": payload.date_missing,
        "remarks": payload.remarks or "",
        "attachment_url": payload.attachment_url or "",
        "status": "pending_user_head",
        "reported_by": user["id"],
        "reported_by_name": user["name"],
        "reported_by_department": user["department"],
        "history": [{
            "action": "reported",
            "by_id": user["id"],
            "by_name": user["name"],
            "by_role": user["role"],
            "remarks": "Missing gauge reported",
            "timestamp": now_iso(),
        }],
        "created_at": now_iso(),
    }
    await db.missingReports.insert_one(doc)
    await db.gauges.update_one({"id": gauge["id"]}, {"$set": {"status": "Missing", "updated_at": now_iso()}})
    await log_audit(user, "create", "missing_report", entity_id=doc["id"], remarks=f"Missing gauge reported: {gauge['gauge_id']}")
    await notify_role("user_head", "Missing Gauge Report",
                     f"{user['name']} reported missing gauge {gauge['gauge_id']}",
                     "warning", department=user["department"], entity_id=doc["id"], link=f"/missing/{doc['id']}")
    doc.pop("_id", None)
    return doc


@router.get("/missing-reports")
async def list_missing(user=Depends(get_current_user)):
    query: dict = {}
    role = user["role"]
    if role == "user_emp":
        query["reported_by"] = user["id"]
    elif role == "user_head":
        query["reported_by_department"] = user["department"]
    docs = await db.missingReports.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return docs


@router.get("/missing-reports/{rid}")
async def get_missing(rid: str, user=Depends(get_current_user)):
    doc = await db.missingReports.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@router.post("/missing-reports/{rid}/action")
async def act_missing(rid: str, payload: ApprovalIn, user=Depends(get_current_user)):
    doc = await db.missingReports.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    status = doc["status"]
    role = user["role"]
    allowed = {
        "pending_user_head": ["user_head", "admin"],
        "pending_cal_dept": ["cal_emp", "cal_head", "admin"],
        "pending_cal_head": ["cal_head", "admin"],
    }
    if status not in allowed or role not in allowed[status]:
        raise HTTPException(status_code=403, detail="Cannot act on this report")
    if payload.action == "reject" and not payload.remarks:
        raise HTTPException(status_code=400, detail="Rejection requires remarks")
    new_status = _next_status(status, payload.action)
    if payload.action == "approve" and status == "pending_cal_head":
        new_status = "closed"
    hist = {
        "action": payload.action,
        "from_status": status,
        "to_status": new_status,
        "by_id": user["id"],
        "by_name": user["name"],
        "by_role": user["role"],
        "remarks": payload.remarks or "",
        "timestamp": now_iso(),
    }
    await db.missingReports.update_one({"id": rid}, {"$set": {"status": new_status, "updated_at": now_iso()}, "$push": {"history": hist}})
    await log_audit(user, payload.action, "missing_report", entity_id=rid, remarks=payload.remarks or "")
    if new_status == "closed":
        # mark gauge final missing
        await db.gauges.update_one({"id": doc["gauge_id"]}, {"$set": {"status": "Missing-Confirmed"}})
    new_doc = await db.missingReports.find_one({"id": rid}, {"_id": 0})
    return new_doc
