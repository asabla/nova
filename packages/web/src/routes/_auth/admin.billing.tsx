import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CreditCard, Check, Zap, Building2, Crown, ArrowUpRight } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/billing")({
  component: BillingPage,
});

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    color: "text-text-tertiary",
    features: [
      "5 users",
      "1,000 messages/month",
      "Basic models",
      "Community support",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$29",
    period: "/user/month",
    icon: Building2,
    color: "text-primary",
    popular: true,
    features: [
      "Unlimited users",
      "50,000 messages/month",
      "All models",
      "Custom agents",
      "Knowledge bases",
      "Priority support",
      "SSO",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    icon: Crown,
    color: "text-warning",
    features: [
      "Everything in Team",
      "Unlimited messages",
      "On-premise deployment",
      "Custom integrations",
      "SLA guarantee",
      "Dedicated support",
      "Audit logs",
      "SAML SSO",
      "Data retention controls",
    ],
  },
];

function BillingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["org-details"],
    queryFn: () => api.get<any>("/api/org"),
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ["org-usage"],
    queryFn: () => api.get<any>("/api/analytics/summary"),
  });

  const { data: paymentMethod } = useQuery({
    queryKey: ["payment-method"],
    queryFn: () => api.get<any>("/api/org/billing/payment-method"),
    retry: false,
  });

  const currentPlan = org?.billingPlan ?? "free";

  const changePlan = useMutation({
    mutationFn: (plan: string) => api.post("/api/org/billing/change-plan", { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      toast(t("admin.planUpdated", { defaultValue: "Plan updated" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.planUpdateFailed", { defaultValue: "Failed to update plan" }), "error"),
  });

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <div className="p-6 rounded-xl bg-surface-secondary border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-text">{t("admin.billingTitle", { defaultValue: "Billing & Plans" })}</h2>
              <p className="text-sm text-text-secondary mt-1">{t("admin.billingDescription", { defaultValue: "Manage your subscription and billing details" })}</p>
            </div>
          </div>
          {orgLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <Badge variant="primary" className="text-sm px-3 py-1">
              {t("admin.currentPlan", { defaultValue: "Current" })}: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
            </Badge>
          )}
        </div>

        {/* Usage Summary */}
        {usageLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : usage && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <UsageStat label={t("admin.messagesThisMonth", { defaultValue: "Messages This Month" })} value={(usage.totalRequests ?? 0).toLocaleString()} />
            <UsageStat label={t("admin.totalTokens", { defaultValue: "Total Tokens" })} value={`${((usage.totalTokens ?? 0) / 1000).toFixed(0)}K`} />
            <UsageStat label={t("admin.estimatedCost", { defaultValue: "Estimated Cost" })} value={`$${((usage.totalCostCents ?? 0) / 100).toFixed(2)}`} />
            <UsageStat label={t("admin.activeUsers", { defaultValue: "Active Users" })} value={(usage.activeUsers ?? 0).toLocaleString()} />
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-6 rounded-xl border transition-colors ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface-secondary hover:border-border-strong"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="primary">{t("admin.mostPopular", { defaultValue: "Most Popular" })}</Badge>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <Icon className={`h-5 w-5 ${plan.color}`} aria-hidden="true" />
                <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-text">{plan.price}</span>
                {plan.period && <span className="text-sm text-text-tertiary">{plan.period}</span>}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-3.5 w-3.5 text-success shrink-0" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button variant="ghost" size="sm" disabled className="w-full">
                  {t("admin.currentPlanLabel", { defaultValue: "Current Plan" })}
                </Button>
              ) : plan.id === "enterprise" ? (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => window.open("mailto:sales@nova.dev", "_blank")}>
                  {t("admin.contactSales", { defaultValue: "Contact Sales" })} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => changePlan.mutate(plan.id)}
                  loading={changePlan.isPending}
                >
                  {currentPlan === "free" ? t("admin.upgrade", { defaultValue: "Upgrade" }) : t("admin.switch", { defaultValue: "Switch" })} {t("admin.toPlan", { defaultValue: "to" })} {plan.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing Details */}
      <div className="p-6 rounded-xl bg-surface-secondary border border-border">
        <h3 className="text-sm font-medium text-text mb-4">{t("admin.paymentMethod", { defaultValue: "Payment Method" })}</h3>
        {org?.billingCustomerId ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
              <div>
                {paymentMethod?.last4 ? (
                  <>
                    <p className="text-sm text-text">**** **** **** {paymentMethod.last4}</p>
                    <p className="text-xs text-text-tertiary">
                      {t("admin.expires", { defaultValue: "Expires" })} {paymentMethod.expMonth}/{paymentMethod.expYear}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">{t("admin.paymentMethodOnFile", { defaultValue: "Payment method on file" })}</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toast(t("admin.paymentComingSoon", { defaultValue: "Payment method management coming soon" }), "info")}>
              {t("admin.update", { defaultValue: "Update" })}
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-text-tertiary">{t("admin.noPaymentMethod", { defaultValue: "No payment method on file" })}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => toast(t("admin.paymentComingSoon", { defaultValue: "Payment method management coming soon" }), "info")}>
              {t("admin.addPaymentMethod", { defaultValue: "Add Payment Method" })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-surface border border-border">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="text-lg font-semibold text-text mt-0.5">{value}</p>
    </div>
  );
}
