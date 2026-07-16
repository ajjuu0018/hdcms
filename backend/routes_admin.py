"""Admin: users, departments, audit logs, settings."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from common import (
    db, hash_password, get_current_user, require_roles, log_audit,
    new_id, now_iso, serialize, serialize_many, ROLES, CAL_DEPT_NAME
)

router = APIRouter(tags=["admin"])


# ---------------- Users ----------------
class UserIn(BaseModel):
    employee_id: str
    name: str
    email: Optional[str] = ""
    role: str
    department: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    locked: Optional[bool] = None
    active: Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str


@router.get("/users")
async def list_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    department: Optional[str] = None,
    user=Depends(get_current_user)
):
    # Admin sees all; heads see their dept; others see only themselves
    query = {}
    if user["role"] == "admin":
        pass
    elif user["role"] in ("user_head",):
        query["department"] = user["department"]
    elif user["role"] in ("cal_head",):
        query["department"] = CAL_DEPT_NAME
    else:
        query["id"] = user["id"]
    if q:
        query["$or"] = [
            {"employee_id": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    if role:
        query["role"] = role
    if department:
        query["department"] = department
    docs = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(2000)
    return docs


@router.post("/users")
async def create_user(payload: UserIn, user=Depends(require_roles("admin"))):
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    emp_id = payload.employee_id.strip().upper()
    if await db.users.find_one({"employee_id": emp_id}):
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    doc = {
        "id": new_id(),
        "employee_id": emp_id,
        "name": payload.name.strip(),
        "email": (payload.email or "").strip().lower(),
        "role": payload.role,
        "department": payload.department,
        "password_hash": hash_password(payload.password),
        "locked": False,
        "active": True,
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await db.users.insert_one(doc)
    await log_audit(user, "create", "user", entity_id=doc["id"], remarks=f"Created user {emp_id}")
    return serialize(doc)


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user=Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "role" in upd and upd["role"] not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if upd:
        upd["updated_at"] = now_iso()
        await db.users.update_one({"id": user_id}, {"$set": upd})
    await log_audit(user, "update", "user", entity_id=user_id, remarks=f"Updated user {target['employee_id']}", details=upd)
    new = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return new


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    await log_audit(user, "delete", "user", entity_id=user_id, remarks=f"Deleted {target['employee_id']}")
    return {"ok": True}


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, payload: PasswordReset, user=Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": now_iso()}})
    await log_audit(user, "password_reset", "user", entity_id=user_id, remarks=f"Reset password for {target['employee_id']}")
    return {"ok": True}


@router.post("/users/{user_id}/lock")
async def lock_user(user_id: str, user=Depends(require_roles("admin"))):
    await db.users.update_one({"id": user_id}, {"$set": {"locked": True, "updated_at": now_iso()}})
    await log_audit(user, "lock", "user", entity_id=user_id)
    return {"ok": True}


@router.post("/users/{user_id}/unlock")
async def unlock_user(user_id: str, user=Depends(require_roles("admin"))):
    await db.users.update_one({"id": user_id}, {"$set": {"locked": False, "updated_at": now_iso()}})
    await log_audit(user, "unlock", "user", entity_id=user_id)
    return {"ok": True}


# ---------------- Departments ----------------
class DeptIn(BaseModel):
    name: str
    code: Optional[str] = ""
    description: Optional[str] = ""
    head_employee_id: Optional[str] = None


class DeptUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    head_employee_id: Optional[str] = None


@router.get("/departments")
async def list_departments(user=Depends(get_current_user)):
    docs = await db.departments.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


@router.post("/departments")
async def create_department(payload: DeptIn, user=Depends(require_roles("admin"))):
    if await db.departments.find_one({"name": payload.name}):
        raise HTTPException(status_code=400, detail="Department already exists")
    doc = {
        "id": new_id(),
        "name": payload.name.strip(),
        "code": (payload.code or payload.name[:3]).upper(),
        "description": payload.description or "",
        "head_employee_id": payload.head_employee_id,
        "is_calibration": False,
        "created_at": now_iso(),
    }
    await db.departments.insert_one(doc)
    await log_audit(user, "create", "department", entity_id=doc["id"], remarks=f"Created dept {doc['name']}")
    return serialize(doc)


@router.put("/departments/{dept_id}")
async def update_department(dept_id: str, payload: DeptUpdate, user=Depends(require_roles("admin"))):
    target = await db.departments.find_one({"id": dept_id})
    if not target:
        raise HTTPException(status_code=404, detail="Department not found")
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if upd:
        upd["updated_at"] = now_iso()
        await db.departments.update_one({"id": dept_id}, {"$set": upd})
    await log_audit(user, "update", "department", entity_id=dept_id, details=upd)
    new = await db.departments.find_one({"id": dept_id}, {"_id": 0})
    return new


@router.delete("/departments/{dept_id}")
async def delete_department(dept_id: str, user=Depends(require_roles("admin"))):
    target = await db.departments.find_one({"id": dept_id})
    if not target:
        raise HTTPException(status_code=404, detail="Department not found")
    if target.get("is_calibration"):
        raise HTTPException(status_code=400, detail="Cannot delete Calibration Department")
    await db.departments.delete_one({"id": dept_id})
    await log_audit(user, "delete", "department", entity_id=dept_id, remarks=f"Deleted dept {target['name']}")
    return {"ok": True}


# ---------------- Audit Logs ----------------
@router.get("/audit-logs")
async def list_audit(
    user=Depends(get_current_user),
    q: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 200,
):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query: dict = {}
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if q:
        query["$or"] = [
            {"user_name": {"$regex": q, "$options": "i"}},
            {"employee_id": {"$regex": q, "$options": "i"}},
            {"remarks": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.auditLogs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return docs


# ---------------- Settings ----------------
class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    calibration_validity_days: Optional[int] = None
    allow_gauge_delete: Optional[bool] = None
    notification_enabled: Optional[bool] = None


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "system"}, {"_id": 0})
    return doc or {}


@router.put("/settings")
async def update_settings(payload: SettingsUpdate, user=Depends(require_roles("admin"))):
    upd = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if upd:
        upd["updated_at"] = now_iso()
        await db.settings.update_one({"key": "system"}, {"$set": upd}, upsert=True)
    await log_audit(user, "update", "settings", details=upd)
    doc = await db.settings.find_one({"key": "system"}, {"_id": 0})
    return doc


# ---------------- Roles meta ----------------
@router.get("/roles")
async def roles_list(user=Depends(get_current_user)):
    return [{"key": k, "label": v} for k, v in ROLES.items()]
