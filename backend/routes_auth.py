"""Authentication endpoints."""
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from common import (
    db, hash_password, verify_password, create_access_token,
    get_current_user, log_audit, now_iso, serialize
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    employee_id: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(payload: LoginIn, response: Response):
    emp_id = payload.employee_id.strip().upper()
    user = await db.users.find_one({"employee_id": emp_id})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")
    if user.get("locked"):
        raise HTTPException(status_code=403, detail="Account is locked. Contact administrator.")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid Employee ID or password")
    token = create_access_token(user["id"], user["employee_id"], user["role"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=12 * 3600, path="/")
    await log_audit(user, "login", "auth", remarks="User logged in")
    user_out = serialize({**user})
    return {"token": token, "user": user_out}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    await log_audit(user, "logout", "auth", remarks="User logged out")
    return {"ok": True}


@router.post("/change-password")
async def change_password(payload: ChangePasswordIn, user=Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(payload.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": now_iso()}})
    await log_audit(user, "password_changed", "user", entity_id=user["id"])
    return {"ok": True}
