"""HDCMS comprehensive backend test suite (pytest)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("ADMIN001", "Admin@123"),
    "user_head": ("HEAD001", "Head@123"),
    "user_emp": ("USR001", "User@123"),
    "cal_emp": ("CAL001", "Cal@123"),
    "cal_head": ("CALHEAD001", "CalHead@123"),
}

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

TOKENS = {}


def login(role: str) -> str:
    if role in TOKENS:
        return TOKENS[role]
    emp, pw = CREDS[role]
    r = session.post(f"{API}/auth/login", json={"employee_id": emp, "password": pw}, timeout=20)
    assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
    tok = r.json()["token"]
    TOKENS[role] = tok
    return tok


def hdr(role: str) -> dict:
    return {"Authorization": f"Bearer {login(role)}", "Content-Type": "application/json"}


# ---------------- Health ----------------
class TestHealth:
    def test_root(self):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_health(self):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"


# ---------------- Auth ----------------
class TestAuth:
    @pytest.mark.parametrize("role", list(CREDS.keys()))
    def test_login_all_roles(self, role):
        emp, pw = CREDS[role]
        r = session.post(f"{API}/auth/login", json={"employee_id": emp, "password": pw})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str)
        assert data["user"]["employee_id"] == emp
        assert data["user"].get("password_hash") is None

    def test_login_invalid_password(self):
        r = session.post(f"{API}/auth/login", json={"employee_id": "ADMIN001", "password": "WRONG"})
        assert r.status_code == 401

    def test_login_invalid_user(self):
        r = session.post(f"{API}/auth/login", json={"employee_id": "NOPE999", "password": "x"})
        assert r.status_code == 401

    def test_me_with_token(self):
        r = session.get(f"{API}/auth/me", headers=hdr("admin"))
        assert r.status_code == 200
        assert r.json()["employee_id"] == "ADMIN001"

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- Departments ----------------
class TestDepartments:
    def test_list_departments(self):
        r = session.get(f"{API}/departments", headers=hdr("admin"))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # 10 user + 1 Calibration
        assert len(data) >= 11, f"Expected >=11 departments, got {len(data)}"
        names = [d["name"] for d in data]
        assert "Calibration" in names
        assert "Production" in names


# ---------------- Users ----------------
class TestUsersAdmin:
    created_id = None

    def test_list_users_admin(self):
        r = session.get(f"{API}/users", headers=hdr("admin"))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 5

    def test_create_user(self):
        payload = {
            "employee_id": f"TEST{int(time.time())%100000}",
            "name": "TEST_User",
            "email": f"test{int(time.time())}@h.local",
            "role": "user_emp",
            "department": "Production",
            "password": "Test@123",
        }
        r = session.post(f"{API}/users", json=payload, headers=hdr("admin"))
        assert r.status_code in (200, 201), r.text
        TestUsersAdmin.created_id = r.json()["id"]
        assert r.json()["employee_id"] == payload["employee_id"]

    def test_update_user(self):
        assert TestUsersAdmin.created_id
        r = session.put(f"{API}/users/{TestUsersAdmin.created_id}", json={"name": "TEST_Updated"}, headers=hdr("admin"))
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"

    def test_lock_unlock_user(self):
        assert TestUsersAdmin.created_id
        r = session.post(f"{API}/users/{TestUsersAdmin.created_id}/lock", headers=hdr("admin"))
        assert r.status_code == 200
        r = session.post(f"{API}/users/{TestUsersAdmin.created_id}/unlock", headers=hdr("admin"))
        assert r.status_code == 200

    def test_delete_user_cleanup(self):
        if TestUsersAdmin.created_id:
            r = session.delete(f"{API}/users/{TestUsersAdmin.created_id}", headers=hdr("admin"))
            assert r.status_code in (200, 204)

    def test_non_admin_cannot_delete_user(self):
        r = session.delete(f"{API}/users/{login('admin') and 'fake'}", headers=hdr("user_emp"))
        assert r.status_code == 403


# ---------------- Gauges ----------------
class TestGauges:
    def test_list_gauges_enriched(self):
        r = session.get(f"{API}/gauges", headers=hdr("admin"))
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 12, f"Expected >=12 seeded gauges, got {len(data)}"
        g = data[0]
        assert "color_hex" in g and "color_name" in g
        # Feb 2026 = first half: user holder => Yellow #FBBF24, calibration => Green #10B981
        if g.get("current_holder") == "user":
            assert g["color_name"] == "Yellow"
            assert g["color_hex"] == "#FBBF24"

    def test_gauge_details(self):
        gs = session.get(f"{API}/gauges", headers=hdr("admin")).json()
        gid = gs[0]["id"]
        r = session.get(f"{API}/gauges/{gid}", headers=hdr("admin"))
        assert r.status_code == 200
        d = r.json()
        for key in ("gauge", "calibration_reports", "movement_logs", "missing_reports", "requests"):
            assert key in d


# ---------------- Request workflow ----------------
class TestRequestFlow:
    req_id = None
    linked_gauge_id = None

    def test_user_creates_request(self):
        payload = {
            "gauge_name": "TEST_Vernier",
            "gauge_type": "Vernier Caliper",
            "department": "Production",
            "purpose": "Quality check",
            "quantity": 1,
        }
        r = session.post(f"{API}/requests", json=payload, headers=hdr("user_emp"))
        assert r.status_code == 200, r.text
        TestRequestFlow.req_id = r.json()["id"]
        assert r.json()["status"] == "pending_user_head"

    def test_user_cannot_approve_own_request(self):
        r = session.post(f"{API}/requests/{TestRequestFlow.req_id}/action",
                         json={"action": "approve"}, headers=hdr("user_emp"))
        assert r.status_code == 403

    def test_reject_without_remarks_400(self):
        # use user_head (allowed to act on pending_user_head) but no remarks
        r = session.post(f"{API}/requests/{TestRequestFlow.req_id}/action",
                         json={"action": "reject"}, headers=hdr("user_head"))
        assert r.status_code == 400

    def test_user_head_approves(self):
        r = session.post(f"{API}/requests/{TestRequestFlow.req_id}/action",
                         json={"action": "approve", "remarks": "ok"}, headers=hdr("user_head"))
        assert r.status_code == 200
        assert r.json()["status"] == "pending_cal_dept"

    def test_cal_emp_approves(self):
        r = session.post(f"{API}/requests/{TestRequestFlow.req_id}/action",
                         json={"action": "approve", "remarks": "ok"}, headers=hdr("cal_emp"))
        assert r.status_code == 200
        assert r.json()["status"] == "pending_cal_head"

    def test_cal_head_final_approves_creates_gauge(self):
        r = session.post(f"{API}/requests/{TestRequestFlow.req_id}/action",
                         json={"action": "approve", "remarks": "final"}, headers=hdr("cal_head"))
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "approved"
        assert body.get("linked_gauge_id"), "linked_gauge_id must be set after final approval"
        TestRequestFlow.linked_gauge_id = body["linked_gauge_id"]

    def test_new_gauge_in_master_list(self):
        r = session.get(f"{API}/gauges", headers=hdr("admin"))
        ids = [g["id"] for g in r.json()]
        assert TestRequestFlow.linked_gauge_id in ids


# ---------------- Missing report workflow ----------------
class TestMissingFlow:
    rid = None
    gauge_id = None

    def test_user_reports_missing(self):
        gs = session.get(f"{API}/gauges", headers=hdr("user_emp")).json()
        # pick a gauge from Production dept
        prod = [g for g in gs if g.get("department") == "Production"]
        assert prod
        TestMissingFlow.gauge_id = prod[0]["id"]
        r = session.post(f"{API}/missing-reports", json={
            "gauge_id": TestMissingFlow.gauge_id,
            "reason": "TEST_lost",
            "date_missing": "2026-02-01",
        }, headers=hdr("user_emp"))
        assert r.status_code == 200, r.text
        TestMissingFlow.rid = r.json()["id"]
        assert r.json()["status"] == "pending_user_head"

    def test_missing_flow_to_closed(self):
        r1 = session.post(f"{API}/missing-reports/{TestMissingFlow.rid}/action",
                          json={"action": "approve", "remarks": "ok"}, headers=hdr("user_head"))
        assert r1.status_code == 200 and r1.json()["status"] == "pending_cal_dept"
        r2 = session.post(f"{API}/missing-reports/{TestMissingFlow.rid}/action",
                          json={"action": "approve", "remarks": "ok"}, headers=hdr("cal_emp"))
        assert r2.status_code == 200 and r2.json()["status"] == "pending_cal_head"
        r3 = session.post(f"{API}/missing-reports/{TestMissingFlow.rid}/action",
                          json={"action": "approve", "remarks": "ok"}, headers=hdr("cal_head"))
        assert r3.status_code == 200 and r3.json()["status"] == "closed"
        # gauge status updated
        g = session.get(f"{API}/gauges/{TestMissingFlow.gauge_id}", headers=hdr("admin")).json()
        assert g["gauge"]["status"] == "Missing-Confirmed"


# ---------------- Calibration ----------------
class TestCalibration:
    cal_id = None
    gauge_id = None

    def test_cal_emp_creates_report(self):
        gs = session.get(f"{API}/gauges", headers=hdr("cal_emp")).json()
        active = [g for g in gs if g.get("status") == "Active"]
        assert active
        TestCalibration.gauge_id = active[0]["id"]
        payload = {
            "gauge_id": TestCalibration.gauge_id,
            "calibration_date": "2026-02-10",
            "next_due_date": "2026-08-10",
            "operator": "TEST_op",
            "readings": [
                {"standard": "10.000", "actual": "10.002", "error": "0.002", "tolerance": "0.01", "result": "OK"},
                {"standard": "20.000", "actual": "20.001", "error": "0.001", "tolerance": "0.01", "result": "OK"},
            ],
            "overall_result": "PASS",
            "status": "submitted",
        }
        r = session.post(f"{API}/calibration-reports", json=payload, headers=hdr("cal_emp"))
        assert r.status_code == 200, r.text
        TestCalibration.cal_id = r.json()["id"]
        assert r.json()["approval_status"] == "pending"

    def test_cal_head_approves_updates_gauge(self):
        r = session.post(f"{API}/calibration-reports/{TestCalibration.cal_id}/action",
                         json={"action": "approve"}, headers=hdr("cal_head"))
        assert r.status_code == 200
        assert r.json()["approval_status"] == "approved"
        g = session.get(f"{API}/gauges/{TestCalibration.gauge_id}", headers=hdr("admin")).json()
        assert g["gauge"]["last_calibration_date"] == "2026-02-10"
        assert g["gauge"]["next_calibration_date"] == "2026-08-10"


# ---------------- Movement ----------------
class TestMovement:
    mid = None
    gauge_id = None

    def test_send_to_calibration(self):
        gs = session.get(f"{API}/gauges", headers=hdr("user_emp")).json()
        prod = [g for g in gs if g.get("department") == "Production" and g.get("current_holder") == "user" and g.get("status") == "Active"]
        assert prod
        TestMovement.gauge_id = prod[0]["id"]
        r = session.post(f"{API}/movement", json={
            "gauge_id": TestMovement.gauge_id, "action": "send_to_calibration",
        }, headers=hdr("user_emp"))
        assert r.status_code == 200, r.text
        TestMovement.mid = r.json()["id"]
        # gauge holder changed
        g = session.get(f"{API}/gauges/{TestMovement.gauge_id}", headers=hdr("admin")).json()
        assert g["gauge"]["current_holder"] == "calibration"

    def test_pending_movement_listed(self):
        r = session.get(f"{API}/movement?status=pending", headers=hdr("cal_emp"))
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert TestMovement.mid in ids

    def test_receive_movement(self):
        r = session.post(f"{API}/movement/{TestMovement.mid}/receive", headers=hdr("cal_emp"))
        assert r.status_code == 200
        assert r.json()["received"] is True

    def test_return_to_user(self):
        r = session.post(f"{API}/movement", json={
            "gauge_id": TestMovement.gauge_id, "action": "return_to_user",
        }, headers=hdr("cal_emp"))
        assert r.status_code == 200
        g = session.get(f"{API}/gauges/{TestMovement.gauge_id}", headers=hdr("admin")).json()
        assert g["gauge"]["current_holder"] == "user"


# ---------------- Notifications, search, audit, dashboards ----------------
class TestMisc:
    def test_notifications(self):
        r = session.get(f"{API}/notifications", headers=hdr("user_emp"))
        assert r.status_code == 200
        notifs = r.json()
        if notifs:
            nid = notifs[0]["id"]
            r2 = session.post(f"{API}/notifications/{nid}/read", headers=hdr("user_emp"))
            assert r2.status_code == 200

    def test_search(self):
        r = session.get(f"{API}/search?q=Vernier", headers=hdr("admin"))
        assert r.status_code == 200
        data = r.json()
        assert "gauges" in data

    def test_audit_logs_admin_only(self):
        r = session.get(f"{API}/audit-logs", headers=hdr("admin"))
        assert r.status_code == 200
        r2 = session.get(f"{API}/audit-logs", headers=hdr("user_emp"))
        assert r2.status_code == 403

    @pytest.mark.parametrize("path,role", [
        ("/dashboard/admin", "admin"),
        ("/dashboard/user", "user_emp"),
        ("/dashboard/dept-head", "user_head"),
        ("/dashboard/calibration", "cal_emp"),
        ("/dashboard/cal-head", "cal_head"),
    ])
    def test_dashboards(self, path, role):
        r = session.get(f"{API}{path}", headers=hdr(role))
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text}"
        assert isinstance(r.json(), dict)


# ---------------- Exports ----------------
class TestExports:
    def test_export_gauges_xlsx(self):
        r = session.get(f"{API}/exports/gauges.xlsx", headers=hdr("admin"))
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_export_requests_xlsx(self):
        r = session.get(f"{API}/exports/requests.xlsx", headers=hdr("admin"))
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_export_calibration_pdf(self):
        cals = session.get(f"{API}/calibration-reports", headers=hdr("admin")).json()
        if not cals:
            pytest.skip("no calibration reports")
        rid = cals[0]["id"]
        r = session.get(f"{API}/exports/calibration-report/{rid}.pdf", headers=hdr("admin"))
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
