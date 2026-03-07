import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Eye, EyeOff, Loader2, X } from "lucide-react";
import { authClient } from "../hooks/useAuth";
import { useAuthStore } from "../stores/auth.store";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const initOrg = useAuthStore((s) => s.initOrg);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);

  const handleSSO = (provider: string) => {
    setSsoLoading(provider);
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    window.location.href = `${apiUrl}/api/sso/${provider}/authorize`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (authError) {
        setError(authError.message ?? t("auth.signupFailed"));
        return;
      }

      if (data) {
        setSession(data);
        try {
          await initOrg();
        } catch {
          setError(t("auth.orgInitFailed", "Account created, but failed to initialize organization. Please try refreshing."));
          return;
        }
        navigate({ to: "/" });
      }
    } catch {
      setError(t("auth.signupFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-text">{t("auth.signUp")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("auth.signUpDescription")}</p>
        </div>

        {/* SSO Buttons */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => handleSSO("microsoft")}
            disabled={ssoLoading !== null}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface text-sm text-text hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ssoLoading === "microsoft" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            )}
            {t("auth.ssoMicrosoft", "Continue with Microsoft")}
          </button>
          <button
            onClick={() => handleSSO("google")}
            disabled={ssoLoading !== null}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface text-sm text-text hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ssoLoading === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            )}
            {t("auth.ssoGoogle", "Continue with Google")}
          </button>
          <button
            onClick={() => handleSSO("github")}
            disabled={ssoLoading !== null}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface text-sm text-text hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ssoLoading === "github" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            )}
            {t("auth.ssoGithub", "Continue with GitHub")}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-tertiary">{t("auth.or", "or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 mt-0.5 text-danger/70 hover:text-danger"
                aria-label={t("common.dismiss", "Dismiss")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Input
            label={t("auth.name")}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder", "Your name")}
            required
            autoFocus
          />

          <Input
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <div className="relative">
            <Input
              label={t("auth.password")}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center text-text-tertiary hover:text-text-secondary"
              aria-label={showPassword ? t("auth.hidePassword", "Hide password") : t("auth.showPassword", "Show password")}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <p className="text-xs text-text-tertiary mt-1">
              {t("auth.passwordRequirements", "Password must be at least 8 characters")}
            </p>
          </div>

          <Button type="submit" variant="primary" size="md" className="w-full" loading={loading}>
            {t("auth.createAccount")}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
