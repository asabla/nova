import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Calendar, BarChart3, Bell, Activity, Link, Gauge } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { api, apiHeaders } from "../../lib/api";

import type {
  Summary, DailyRow, ModelRow, UserRow, GroupRow, Trends,
  CostData, BudgetAlert, BudgetStatus, AgentRun,
  CostBreakdownTab, MainTab, DatePreset,
} from "../../components/admin/analytics/types";
import { getDateRange, defaultDateRange } from "../../components/admin/analytics/types";
import { SummaryCards, TrendCards } from "../../components/admin/analytics/SummaryCards";
import { UsageChart } from "../../components/admin/analytics/UsageChart";
import { CostBreakdown, CostOverview, ModelPerformanceTab } from "../../components/admin/analytics/ModelBreakdown";
import { BudgetStatusSection, BudgetAlertRules, BudgetAlertForm } from "../../components/admin/analytics/BudgetAlerts";
import { AgentTracesTab } from "../../components/admin/analytics/AgentTraces";
import { IntegrationsTab } from "../../components/admin/analytics/IntegrationCards";

export const Route = createFileRoute("/_auth/admin/analytics")({
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customRange, setCustomRange] = useState(defaultDateRange);
  const [exporting, setExporting] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("overview");
  const [costTab, setCostTab] = useState<CostBreakdownTab>("model");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [deleteAlertTarget, setDeleteAlertTarget] = useState<string | null>(null);

  const dateRange = getDateRange(datePreset, customRange);
  const queryParams = `?from=${dateRange.from}&to=${dateRange.to}`;
  const daysCount = datePreset === "today" ? 1 : datePreset === "7d" ? 7 : datePreset === "90d" ? 90 : 30;

  // ── Queries ──────────────────────────────────────────────────────

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["analytics-summary", dateRange],
    queryFn: () => api.get<{ data: Summary }>(`/api/analytics/summary${queryParams}`),
    staleTime: 60_000,
  });

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ["analytics-daily", daysCount],
    queryFn: () => api.get<{ data: DailyRow[] }>(`/api/analytics/daily?days=${daysCount}`),
    staleTime: 60_000,
  });

  const { data: byModel, isLoading: modelLoading } = useQuery({
    queryKey: ["analytics-by-model", dateRange],
    queryFn: () => api.get<{ data: ModelRow[] }>(`/api/analytics/by-model${queryParams}`),
    staleTime: 60_000,
  });

  const { data: byUser, isLoading: userLoading } = useQuery({
    queryKey: ["analytics-by-user", dateRange],
    queryFn: () => api.get<{ data: UserRow[] }>(`/api/analytics/by-user${queryParams}&limit=10`),
    staleTime: 60_000,
  });

  const { data: byGroup, isLoading: groupLoading } = useQuery({
    queryKey: ["analytics-by-group", dateRange],
    queryFn: () => api.get<{ data: GroupRow[] }>(`/api/analytics/by-group${queryParams}`),
    staleTime: 60_000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["analytics-trends"],
    queryFn: () => api.get<{ data: Trends }>("/api/analytics/trends"),
    staleTime: 60_000,
  });

  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: ["analytics-costs", dateRange],
    queryFn: () => api.get<{ data: CostData }>(`/api/analytics/costs${queryParams}`),
    staleTime: 60_000,
  });

  const { data: budgetAlerts, isLoading: budgetAlertsLoading } = useQuery({
    queryKey: ["analytics-budget-alerts"],
    queryFn: () => api.get<{ data: BudgetAlert[] }>("/api/analytics/budget-alerts"),
    staleTime: 60_000,
  });

  const { data: budgetStatus, isLoading: budgetStatusLoading } = useQuery({
    queryKey: ["analytics-budget-status"],
    queryFn: () => api.get<{ data: BudgetStatus[] }>("/api/analytics/budget-status"),
    staleTime: 60_000,
  });

  const { data: traces, isLoading: tracesLoading } = useQuery({
    queryKey: ["analytics-traces", dateRange],
    queryFn: () => api.get<{ data: AgentRun[] }>(`/api/analytics/traces${queryParams}&limit=50`),
    staleTime: 60_000,
  });

  // ── Extracted data ──────────────────────────────────────────────

  const s = (summary as any)?.data as Summary | undefined;
  const dailyData = (((daily as any)?.data) ?? []) as DailyRow[];
  const modelData = (((byModel as any)?.data) ?? []) as ModelRow[];
  const userData = (((byUser as any)?.data) ?? []) as UserRow[];
  const groupData = (((byGroup as any)?.data) ?? []) as GroupRow[];
  const trendsData = (trends as any)?.data as Trends | undefined;
  const costData = (costs as any)?.data as CostData | undefined;
  const alertsData = (((budgetAlerts as any)?.data) ?? []) as BudgetAlert[];
  const statusData = (((budgetStatus as any)?.data) ?? []) as BudgetStatus[];
  const agentTraces = (((traces as any)?.data) ?? []) as AgentRun[];

  // ── Export handler ──────────────────────────────────────────────

  async function handleExport(type: "daily" | "by-model" | "by-user") {
    setExporting(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${baseUrl}/api/analytics/export`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(),
        body: JSON.stringify({ type, from: dateRange.from, to: dateRange.to }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nova-analytics-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // ── Budget alert mutations ─────────────────────────────────────

  const createAlertMutation = useMutation({
    mutationFn: (data: Omit<BudgetAlert, "id" | "createdAt">) => api.post("/api/analytics/budget-alerts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-status"] });
      setShowBudgetForm(false);
    },
    onError: (err: any) => toast(err.message ?? t("admin.alertCreateFailed", { defaultValue: "Failed to create alert" }), "error"),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/analytics/budget-alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-status"] });
    },
    onError: (err: any) => toast(err.message ?? t("admin.alertDeleteFailed", { defaultValue: "Failed to delete alert" }), "error"),
  });

  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => api.patch(`/api/analytics/budget-alerts/${id}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-budget-status"] });
    },
    onError: (err: any) => toast(err.message ?? t("admin.alertToggleFailed", { defaultValue: "Failed to toggle alert" }), "error"),
  });

  // ── Date presets & tabs ─────────────────────────────────────────

  const presets: { label: string; value: DatePreset }[] = [
    { label: "Today", value: "today" },
    { label: "7 days", value: "7d" },
    { label: "30 days", value: "30d" },
    { label: "90 days", value: "90d" },
    { label: "Custom", value: "custom" },
  ];

  const mainTabs: { label: string; value: MainTab; icon: React.ReactNode }[] = [
    { label: "Overview", value: "overview", icon: <BarChart3 className="h-4 w-4" /> },
    { label: "Model Performance", value: "performance", icon: <Gauge className="h-4 w-4" /> },
    { label: "Budget Alerts", value: "budgets", icon: <Bell className="h-4 w-4" /> },
    { label: "Agent Traces", value: "traces", icon: <Activity className="h-4 w-4" /> },
    { label: "Integrations", value: "integrations", icon: <Link className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header with date range picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("admin.analyticsTitle", { defaultValue: "Analytics Overview" })}</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.analyticsDescription", { defaultValue: "Organization-wide usage metrics, costs, and trends." })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-surface-secondary border border-border rounded-lg overflow-hidden">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  datePreset === p.value ? "bg-primary text-white" : "text-text-secondary hover:text-text hover:bg-surface-tertiary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-text-tertiary shrink-0" />
              <Input type="date" value={customRange.from} onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))} />
              <span className="text-text-tertiary text-sm">to</span>
              <Input type="date" value={customRange.to} onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          )}
          <button
            onClick={() => handleExport("daily")}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Main tab navigation */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {mainTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setMainTab(tab.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              mainTab === tab.value ? "border-primary text-primary" : "border-transparent text-text-tertiary hover:text-text hover:border-border"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {mainTab === "overview" && (
        <>
          <SummaryCards summary={s} loading={summaryLoading} />
          <TrendCards trends={trendsData} loading={trendsLoading} />
          <UsageChart data={dailyData} loading={dailyLoading} />
          <CostBreakdown
            costTab={costTab}
            setCostTab={setCostTab}
            modelData={modelData}
            userData={userData}
            groupData={groupData}
            modelLoading={modelLoading}
            userLoading={userLoading}
            groupLoading={groupLoading}
            exporting={exporting}
            onExport={handleExport}
          />
          <CostOverview costData={costData} loading={costsLoading} />

          {/* Export section */}
          <div className="bg-surface-secondary border border-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text">Export Data</h3>
                <p className="text-xs text-text-tertiary mt-0.5">Download analytics data as CSV for the selected date range.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(["daily", "by-model", "by-user"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleExport(type)}
                    disabled={exporting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-surface-tertiary transition-colors disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {type === "daily" ? "Daily" : type === "by-model" ? "By Model" : "By User"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab: Model Performance */}
      {mainTab === "performance" && (
        <ModelPerformanceTab summary={s} modelData={modelData} dailyData={dailyData} modelLoading={modelLoading} />
      )}

      {/* Tab: Budget Alerts */}
      {mainTab === "budgets" && (
        <>
          <BudgetStatusSection statusData={statusData} loading={budgetStatusLoading} />
          <BudgetAlertRules
            alertsData={alertsData}
            loading={budgetAlertsLoading}
            onShowForm={() => setShowBudgetForm(true)}
            onDeleteAlert={(id) => setDeleteAlertTarget(id)}
            onToggleAlert={(id, isEnabled) => toggleAlertMutation.mutate({ id, isEnabled })}
            deleteLoading={deleteAlertMutation.isPending}
          />
          {showBudgetForm && (
            <BudgetAlertForm
              onSubmit={(data) => createAlertMutation.mutate(data)}
              onCancel={() => setShowBudgetForm(false)}
              isSubmitting={createAlertMutation.isPending}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteAlertTarget}
        onClose={() => setDeleteAlertTarget(null)}
        onConfirm={() => {
          if (deleteAlertTarget) deleteAlertMutation.mutate(deleteAlertTarget);
          setDeleteAlertTarget(null);
        }}
        title="Delete Budget Alert"
        description="Are you sure you want to delete this budget alert? This action cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteAlertMutation.isPending}
      />

      {/* Tab: Agent Traces */}
      {mainTab === "traces" && (
        <AgentTracesTab
          traces={agentTraces}
          loading={tracesLoading}
          expandedTraceId={expandedTraceId}
          onToggleTrace={(id) => setExpandedTraceId(expandedTraceId === id ? null : id)}
        />
      )}

      {/* Tab: Integrations */}
      {mainTab === "integrations" && <IntegrationsTab />}
    </div>
  );
}
