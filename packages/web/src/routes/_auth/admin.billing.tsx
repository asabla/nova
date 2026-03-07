import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Check, Zap, Building2, Crown, ArrowUpRight } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
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
      "1 workspace",
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
      "Unlimited workspaces",
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
  const queryClient = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["org-details"],
    queryFn: () => api.get<any>("/api/org"),
  });

  const { data: usage } = useQuery({
    queryKey: ["org-usage"],
    queryFn: () => api.get<any>("/api/analytics/summary"),
  });

  const currentPlan = org?.billingPlan ?? "free";

  const changePlan = useMutation({
    mutationFn: (plan: string) => api.post("/api/org/billing/change-plan", { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-details"] });
      toast("Plan updated", "success");
    },
  });

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <div className="p-6 rounded-xl bg-surface-secondary border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-text">Billing & Plans</h2>
              <p className="text-xs text-text-tertiary">Manage your subscription and billing details</p>
            </div>
          </div>
          <Badge variant="primary" className="text-sm px-3 py-1">
            Current: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
          </Badge>
        </div>

        {/* Usage Summary */}
        {usage && (
          <div className="grid grid-cols-4 gap-4 mt-6">
            <UsageStat label="Messages This Month" value={(usage.totalRequests ?? 0).toLocaleString()} />
            <UsageStat label="Total Tokens" value={`${((usage.totalTokens ?? 0) / 1000).toFixed(0)}K`} />
            <UsageStat label="Estimated Cost" value={`$${((usage.totalCostCents ?? 0) / 100).toFixed(2)}`} />
            <UsageStat label="Active Users" value={(usage.activeUsers ?? 0).toLocaleString()} />
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-3 gap-6">
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
                  <Badge variant="primary">Most Popular</Badge>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <Icon className={`h-5 w-5 ${plan.color}`} />
                <h3 className="text-lg font-semibold text-text">{plan.name}</h3>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-text">{plan.price}</span>
                {plan.period && <span className="text-sm text-text-tertiary">{plan.period}</span>}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-3.5 w-3.5 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <Button variant="ghost" size="sm" disabled className="w-full">
                  Current Plan
                </Button>
              ) : plan.id === "enterprise" ? (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => window.open("mailto:sales@nova.dev", "_blank")}>
                  Contact Sales <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => changePlan.mutate(plan.id)}
                  loading={changePlan.isPending}
                >
                  {currentPlan === "free" ? "Upgrade" : "Switch"} to {plan.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing Details */}
      <div className="p-6 rounded-xl bg-surface-secondary border border-border">
        <h3 className="text-sm font-medium text-text mb-4">Payment Method</h3>
        {org?.billingCustomerId ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-text-tertiary" />
              <div>
                <p className="text-sm text-text">**** **** **** 4242</p>
                <p className="text-xs text-text-tertiary">Expires 12/2028</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => toast("Payment method management coming soon", "info")}>Update</Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-text-tertiary">No payment method on file</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => toast("Payment method management coming soon", "info")}>Add Payment Method</Button>
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
