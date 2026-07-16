"""Shared helpers: DB, auth, audit, notifications, models."""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Dict
from fastapi import Request, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

# ---------------- DB ----------------
def _match(doc: dict, query: dict) -> bool:
    if not query:
        return True

    def _to_comparable(x):
        if isinstance(x, datetime):
            return x
        if isinstance(x, str):
            # try ISO datetime / date
            try:
                return datetime.fromisoformat(x)
            except Exception:
                pass
            # try numeric
            try:
                return float(x)
            except Exception:
                return x
        return x

    def _compare(value, op, target):
        # None handling: comparisons with None are always False
        if value is None or target is None:
            return False
        try:
            a = _to_comparable(value)
            b = _to_comparable(target)
            if op == "$gte":
                return a >= b
            if op == "$lte":
                return a <= b
            if op == "$gt":
                return a > b
            if op == "$lt":
                return a < b
            return False
        except Exception:
            return False

    for k, v in query.items():
        if k == "$or":
            if any(_match(doc, sub) for sub in v):
                continue
            return False
        if isinstance(v, dict):
            # support operator expressions
            value = doc.get(k)
            if "$regex" in v:
                import re
                if not isinstance(value, str):
                    return False
                flags = 0
                if isinstance(v.get("$options"), str) and "i" in v.get("$options", ""):
                    flags |= re.IGNORECASE
                pattern = re.compile(v["$regex"], flags)
                if not pattern.search(value):
                    return False
            for op, val in v.items():
                if op in ("$options", "$regex"):
                    continue
                if op == "$in":
                    if value not in val:
                        return False
                elif op in ("$gte", "$lte", "$lt", "$gt"):
                    if not _compare(value, op, val):
                        return False
                elif op == "$eq":
                    if value != val:
                        return False
                elif op == "$ne":
                    if value == val:
                        return False
                elif op == "$exists":
                    exists = k in doc
                    if exists != bool(val):
                        return False
                elif op.startswith("$"):
                    # unsupported operator on this field, fail safe
                    return False
                else:
                    if value != v:
                        return False
            continue
        if doc.get(k) != v:
            return False
    return True


class _MockCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, key, direction=1):
        reverse = direction == -1
        self._docs.sort(key=lambda d: d.get(key), reverse=reverse)
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length):
        if length is None:
            return list(self._docs)
        return list(self._docs)[:length]

    async def __aiter__(self):
        for d in self._docs:
            yield d


class _MockCollection:
    def __init__(self):
        self._data = []

    async def find_one(self, query=None, projection=None):
        query = query or {}
        for d in self._data:
            if _match(d, query):
                doc = {k: v for k, v in d.items()}
                if projection:
                    # simple projection: include/exclude keys if provided as dict
                    doc = {k: v for k, v in doc.items() if (projection.get(k, 1) != 0)}
                return doc
        return None

    async def insert_one(self, doc):
        self._data.append(dict(doc))
        class R: inserted_id = None
        return R()

    async def delete_one(self, query):
        for i, d in enumerate(self._data):
            if _match(d, query):
                self._data.pop(i)
                class R: deleted_count = 1
                return R()
        class R: deleted_count = 0
        return R()

    async def update_one(self, query, update, upsert=False):
        for i, d in enumerate(self._data):
            if _match(d, query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        d.setdefault(k, []).append(v)
                self._data[i] = d
                class R: matched_count = 1; modified_count = 1
                return R()
        if upsert:
            new = dict(query)
            if "$set" in update:
                new.update(update["$set"])
            self._data.append(new)
            class R: matched_count = 0; modified_count = 0; upserted_id = None
            return R()
        class R: matched_count = 0; modified_count = 0
        return R()

    async def update_many(self, query, update):
        matched = 0
        modified = 0
        for d in self._data:
            if _match(d, query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = v
                if "$push" in update:
                    for k, v in update["$push"].items():
                        d.setdefault(k, []).append(v)
                matched += 1
                modified += 1
        class R: matched_count = matched; modified_count = modified
        return R()

    def aggregate(self, pipeline):
        result = list(self._data)
        for stage in pipeline:
            if "$group" in stage:
                group_spec = stage["$group"]
                grouped = {}
                _id_spec = group_spec["_id"]
                for doc in result:
                    key = None
                    if isinstance(_id_spec, str) and _id_spec.startswith("$"):
                        key = doc.get(_id_spec[1:])
                    else:
                        key = _id_spec
                    if key not in grouped:
                        grouped[key] = {"_id": key}
                        for field, expr in group_spec.items():
                            if field != "_id":
                                grouped[key][field] = 0
                    for field, expr in group_spec.items():
                        if field == "_id":
                            continue
                        if isinstance(expr, dict) and "$sum" in expr:
                            if expr["$sum"] == 1:
                                grouped[key][field] += 1
                            else:
                                grouped[key][field] += doc.get(expr["$sum"], 0)
                result = list(grouped.values())
            elif "$sort" in stage:
                sort_spec = stage["$sort"]
                if isinstance(sort_spec, dict):
                    for key, direction in sort_spec.items():
                        reverse = direction == -1
                        result.sort(key=lambda d: d.get(key), reverse=reverse)
                elif isinstance(sort_spec, list):
                    for key, direction in sort_spec:
                        reverse = direction == -1
                        result.sort(key=lambda d: d.get(key), reverse=reverse)
        return _MockCursor(result)

    def find(self, query=None, projection=None):
        query = query or {}
        matched = [d for d in self._data if _match(d, query)]
        return _MockCursor(matched)

    async def count_documents(self, query=None):
        query = query or {}
        return sum(1 for d in self._data if _match(d, query))

    async def distinct(self, key):
        return list({d.get(key) for d in self._data if key in d})

    async def create_index(self, *args, **kwargs):
        return None


class _MockDB:
    def __init__(self):
        self._cols = {}

    def __getitem__(self, name):
        if name not in self._cols:
            self._cols[name] = _MockCollection()
        return self._cols[name]
    def __getattr__(self, name):
        return self.__getitem__(name)


class _MockClient:
    def __init__(self):
        self._dbs = {}

    def __getitem__(self, name):
        if name not in self._dbs:
            self._dbs[name] = _MockDB()
        return self._dbs[name]
    def close(self):
        return None


if 'MONGO_URL' in os.environ and os.environ.get('MONGO_URL'):
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'hdcms')]
else:
    # Use in-memory mock DB for local dev / CI when MONGO_URL unset
    client = _MockClient()
    db = client[os.environ.get('DB_NAME', 'hdcms')]

# ---------------- Constants ----------------
ROLES = {
    "admin": "Admin",
    "user_emp": "User Department Employee",
    "user_head": "User Department Head",
    "cal_emp": "Calibration Department Employee",
    "cal_head": "Calibration Department Head",
}

REQUEST_STATUS = {
    "pending_user_head": "Pending User Head Approval",
    "pending_cal_dept": "Pending Calibration Dept",
    "pending_cal_head": "Pending Calibration Head",
    "approved": "Approved",
    "rejected": "Rejected",
}

CAL_DEPT_NAME = "Calibration"

# ---------------- Auth ----------------
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev_jwt_secret')
JWT_ALGO = os.environ.get('JWT_ALGORITHM', 'HS256')

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, employee_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "emp_id": employee_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(request: Request) -> Dict[str, Any]:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("locked"):
        raise HTTPException(status_code=403, detail="Account is locked")
    return user

def require_roles(*allowed: str):
    async def _dep(user=Depends(get_current_user)):
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep

# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def serialize(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

def serialize_many(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [serialize(d) for d in docs]

# ---------------- Audit ----------------
async def log_audit(user: Dict[str, Any], action: str, entity_type: str, entity_id: str = "", remarks: str = "", details: Optional[Dict] = None):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "employee_id": user["employee_id"],
        "user_name": user["name"],
        "role": user["role"],
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "remarks": remarks,
        "details": details or {},
        "timestamp": now_iso(),
    }
    await db.auditLogs.insert_one(doc)

# ---------------- Notifications ----------------
async def push_notification(user_ids: List[str], title: str, message: str, type_: str = "info", link: str = "", entity_id: str = ""):
    for uid in user_ids:
        doc = {
            "id": new_id(),
            "user_id": uid,
            "title": title,
            "message": message,
            "type": type_,
            "link": link,
            "entity_id": entity_id,
            "read": False,
            "created_at": now_iso(),
        }
        await db.notifications.insert_one(doc)

async def notify_role(role: str, title: str, message: str, type_: str = "info", link: str = "", department: Optional[str] = None, entity_id: str = ""):
    query = {"role": role, "locked": {"$ne": True}}
    if department:
        query["department"] = department
    users = await db.users.find(query, {"id": 1, "_id": 0}).to_list(1000)
    await push_notification([u["id"] for u in users], title, message, type_, link, entity_id)

# ---------------- Gauge color logic ----------------
def gauge_color_for(holder_type: str, month: Optional[int] = None) -> str:
    """holder_type: 'user' or 'calibration'. Returns hex color."""
    if month is None:
        month = datetime.now(timezone.utc).month
    first_half = 1 <= month <= 6
    if holder_type == "user":
        return "#FBBF24" if first_half else "#10B981"  # yellow or green
    return "#10B981" if first_half else "#FBBF24"

def gauge_color_name(holder_type: str, month: Optional[int] = None) -> str:
    if month is None:
        month = datetime.now(timezone.utc).month
    first_half = 1 <= month <= 6
    if holder_type == "user":
        return "Yellow" if first_half else "Green"
    return "Green" if first_half else "Yellow"
