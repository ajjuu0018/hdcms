"""Dashboards, notifications, search, exports."""
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from io import BytesIO
from common import (
    db, get_current_user, require_roles, log_audit,
    new_id, now_iso, CAL_DEPT_NAME
)

router = APIRouter(tags=["misc"])


# ---------------- Dashboard ----------------
def _month_start(d: datetime) -> datetime:
    return d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/dashboard/admin")
async def dashboard_admin(user=Depends(require_roles("admin"))):
    total_users = await db.users.count_documents({})
    total_departments = await db.departments.count_documents({})
    total_gauges = await db.gauges.count_documents({})
    total_requests = await db.requests.count_documents({})
    pending = await db.requests.count_documents({"status": {"$in": ["pending_user_head", "pending_cal_dept", "pending_cal_head"]}})
    missing = await db.gauges.count_documents({"status": {"$in": ["Missing", "Missing-Confirmed"]}})
    completed_cal = await db.calibrationReports.count_documents({"approval_status": "approved"})
    # Monthly request counts last 6 months
    monthly = []
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        start = _month_start(now - timedelta(days=30 * i))
        end = _month_start(now - timedelta(days=30 * (i - 1))) if i > 0 else now + timedelta(days=1)
        cnt = await db.requests.count_documents({"created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}})
        cal_cnt = await db.calibrationReports.count_documents({"created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}})
        monthly.append({"month": start.strftime("%b"), "requests": cnt, "calibrations": cal_cnt})
    # Gauges per department
    dept_pipe = [{"$group": {"_id": "$department", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    dept_breakdown = await db.gauges.aggregate(dept_pipe).to_list(50)
    return {
        "total_users": total_users,
        "total_departments": total_departments,
        "total_gauges": total_gauges,
        "total_requests": total_requests,
        "pending_requests": pending,
        "missing_gauges": missing,
        "completed_calibrations": completed_cal,
        "monthly": monthly,
        "by_department": [{"name": d["_id"], "count": d["count"]} for d in dept_breakdown if d["_id"]],
    }


@router.get("/dashboard/user")
async def dashboard_user(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    in30 = (today + timedelta(days=30)).isoformat()
    assigned = await db.gauges.count_documents({"department": user["department"]})
    due = await db.gauges.count_documents({"department": user["department"], "next_calibration_date": {"$lte": in30, "$ne": None}})
    missing = await db.gauges.count_documents({"department": user["department"], "status": {"$in": ["Missing", "Missing-Confirmed"]}})
    my_reqs = await db.requests.count_documents({"requested_by": user["id"]})
    pending_my = await db.requests.count_documents({
        "requested_by": user["id"],
        "status": {"$in": ["pending_user_head", "pending_cal_dept", "pending_cal_head"]},
    })
    return {
        "assigned_gauges": assigned,
        "due_calibration": due,
        "missing_gauges": missing,
        "total_requests": my_reqs,
        "pending_requests": pending_my,
    }


@router.get("/dashboard/dept-head")
async def dashboard_dept_head(user=Depends(require_roles("user_head", "admin"))):
    dept = user["department"]
    today = datetime.now(timezone.utc).date().isoformat()
    pending_approvals = await db.requests.count_documents({"status": "pending_user_head", "requested_by_department": dept})
    pending_missing = await db.missingReports.count_documents({"status": "pending_user_head", "reported_by_department": dept})
    approved_today = await db.requests.count_documents({
        "requested_by_department": dept,
        "history.action": "approve",
        "updated_at": {"$gte": today},
    })
    dept_gauges = await db.gauges.count_documents({"department": dept})
    dept_users = await db.users.count_documents({"department": dept})
    return {
        "pending_approvals": pending_approvals,
        "pending_missing": pending_missing,
        "approved_today": approved_today,
        "department_gauges": dept_gauges,
        "department_users": dept_users,
        "department": dept,
    }


@router.get("/dashboard/calibration")
async def dashboard_cal(user=Depends(require_roles("cal_emp", "cal_head", "admin"))):
    pending_cal = await db.calibrationReports.count_documents({"approval_status": {"$in": ["pending", "draft"]}})
    completed_cal = await db.calibrationReports.count_documents({"approval_status": "approved"})
    received = await db.movementLogs.count_documents({"action": "sent_to_calibration", "received": True})
    pending_receive = await db.movementLogs.count_documents({"action": "sent_to_calibration", "received": False})
    pending_requests = await db.requests.count_documents({"status": {"$in": ["pending_cal_dept", "pending_cal_head"]}})
    return {
        "pending_calibrations": pending_cal,
        "completed_calibrations": completed_cal,
        "received_gauges": received,
        "pending_receive": pending_receive,
        "pending_requests": pending_requests,
    }


@router.get("/dashboard/cal-head")
async def dashboard_cal_head(user=Depends(require_roles("cal_head", "admin"))):
    pending_final = await db.requests.count_documents({"status": "pending_cal_head"})
    pending_reports = await db.calibrationReports.count_documents({"approval_status": "pending"})
    monthly = []
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        start = _month_start(now - timedelta(days=30 * i))
        end = _month_start(now - timedelta(days=30 * (i - 1))) if i > 0 else now + timedelta(days=1)
        cnt = await db.calibrationReports.count_documents({"created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}, "approval_status": "approved"})
        monthly.append({"month": start.strftime("%b"), "approved": cnt})
    return {
        "pending_final_approvals": pending_final,
        "pending_calibration_reports": pending_reports,
        "monthly_approved": monthly,
    }


# ---------------- Notifications ----------------
@router.get("/notifications")
async def list_notifications(unread_only: bool = False, user=Depends(get_current_user)):
    query: dict = {"user_id": user["id"]}
    if unread_only:
        query["read"] = False
    docs = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return docs


@router.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- Search ----------------
@router.get("/search")
async def global_search(q: str, user=Depends(get_current_user)):
    if not q or len(q) < 2:
        return {"users": [], "departments": [], "gauges": [], "requests": [], "calibration": [], "missing": []}
    rx = {"$regex": q, "$options": "i"}
    users = await db.users.find({"$or": [{"employee_id": rx}, {"name": rx}, {"email": rx}]}, {"_id": 0, "password_hash": 0}).limit(10).to_list(10)
    departments = await db.departments.find({"$or": [{"name": rx}, {"code": rx}]}, {"_id": 0}).limit(10).to_list(10)
    gauges = await db.gauges.find({"$or": [{"name": rx}, {"gauge_id": rx}, {"manufacturer": rx}]}, {"_id": 0}).limit(10).to_list(10)
    requests = await db.requests.find({"$or": [{"request_no": rx}, {"gauge_name": rx}]}, {"_id": 0}).limit(10).to_list(10)
    cals = await db.calibrationReports.find({"$or": [{"report_no": rx}, {"gauge_name": rx}]}, {"_id": 0}).limit(10).to_list(10)
    missings = await db.missingReports.find({"$or": [{"report_no": rx}, {"gauge_name": rx}]}, {"_id": 0}).limit(10).to_list(10)
    return {
        "users": users,
        "departments": departments,
        "gauges": gauges,
        "requests": requests,
        "calibration": cals,
        "missing": missings,
    }


# ---------------- Exports ----------------
@router.get("/exports/gauges.xlsx")
async def export_gauges_xlsx(user=Depends(get_current_user)):
    from openpyxl import Workbook
    docs = await db.gauges.find({}, {"_id": 0}).sort("gauge_id", 1).to_list(10000)
    wb = Workbook()
    ws = wb.active
    ws.title = "Master Gauge List"
    headers = ["Gauge ID", "Name", "Type", "Department", "Machine", "Location", "Manufacturer", "Model", "Range", "Least Count", "Status", "Holder", "Last Calibration", "Next Due"]
    ws.append(headers)
    for d in docs:
        ws.append([
            d.get("gauge_id", ""), d.get("name", ""), d.get("type", ""),
            d.get("department", ""), d.get("machine", ""), d.get("location", ""),
            d.get("manufacturer", ""), d.get("model", ""), d.get("range", ""),
            d.get("least_count", ""), d.get("status", ""), d.get("current_holder", ""),
            d.get("last_calibration_date", ""), d.get("next_calibration_date", ""),
        ])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(content=buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=master_gauge_list.xlsx"})


@router.get("/exports/calibration-report/{rid}.pdf")
async def export_cal_pdf(rid: str, user=Depends(get_current_user)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    doc = await db.calibrationReports.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    buf = BytesIO()
    pdf = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#CC0000"))
    flow = []
    flow.append(Paragraph("HONDA - Calibration Report", title_style))
    flow.append(Paragraph(f"<b>Report No:</b> {doc.get('report_no', '')}", styles["Normal"]))
    flow.append(Spacer(1, 8))
    info = [
        ["Gauge ID", doc.get("gauge_ref", ""), "Gauge Name", doc.get("gauge_name", "")],
        ["Department", doc.get("department", ""), "Calibration Date", doc.get("calibration_date", "")],
        ["Next Due", doc.get("next_due_date", ""), "Operator", doc.get("operator", "")],
        ["Standard Used", doc.get("standard_used", ""), "Instrument", doc.get("instrument_used", "")],
        ["Temperature", doc.get("temperature", ""), "Humidity", doc.get("humidity", "")],
        ["Approved By", doc.get("approved_by_name", "") or doc.get("approved_by", ""), "Status", doc.get("approval_status", "")],
    ]
    t = Table(info, colWidths=[80, 160, 80, 160])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F9FAFB")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    flow.append(t)
    flow.append(Spacer(1, 12))
    flow.append(Paragraph("<b>Readings</b>", styles["Heading3"]))
    readings = [["Standard", "Actual", "Error", "Tolerance", "Result"]]
    for r in doc.get("readings", []):
        readings.append([r.get("standard", ""), r.get("actual", ""), r.get("error", ""), r.get("tolerance", ""), r.get("result", "")])
    rt = Table(readings, colWidths=[100, 100, 80, 80, 80])
    rt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    flow.append(rt)
    flow.append(Spacer(1, 12))
    result_color = colors.HexColor("#10B981") if doc.get("overall_result") == "PASS" else colors.HexColor("#CC0000")
    flow.append(Paragraph(f"<b>Overall Result:</b> <font color='{result_color.hexval()}'>{doc.get('overall_result', '')}</font>", styles["Normal"]))
    flow.append(Paragraph(f"<b>Remarks:</b> {doc.get('remarks', '')}", styles["Normal"]))
    pdf.build(flow)
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=calibration_{doc.get('report_no')}.pdf"})


@router.get("/exports/requests.xlsx")
async def export_requests_xlsx(user=Depends(get_current_user)):
    from openpyxl import Workbook
    docs = await db.requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    wb = Workbook()
    ws = wb.active
    ws.title = "Requests"
    ws.append(["Request No", "Type", "Gauge Name", "Department", "Requested By", "Status", "Created At"])
    for d in docs:
        ws.append([d.get("request_no", ""), d.get("type", ""), d.get("gauge_name", ""), d.get("department", ""),
                   d.get("requested_by_name", ""), d.get("status", ""), d.get("created_at", "")])
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return Response(content=buf.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=requests.xlsx"})
