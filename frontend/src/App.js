import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import AppLayout from "@/components/Layout/AppLayout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import GaugeList from "@/pages/GaugeList";
import GaugeDetails from "@/pages/GaugeDetails";
import NewGauge from "@/pages/NewGauge";
import Requests from "@/pages/Requests";
import NewRequest from "@/pages/NewRequest";
import RequestDetail from "@/pages/RequestDetail";
import PendingApprovals from "@/pages/PendingApprovals";
import Calibration from "@/pages/Calibration";
import NewCalibrationReport from "@/pages/NewCalibrationReport";
import CalibrationDetail from "@/pages/CalibrationDetail";
import MissingGauges from "@/pages/MissingGauges";
import MissingDetail from "@/pages/MissingDetail";
import Movement from "@/pages/Movement";
import Notifications from "@/pages/Notifications";
import AuditLogs from "@/pages/AuditLogs";
import UserManagement from "@/pages/UserManagement";
import DepartmentManagement from "@/pages/DepartmentManagement";
import Settings from "@/pages/Settings";
import SearchResults from "@/pages/SearchResults";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="/gauges" element={<GaugeList />} />
              <Route path="/gauges/new" element={<ProtectedRoute allowedRoles={["cal_emp", "cal_head", "admin"]}><NewGauge /></ProtectedRoute>} />
              <Route path="/gauges/:id" element={<GaugeDetails />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/requests/new" element={<ProtectedRoute allowedRoles={["user_emp", "user_head", "admin"]}><NewRequest /></ProtectedRoute>} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/approvals" element={<ProtectedRoute allowedRoles={["user_head", "cal_emp", "cal_head", "admin"]}><PendingApprovals /></ProtectedRoute>} />
              <Route path="/calibration" element={<Calibration />} />
              <Route path="/calibration/new" element={<ProtectedRoute allowedRoles={["cal_emp", "cal_head", "admin"]}><NewCalibrationReport /></ProtectedRoute>} />
              <Route path="/calibration/:id" element={<CalibrationDetail />} />
              <Route path="/missing" element={<MissingGauges />} />
              <Route path="/missing/:id" element={<MissingDetail />} />
              <Route path="/movement" element={<Movement />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/audit" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLogs /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute allowedRoles={["admin", "user_head", "cal_head"]}><UserManagement /></ProtectedRoute>} />
              <Route path="/departments" element={<ProtectedRoute allowedRoles={["admin"]}><DepartmentManagement /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin"]}><Settings /></ProtectedRoute>} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/analytics" element={<Dashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
