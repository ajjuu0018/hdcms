import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Eye, EyeSlash, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(employeeId, password);
      toast.success("Welcome back");
      nav("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]" data-testid="login-page">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 relative items-end p-12 overflow-hidden"
           style={{
             backgroundImage: "linear-gradient(to bottom right, rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url(https://images.pexels.com/photos/19233057/pexels-photo-19233057.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=850&w=1100)",
             backgroundSize: "cover",
             backgroundPosition: "center"
           }}>
        <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#CC0000] flex items-center justify-center">
            <span className="font-black text-white text-lg">H</span>
          </div>
          <div className="text-white">
            <div className="font-black tracking-tight text-lg">HDCMS</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-gray-300">Honda Calibration System</div>
          </div>
        </div>
        <div className="absolute top-8 right-8 h-1 w-24 h-stripe" />
        <div className="relative max-w-md">
          <div className="h-1 w-16 bg-[#CC0000] mb-6" />
          <h2 className="text-4xl font-black text-white tracking-tight leading-tight">
            Precision Gauge<br/>Calibration Management
          </h2>
          <p className="mt-4 text-sm text-gray-300 leading-relaxed max-w-sm">
            Enterprise-grade gauge tracking, calibration workflows, and audit-grade reporting built for the production floor.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { k: "GAUGES", v: "Master List" },
              { k: "WORKFLOW", v: "4-Stage Approval" },
              { k: "AUDIT", v: "Full Trace" },
            ].map(x => (
              <div key={x.k} className="border border-gray-700 bg-black/40 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">{x.k}</div>
                <div className="text-xs font-semibold text-white mt-1">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-4 left-12 text-[10px] font-mono uppercase tracking-widest text-gray-500">
          © Honda Manufacturing · Internal Use Only
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#CC0000] flex items-center justify-center">
              <span className="font-black text-white text-lg">H</span>
            </div>
            <div>
              <div className="font-black text-lg">HDCMS</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Honda Calibration</div>
            </div>
          </div>

          <div className="mb-2">
            <span className="h-label">Step 01 · Authentication</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">Use your Honda Employee ID & password.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" data-testid="login-form">
            <div>
              <label className="h-label block mb-1.5">Employee ID</label>
              <input
                data-testid="login-employee-id-input"
                autoFocus
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. ADMIN001"
                className="h-input font-mono uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="h-label block mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  required
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                  data-testid="toggle-password"
                >
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="border border-[#CC0000] bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="h-btn-primary w-full flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} weight="bold" />
              {loading ? "Authenticating…" : "Sign in to HDCMS"}
            </button>
          </form>

          <div className="mt-8 border border-gray-200 p-4">
            <div className="h-label mb-2">Demo Credentials</div>
            <div className="text-xs font-mono text-gray-600 space-y-1">
              <div>ADMIN001 / Admin@123 <span className="text-gray-400">(Admin)</span></div>
              <div>HEAD001 / Head@123 <span className="text-gray-400">(Dept Head)</span></div>
              <div>USR001 / User@123 <span className="text-gray-400">(Dept Employee)</span></div>
              <div>CAL001 / Cal@123 <span className="text-gray-400">(Calibration)</span></div>
              <div>CALHEAD001 / CalHead@123 <span className="text-gray-400">(Cal Head)</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
