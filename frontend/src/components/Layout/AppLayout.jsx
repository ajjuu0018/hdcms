import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Layout/Sidebar";
import Topbar from "@/components/Layout/Topbar";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-[#F9FAFB] dark:bg-gray-950" data-testid="app-layout">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 md:p-8 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
