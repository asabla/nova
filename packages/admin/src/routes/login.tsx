import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, LogIn, AlertCircle } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await adminApi.post("/admin-api/auth/login", { email, password });
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-surface)" }}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl mb-4" style={{ background: "var(--color-accent-blue-dim)" }}>
            <Shield className="h-8 w-8" style={{ color: "var(--color-accent-blue)" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>NOVA Admin</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>Platform Administration</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="rounded-xl border p-6 space-y-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nova.local"
              required
              className="w-full h-10 rounded-lg border px-3 text-sm"
              style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5" style={{ color: "var(--color-text-muted)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full h-10 rounded-lg border px-3 text-sm"
              style={{ background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full h-10 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            style={{ background: "var(--color-accent-blue)" }}
          >
            {loading ? (
              <span className="animate-pulse">Authenticating...</span>
            ) : (
              <><LogIn className="h-4 w-4" /> Sign In</>
            )}
          </button>

          <p className="text-[11px] text-center" style={{ color: "var(--color-text-muted)" }}>
            Super-admin access only
          </p>
        </form>
      </div>
    </div>
  );
}
