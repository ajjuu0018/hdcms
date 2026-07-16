# HDCMS — Honda Digital Calibration Management System

## Problem Statement (Original)
Build a complete production-ready full-stack web application named Honda Digital Calibration Management System (HDCMS) — an enterprise-grade gauge calibration management platform for Honda manufacturing plants. 5 roles, multi-stage approval workflow for new gauge requests and missing-gauge reports, calibration reports with reading tables, master gauge list, gauge movement tracking, notifications, audit logs, role dashboards with charts, exports (PDF/Excel/Print), and gauge color logic that swaps based on the calendar half-year.

## Tech Stack
- Backend: FastAPI (Python), MongoDB (motor async)
- Frontend: React (CRA), Tailwind, shadcn/ui, Recharts, Phosphor Icons, Sonner toasts
- Auth: JWT (bcrypt-hashed passwords, 12h tokens via Authorization Bearer)

## User Personas
- **Admin**: full system control (users, departments, settings, audit, all data)
- **User Department Employee (user_emp)**: submits gauge requests; reports missing; views master list
- **User Department Head (user_head)**: approves dept requests + missing reports (stage 1)
- **Calibration Department Employee (cal_emp)**: processes requests (stage 2), creates calibration reports, manages movement
- **Calibration Department Head (cal_head)**: final approver (stage 3) for requests/missing reports + calibration reports

## Approval Workflow (4 stages)
User → User Dept Head → Calibration Dept → Calibration Dept Head → Approved (auto-creates gauge in Master List)

## Implemented (2026-02-27)
### Backend (FastAPI on :8001, all routes prefixed /api)
- `auth`: login (employee_id+password), me, logout, change-password
- `users`: CRUD + lock/unlock + reset-password (admin only)
- `departments`: CRUD (admin), GET visible to all
- `gauges`: list (with filters: dept, type, machine, location, status, due-window), details (with calibration history, movement, requests, missing reports), create/update/delete/lock/unlock; color logic applied server-side
- `requests`: 4-stage approval workflow with full history, auto-creates gauge on final approval
- `missing-reports`: same 4-stage workflow ending with gauge marked Missing-Confirmed
- `calibration-reports`: draft/submit/approve/reject + auto-update gauge dates on approval
- `movement`: send-to-calibration / return-to-user / receive (with pending receipt tracking)
- `notifications`: per-user push, read/unread, mark-all-read
- `audit-logs`: every action logged (admin only)
- `search`: global cross-entity search
- `dashboards`: 5 role-specific endpoints with KPIs + charts
- `exports`: master gauge list xlsx, requests xlsx, calibration report pdf
- Startup seed: admin, 10 user departments + Calibration department, 9 test users (1 per role + multi-dept), 12 sample gauges, system settings, indexes

### Frontend (React on :3000)
- Login screen with demo credential helper
- Role-aware sidebar + topbar (theme toggle, global search, notifications badge)
- Dashboards (Admin / User / Dept Head / Calibration / Cal Head) with KPI cards + Recharts
- Master Gauge List: filters (search, dept, type, status, due window), pagination, exports, clickable rows
- Gauge Details: tabs (Info, Calibration History, Movement, Requests, Missing) + Send-to-Calibration / Return-to-User / Lock / Unlock / Report-Missing actions
- New Request form with department/machine/purpose
- Requests list + Request Detail with workflow timeline + Approve/Reject panel
- Calibration Reports list, New Calibration form with dynamic readings table (Standard/Actual/Error/Tolerance/Result), Detail page with PDF download
- Missing Reports list + Detail with approval actions
- Movement tracker with receive action
- Notifications panel
- Audit Logs (admin)
- User Management (admin) — create, edit, lock/unlock, reset password, delete
- Department Management (admin) — create, edit, assign head
- System Settings (admin)
- Global search results page

## Test Coverage
- Backend 46/46 pytest passing
- Frontend ~90% smoke tests passed; minor selector fixes applied

## Demo Credentials
See `/app/memory/test_credentials.md`

## Color Logic
Jan–Jun: User dept = Yellow, Calibration = Green.
Jul–Dec: reversed. Color is computed at API level (color_hex, color_name fields).

## Backlog / Next Action Items
- P1: File upload support (attachments for requests, certificates for calibration) — local disk or object storage
- P1: Real-time notifications via SSE/WebSockets (currently 30s poll)
- P2: Calendar-month accuracy for monthly chart buckets (currently 30-day windows)
- P2: Database backup/restore admin tool
- P2: Mobile-optimized layouts beyond responsive grids
- P3: Per-user notification preferences
- P3: Bulk import/export for gauges (CSV)
- P3: Granular permission editor (custom roles beyond the 5 fixed)
