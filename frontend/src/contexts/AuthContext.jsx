import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = no user
  const [error, setError] = useState("");

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("hdcms_token");
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      localStorage.removeItem("hdcms_token");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (employee_id, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { employee_id, password });
      localStorage.setItem("hdcms_token", data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = formatError(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("hdcms_token");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loadMe, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
