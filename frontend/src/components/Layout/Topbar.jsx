import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { MagnifyingGlass, Bell, Sun, Moon } from "@phosphor-icons/react";

export default function Topbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await api.get("/notifications", { params: { unread_only: true } });
        if (mounted) setUnread(data.length);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 h-14 flex items-center justify-between gap-4 sticky top-0 z-10" data-testid="topbar">
      <form onSubmit={onSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            data-testid="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search gauges, users, requests, departments..."
            className="h-input pl-9 text-sm"
          />
        </div>
      </form>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
          data-testid="theme-toggle-btn"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <Link
          to="/notifications"
          data-testid="topbar-notifications"
          className="relative w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#CC0000] text-white text-[10px] font-bold font-mono px-1 min-w-[16px] h-4 flex items-center justify-center" data-testid="notification-badge">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        <div className="hidden md:flex flex-col text-right ml-2 pr-2 border-r border-gray-200 dark:border-gray-800">
          <span className="text-xs font-mono uppercase tracking-widest text-gray-400">{user?.role}</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100" data-testid="topbar-username">{user?.name}</span>
        </div>
        <div className="w-9 h-9 bg-[#0A0A0A] text-white flex items-center justify-center font-bold font-mono text-sm" data-testid="user-avatar">
          {user?.name?.split(" ").map(s => s[0]).slice(0, 2).join("")}
        </div>
      </div>
    </header>
  );
}
