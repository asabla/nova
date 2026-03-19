import { useState } from "react";
import { AlertTriangle, Bell, Shield, Check, Plus, Trash2, X } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../ui/Table";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Checkbox } from "../../ui/Checkbox";
import type { BudgetAlert, BudgetStatus } from "./types";
import { formatNumber, formatCost } from "./types";
import { LoadingSkeleton, EmptyState } from "./SummaryCards";

export function BudgetStatusSection({
  statusData,
  loading,
}: {
  statusData: BudgetStatus[];
  loading: boolean;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text">Budget Status</h3>
        </div>
      </div>

      {loading ? <LoadingSkeleton height="h-32" /> : statusData.length === 0 ? (
        <EmptyState message="No budget alerts configured. Create one below to start monitoring spend." />
      ) : (
        <div className="space-y-4">
          {statusData.map((bs) => (
            <div
              key={bs.alertId}
              className={`p-4 rounded-lg border ${
                bs.isExceeded ? "bg-danger/5 border-danger/30" : bs.isWarning ? "bg-warning/5 border-warning/30" : "bg-surface border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {bs.isExceeded ? <AlertTriangle className="h-4 w-4 text-danger" /> : bs.isWarning ? <AlertTriangle className="h-4 w-4 text-warning" /> : <Check className="h-4 w-4 text-success" />}
                  <span className="text-sm font-medium text-text">{bs.name}</span>
                  <Badge variant="default">{bs.scope}</Badge>
                  <Badge variant="default">{bs.period}</Badge>
                </div>
                <span className="text-sm font-bold tabular-nums text-text">{bs.percentage}%</span>
              </div>
              <div className="h-2.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bs.isExceeded ? "bg-danger" : bs.isWarning ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${Math.min(Math.max(bs.percentage, 0.5), 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs text-text-tertiary">
                <span>Current: {bs.thresholdType === "tokens" ? formatNumber(bs.currentValue) : formatCost(bs.currentValue)}</span>
                <span>Limit: {bs.thresholdType === "tokens" ? formatNumber(bs.thresholdValue) : formatCost(bs.thresholdValue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BudgetAlertRules({
  alertsData,
  loading,
  onShowForm,
  onDeleteAlert,
  onToggleAlert,
  deleteLoading,
}: {
  alertsData: BudgetAlert[];
  loading: boolean;
  onShowForm: () => void;
  onDeleteAlert: (id: string) => void;
  onToggleAlert: (id: string, isEnabled: boolean) => void;
  deleteLoading: boolean;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text">Budget Alert Rules</h3>
        </div>
        <button
          onClick={onShowForm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Alert
        </button>
      </div>

      {loading ? <LoadingSkeleton height="h-32" /> : alertsData.length === 0 ? <EmptyState message="No budget alerts configured yet" /> : (
        <div className="overflow-x-auto -mx-5 px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead className="text-center">Notify</TableHead>
                <TableHead className="text-center">Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertsData.map((alert) => (
                <TableRow key={alert.id} className="hover:bg-surface-tertiary/30">
                  <TableCell className="font-medium">{alert.name}</TableCell>
                  <TableCell><Badge variant="default">{alert.scope}</Badge></TableCell>
                  <TableCell className="text-text-secondary capitalize">{alert.period}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {alert.thresholdType === "tokens" ? `${formatNumber(alert.thresholdValue)} tokens` : formatCost(alert.thresholdValue)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {alert.notifyEmail && <Badge variant="primary">Email</Badge>}
                      {alert.notifyWebhook && <Badge variant="primary">Webhook</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => onToggleAlert(alert.id, !alert.isEnabled)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${alert.isEnabled ? "bg-primary" : "bg-border"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${alert.isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <button onClick={() => onDeleteAlert(alert.id)} className="text-text-tertiary hover:text-danger transition-colors p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function BudgetAlertForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"org" | "group" | "user">("org");
  const [thresholdType, setThresholdType] = useState<"cost_cents" | "tokens">("cost_cents");
  const [thresholdValue, setThresholdValue] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWebhook, setNotifyWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = thresholdType === "cost_cents" ? Math.round(parseFloat(thresholdValue) * 100) : parseInt(thresholdValue);
    onSubmit({
      name, scope, thresholdType, thresholdValue: value, period,
      notifyEmail, notifyWebhook, webhookUrl: notifyWebhook ? webhookUrl : undefined, isEnabled: true,
    });
  }

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">Create Budget Alert</h3>
        <button onClick={onCancel} className="text-text-tertiary hover:text-text transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Alert Name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly cost limit" required />
          <Select label="Scope" value={scope} onChange={(value) => setScope(value as any)} options={[{ value: "org", label: "Organization" }, { value: "group", label: "Group" }, { value: "user", label: "User" }]} />
          <Select label="Threshold Type" value={thresholdType} onChange={(value) => setThresholdType(value as any)} options={[{ value: "cost_cents", label: "Cost ($)" }, { value: "tokens", label: "Tokens" }]} />
          <Input label={`Threshold Value${thresholdType === "cost_cents" ? " ($)" : " (tokens)"}`} type="number" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} placeholder={thresholdType === "cost_cents" ? "100.00" : "1000000"} required min="0" step={thresholdType === "cost_cents" ? "0.01" : "1"} />
          <Select label="Period" value={period} onChange={(value) => setPeriod(value as any)} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
          <div className="space-y-2">
            <span className="block text-xs text-text-secondary mb-1">Notifications</span>
            <Checkbox checked={notifyEmail} onChange={(checked) => setNotifyEmail(checked)} label="Email notification" />
            <Checkbox checked={notifyWebhook} onChange={(checked) => setNotifyWebhook(checked)} label="Webhook notification" />
          </div>
        </div>
        {notifyWebhook && (
          <Input label="Webhook URL" type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.example.com/budget-alert" required />
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors">Cancel</button>
          <button type="submit" disabled={isSubmitting || !name || !thresholdValue} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isSubmitting ? <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Alert
          </button>
        </div>
      </form>
    </div>
  );
}
