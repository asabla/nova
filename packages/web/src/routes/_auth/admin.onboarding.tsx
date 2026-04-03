import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Building2, Palette, Bot, Users, Shield, Check, ArrowRight, ArrowLeft,
  Sparkles, Loader2,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";
import { queryKeys } from "../../lib/query-keys";

export const Route = createFileRoute("/_auth/admin/onboarding")({
  component: OrgOnboardingPage,
});

interface OrgOnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

function OrgOnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Fetch marketplace agents for step 3
  const { data: marketplaceData } = useQuery({
    queryKey: ["marketplace-agents-onboarding"],
    queryFn: () => api.get<any>("/api/agents/marketplace/browse"),
    staleTime: 60_000,
  });
  const marketplaceAgents: any[] = (marketplaceData as any)?.data ?? [];

  // Install selected agents
  const installAgents = useMutation({
    mutationFn: async (agentIds: string[]) => {
      for (const id of agentIds) {
        await api.post(`/api/agents/marketplace/${id}/install`);
      }
    },
  });

  // Complete org onboarding
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      // Install selected marketplace agents
      if (selectedAgents.length > 0) {
        await installAgents.mutateAsync(selectedAgents);
      }
      // Mark org onboarding as complete via org settings
      await api.put("/api/org/settings", { key: "onboarding_completed", value: "true" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      toast(t("admin.onboarding.completed", "Organization setup complete!"), "success");
      navigate({ to: "/admin" });
    },
    onError: () => {
      toast(t("admin.onboarding.failed", "Setup failed. Please try again."), "error");
    },
  });

  const steps: OrgOnboardingStep[] = [
    {
      id: "welcome",
      title: t("admin.onboarding.welcomeTitle", "Set Up Your Organization"),
      description: t("admin.onboarding.welcomeDesc", "Let's configure NOVA for your team"),
      icon: Building2,
      content: (
        <div className="text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">
              {t("admin.onboarding.welcomeHeading", "Welcome, Admin")}
            </h2>
            <p className="text-sm text-text-secondary mt-2 max-w-lg mx-auto">
              {t("admin.onboarding.welcomeBody", "This wizard will help you configure NOVA for your organization. You can always change these settings later in the admin panel.")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
            <SetupCard icon={Palette} title="Branding" desc="Logo, colors, theme" />
            <SetupCard icon={Bot} title="Agents" desc="Install AI assistants" />
            <SetupCard icon={Users} title="Team" desc="Invite members" />
            <SetupCard icon={Shield} title="Security" desc="Policies & SSO" />
          </div>
        </div>
      ),
    },
    {
      id: "branding",
      title: t("admin.onboarding.brandingTitle", "Branding"),
      description: t("admin.onboarding.brandingDesc", "Customize the look and feel"),
      icon: Palette,
      content: (
        <div className="space-y-6 max-w-lg mx-auto">
          <h3 className="text-lg font-semibold text-text text-center">
            {t("admin.onboarding.brandingHeading", "Customize Your Workspace")}
          </h3>
          <p className="text-sm text-text-secondary text-center">
            {t("admin.onboarding.brandingBody", "You can upload your logo, set brand colors, and configure the login page in Settings > Branding. For now, we'll use the defaults.")}
          </p>
          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <p className="text-xs text-text-tertiary">
              {t("admin.onboarding.brandingTip", "Tip: Navigate to Admin > Branding after setup to upload your company logo and set your primary brand color.")}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "agents",
      title: t("admin.onboarding.agentsTitle", "Install Agents"),
      description: t("admin.onboarding.agentsDesc", "Choose AI agents for your team"),
      icon: Bot,
      content: (
        <div className="space-y-4 max-w-lg mx-auto">
          <h3 className="text-lg font-semibold text-text text-center">
            {t("admin.onboarding.agentsHeading", "Select Agents to Install")}
          </h3>
          <p className="text-sm text-text-secondary text-center">
            {t("admin.onboarding.agentsBody", "These platform agents will be available to all members of your organization.")}
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {marketplaceAgents.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-4">
                {t("admin.onboarding.noAgents", "No marketplace agents available yet.")}
              </p>
            ) : (
              marketplaceAgents.map((agent: any) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgents((prev) =>
                        isSelected ? prev.filter((id) => id !== agent.id) : [...prev, agent.id],
                      );
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:border-border-strong"
                    }`}
                  >
                    <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-primary border-primary text-white" : "border-border"
                    }`}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">{agent.name}</p>
                      {agent.description && (
                        <p className="text-xs text-text-tertiary truncate">{agent.description}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <p className="text-xs text-text-tertiary text-center">
            {selectedAgents.length} {t("admin.onboarding.agentsSelected", "selected")}
          </p>
        </div>
      ),
    },
    {
      id: "team",
      title: t("admin.onboarding.teamTitle", "Team Setup"),
      description: t("admin.onboarding.teamDesc", "Invite your team members"),
      icon: Users,
      content: (
        <div className="space-y-6 max-w-lg mx-auto">
          <h3 className="text-lg font-semibold text-text text-center">
            {t("admin.onboarding.teamHeading", "Invite Your Team")}
          </h3>
          <p className="text-sm text-text-secondary text-center">
            {t("admin.onboarding.teamBody", "You can invite team members now or later from Admin > Members. For SSO-based organizations, users will be auto-provisioned on first login.")}
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-surface-secondary border border-border">
              <p className="text-sm font-medium text-text">Admin > Members</p>
              <p className="text-xs text-text-tertiary mt-1">Invite users via email or configure SSO for automatic provisioning</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-secondary border border-border">
              <p className="text-sm font-medium text-text">Admin > SSO</p>
              <p className="text-xs text-text-tertiary mt-1">Connect Azure AD, Google, or GitHub for single sign-on</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-secondary border border-border">
              <p className="text-sm font-medium text-text">Admin > Groups</p>
              <p className="text-xs text-text-tertiary mt-1">Organize users into groups with model access and spending controls</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "complete",
      title: t("admin.onboarding.completeTitle", "All Set!"),
      description: t("admin.onboarding.completeDesc", "Your organization is ready"),
      icon: Check,
      content: (
        <div className="text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">
              {t("admin.onboarding.completeHeading", "Your Organization is Ready!")}
            </h2>
            <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
              {selectedAgents.length > 0
                ? t("admin.onboarding.completeBodyWithAgents", {
                    count: selectedAgents.length,
                    defaultValue: `${selectedAgents.length} agent(s) will be installed. You can manage everything from the admin panel.`,
                  })
                : t("admin.onboarding.completeBody", "You can manage agents, members, and settings from the admin panel anytime.")}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => completeOnboarding.mutate()}
            loading={completeOnboarding.isPending}
          >
            {completeOnboarding.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {t("admin.onboarding.finish", "Complete Setup")}
          </Button>
        </div>
      ),
    },
  ];

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentStep ? "w-8 bg-primary" : i < currentStep ? "w-2 bg-primary/50" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="w-full max-w-xl">{step.content}</div>

      {/* Navigation */}
      {!isLast && (
        <div className="flex items-center gap-4 mt-8">
          {!isFirst && (
            <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("common.back", "Back")}
            </Button>
          )}
          <Button variant="primary" onClick={() => setCurrentStep((s) => s + 1)}>
            {isFirst ? t("common.getStarted", "Get Started") : t("common.next", "Next")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          {isFirst && (
            <button
              onClick={() => completeOnboarding.mutate()}
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              {t("admin.onboarding.skip", "Skip setup")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SetupCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        <p className="text-[10px] text-text-tertiary">{desc}</p>
      </div>
    </div>
  );
}
