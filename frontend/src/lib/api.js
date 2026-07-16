import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
export const API_BASE = `${BACKEND}/api`;

export const api = axios.create({
  baseURL: API_BASE,
});

// Attach token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hdcms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith("/login")) {
        localStorage.removeItem("hdcms_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function formatError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail.msg) return detail.msg;
  return String(detail);
}
