"""Seed initial data: admin, sample departments, employees, gauges."""
import os
from datetime import datetime, timezone, timedelta
from common import db, hash_password, new_id, now_iso, CAL_DEPT_NAME


SAMPLE_DEPARTMENTS = [
    "Production", "Engine", "Assembly", "QA", "Welding",
    "Paint Shop", "Press Shop", "Maintenance", "Tool Room", "Stores",
]


async def seed_admin():
    admin_emp = os.environ.get("ADMIN_EMP_ID", "ADMIN001")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"employee_id": admin_emp})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(),
            "employee_id": admin_emp,
            "name": "System Administrator",
            "email": "admin@honda.local",
            "role": "admin",
            "department": "Administration",
            "password_hash": hash_password(admin_pw),
            "locked": False,
            "active": True,
            "created_at": now_iso(),
        })


async def seed_departments():
    # Calibration department
    if not await db.departments.find_one({"name": CAL_DEPT_NAME}):
        await db.departments.insert_one({
            "id": new_id(),
            "name": CAL_DEPT_NAME,
            "code": "CAL",
            "is_calibration": True,
            "head_employee_id": None,
            "description": "Calibration Department - manages all gauge calibrations",
            "created_at": now_iso(),
        })
    for idx, name in enumerate(SAMPLE_DEPARTMENTS):
        if not await db.departments.find_one({"name": name}):
            await db.departments.insert_one({
                "id": new_id(),
                "name": name,
                "code": name[:3].upper(),
                "is_calibration": False,
                "head_employee_id": None,
                "description": f"{name} Department",
                "created_at": now_iso(),
            })


async def seed_test_users():
    """Create one test user per role for demo."""
    test_users = [
        {"employee_id": "USR001", "name": "Rajesh Kumar", "role": "user_emp", "department": "Production", "password": "User@123"},
        {"employee_id": "HEAD001", "name": "Priya Sharma", "role": "user_head", "department": "Production", "password": "Head@123"},
        {"employee_id": "CAL001", "name": "Amit Patel", "role": "cal_emp", "department": CAL_DEPT_NAME, "password": "Cal@123"},
        {"employee_id": "CALHEAD001", "name": "Sneha Iyer", "role": "cal_head", "department": CAL_DEPT_NAME, "password": "CalHead@123"},
        {"employee_id": "USR002", "name": "Vikram Singh", "role": "user_emp", "department": "Engine", "password": "User@123"},
        {"employee_id": "HEAD002", "name": "Anjali Reddy", "role": "user_head", "department": "Engine", "password": "Head@123"},
        {"employee_id": "USR003", "name": "Karan Mehta", "role": "user_emp", "department": "Assembly", "password": "User@123"},
        {"employee_id": "HEAD003", "name": "Deepika Nair", "role": "user_head", "department": "Assembly", "password": "Head@123"},
    ]
    for u in test_users:
        if not await db.users.find_one({"employee_id": u["employee_id"]}):
            pw = u.pop("password")
            doc = {
                "id": new_id(),
                "employee_id": u["employee_id"],
                "name": u["name"],
                "email": f"{u['employee_id'].lower()}@honda.local",
                "role": u["role"],
                "department": u["department"],
                "password_hash": hash_password(pw),
                "locked": False,
                "active": True,
                "created_at": now_iso(),
            }
            await db.users.insert_one(doc)
            # If user_head, assign as department head
            if u["role"] == "user_head":
                await db.departments.update_one(
                    {"name": u["department"]},
                    {"$set": {"head_employee_id": u["employee_id"]}}
                )
            if u["role"] == "cal_head":
                await db.departments.update_one(
                    {"name": CAL_DEPT_NAME},
                    {"$set": {"head_employee_id": u["employee_id"]}}
                )


async def seed_sample_gauges():
    """Add sample gauges already in master list."""
    if await db.gauges.count_documents({}) > 0:
        return
    samples = [
        {"name": "Vernier Caliper 0-150mm", "type": "Vernier Caliper", "department": "Production", "machine": "CNC-001", "location": "Bay-A", "manufacturer": "Mitutoyo", "model": "530-104", "range": "0-150mm", "least_count": "0.02mm"},
        {"name": "Micrometer 0-25mm", "type": "Micrometer", "department": "Engine", "machine": "HONE-002", "location": "Bay-B", "manufacturer": "Mitutoyo", "model": "103-137", "range": "0-25mm", "least_count": "0.01mm"},
        {"name": "Dial Indicator 0-10mm", "type": "Dial Indicator", "department": "Assembly", "machine": "JIG-101", "location": "Line-1", "manufacturer": "Mitutoyo", "model": "2046S", "range": "0-10mm", "least_count": "0.01mm"},
        {"name": "Bore Gauge 35-50mm", "type": "Bore Gauge", "department": "Engine", "machine": "CNC-005", "location": "Bay-B", "manufacturer": "Mitutoyo", "model": "511-712", "range": "35-50mm", "least_count": "0.001mm"},
        {"name": "Height Gauge 0-300mm", "type": "Height Gauge", "department": "QA", "machine": "INSP-001", "location": "Lab-1", "manufacturer": "Mitutoyo", "model": "192-130", "range": "0-300mm", "least_count": "0.02mm"},
        {"name": "Surface Plate 600x400", "type": "Surface Plate", "department": "QA", "machine": "INSP-002", "location": "Lab-1", "manufacturer": "Granite Co", "model": "GR-600", "range": "600x400mm", "least_count": "Grade 0"},
        {"name": "Torque Wrench 5-50Nm", "type": "Torque Wrench", "department": "Assembly", "machine": "ASSY-A1", "location": "Line-1", "manufacturer": "Tohnichi", "model": "QL50N", "range": "5-50Nm", "least_count": "0.5Nm"},
        {"name": "Plug Gauge 10H7", "type": "Plug Gauge", "department": "Production", "machine": "CNC-002", "location": "Bay-A", "manufacturer": "OSG", "model": "10H7-PG", "range": "10mm H7", "least_count": "Go/NoGo"},
        {"name": "Snap Gauge 25g6", "type": "Snap Gauge", "department": "Welding", "machine": "WELD-201", "location": "Shop-2", "manufacturer": "OSG", "model": "25g6-SG", "range": "25mm g6", "least_count": "Go/NoGo"},
        {"name": "Thread Gauge M8x1.25", "type": "Thread Gauge", "department": "Tool Room", "machine": "LATHE-3", "location": "TR-1", "manufacturer": "OSG", "model": "M8x1.25", "range": "M8x1.25", "least_count": "Go/NoGo"},
        {"name": "Pressure Gauge 0-10bar", "type": "Pressure Gauge", "department": "Paint Shop", "machine": "COMP-101", "location": "Shop-3", "manufacturer": "WIKA", "model": "PG-10", "range": "0-10 bar", "least_count": "0.1 bar"},
        {"name": "Temperature Probe", "type": "Temperature", "department": "Paint Shop", "machine": "OVEN-A", "location": "Shop-3", "manufacturer": "Fluke", "model": "T3000", "range": "-50 to 300°C", "least_count": "0.1°C"},
    ]
    today = datetime.now(timezone.utc).date()
    for idx, s in enumerate(samples):
        gid = f"HG-{1000 + idx:04d}"
        cal_date = today - timedelta(days=30 + idx * 5)
        due_date = cal_date + timedelta(days=365)
        await db.gauges.insert_one({
            "id": new_id(),
            "gauge_id": gid,
            "name": s["name"],
            "type": s["type"],
            "department": s["department"],
            "machine": s["machine"],
            "machine_number": s["machine"],
            "location": s["location"],
            "manufacturer": s["manufacturer"],
            "model": s["model"],
            "range": s["range"],
            "least_count": s["least_count"],
            "status": "Active",
            "current_holder": "user",  # user dept holds it
            "current_holder_dept": s["department"],
            "last_calibration_date": cal_date.isoformat(),
            "next_calibration_date": due_date.isoformat(),
            "locked": False,
            "created_at": now_iso(),
        })


async def seed_settings():
    if not await db.settings.find_one({"key": "system"}):
        await db.settings.insert_one({
            "id": new_id(),
            "key": "system",
            "company_name": "Honda Manufacturing",
            "calibration_validity_days": 365,
            "allow_gauge_delete": False,
            "notification_enabled": True,
            "created_at": now_iso(),
        })


async def run_all_seeds():
    await seed_admin()
    await seed_departments()
    await seed_test_users()
    await seed_sample_gauges()
    await seed_settings()
    # indexes
    await db.users.create_index("employee_id", unique=True)
    await db.gauges.create_index("gauge_id", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.auditLogs.create_index([("timestamp", -1)])


async def write_test_credentials_file():
    """Write demo credentials for testing agents."""
    content = """# HDCMS Test Credentials

## Login: Use Employee ID + Password

| Role | Employee ID | Password | Department |
|------|-------------|----------|------------|
| Admin | ADMIN001 | Admin@123 | Administration |
| User Department Employee | USR001 | User@123 | Production |
| User Department Head | HEAD001 | Head@123 | Production |
| Calibration Department Employee | CAL001 | Cal@123 | Calibration |
| Calibration Department Head | CALHEAD001 | CalHead@123 | Calibration |
| User Employee (Engine) | USR002 | User@123 | Engine |
| User Head (Engine) | HEAD002 | Head@123 | Engine |
| User Employee (Assembly) | USR003 | User@123 | Assembly |
| User Head (Assembly) | HEAD003 | Head@123 | Assembly |

## Auth Endpoints
- POST /api/auth/login   -> body: {"employee_id": "ADMIN001", "password": "Admin@123"}
- GET  /api/auth/me      -> Authorization: Bearer <token>
- POST /api/auth/logout
"""
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(content)
