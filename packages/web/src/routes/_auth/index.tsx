import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MessageSquarePlus, Sparkles, Zap, Shield, Users } from "lucide-react";
import { Button } from "../../components/ui/Button";

export const Route = createFileRoute("/_auth/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-text mb-2">
          {t("app.welcome")}
        </h1>
        <p className="text-text-secondary mb-8">
          {t("app.description")}
        </p>

        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate({ to: "/conversations/new" })}
          className="mx-auto"
        >
          <MessageSquarePlus className="h-5 w-5" />
          {t("conversations.new")}
        </Button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left">
          <Feature
            icon={<Zap className="h-5 w-5 text-warning" />}
            title={t("app.featureFast")}
            description={t("app.featureFastDescription")}
          />
          <Feature
            icon={<Shield className="h-5 w-5 text-success" />}
            title={t("app.featurePrivate")}
            description={t("app.featurePrivateDescription")}
          />
          <Feature
            icon={<Users className="h-5 w-5 text-primary" />}
            title={t("app.featureTeams")}
            description={t("app.featureTeamsDescription")}
          />
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-surface-secondary border border-border">
      <div className="mb-2">{icon}</div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-tertiary leading-relaxed">{description}</p>
    </div>
  );
}
