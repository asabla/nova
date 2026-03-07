import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Eye, EyeOff, Mail, ArrowRight } from "lucide-react";
import { authClient } from "../hooks/useAuth";
import { useAuthStore } from "../stores/auth.store";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const initOrg = useAuthStore((s) => s.initOrg);
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "magic-link") {
        const apiUrl = import.meta.env.VITE_API_URL ?? "";
        const resp = await fetch(`${apiUrl}/api/auth/magic-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (resp.ok) {
          setMagicLinkSent(true);
        } else {
          const err = await resp.json().catch(() => ({}));
          setError(err.message ?? "Failed to send magic link");
        }
        return;
      }

      const { data, error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(authError.message ?? t("auth.loginFailed"));
        return;
      }

      if (data) {
        setSession(data);
        await initOrg();
        navigate({ to: "/" });
      }
    } catch {
      setError(t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = (provider: string) => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    window.location.href = `${apiUrl}/api/sso/${provider}/authorize`;
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-success" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-text">Check your email</h1>
          <p className="text-sm text-text-secondary mt-2">
            We sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
          </p>
          <button
            onClick={() => { setMagicLinkSent(false); setMode("password"); }}
            className="text-primary hover:underline text-sm mt-6 inline-block"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-text">{t("auth.signIn")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("auth.signInDescription")}</p>
        </div>

        {/* SSO Buttons */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => handleSSO("microsoft")}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface text-sm text-text hover:bg-surface-secondary transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            Continue with Microsoft
          </button>
          <button
            onClick={() => handleSSO("google")}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface text-sm text-text hover:bg-surface-secondary transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <button
            onClick={() => handleSSO("github")}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface text-sm text-text hover:bg-surface-secondary transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            Continue with GitHub
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-tertiary">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-surface-secondary rounded-lg w-fit mx-auto mb-4">
          <button
            onClick={() => setMode("password")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === "password" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
            }`}
          >
            Password
          </button>
          <button
            onClick={() => setMode("magic-link")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === "magic-link" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
            }`}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Input
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />

          {mode === "password" && (
            <div className="relative">
              <Input
                label={t("auth.password")}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-text-tertiary hover:text-text-secondary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          <Button type="submit" variant="primary" size="md" className="w-full" loading={loading}>
            {mode === "magic-link" ? (
              <><Mail className="h-4 w-4" /> Send Magic Link</>
            ) : (
              t("auth.signIn")
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          {t("auth.noAccount")}{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
