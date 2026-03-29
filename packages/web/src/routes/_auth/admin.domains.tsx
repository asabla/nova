import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Globe, Plus, Trash2, ShieldCheck, ShieldOff, Search } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";
import { Skeleton } from "../../components/ui/Skeleton";

export const Route = createFileRoute("/_auth/admin/domains")({
  component: DomainsPage,
});

interface DomainRule {
  id: string;
  domain: string;
  type: "allow" | "block";
  reason?: string;
  createdAt: string;
}

function DomainsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [newType, setNewType] = useState<"allow" | "block">("block");
  const [newReason, setNewReason] = useState("");
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState<{ allowed: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["domain-rules"],
    queryFn: () => api.get<{ data: DomainRule[] }>("/api/domains"),
  });

  const rules: DomainRule[] = (data as any)?.data ?? [];

  const addRule = useMutation({
    mutationFn: () => api.post("/api/domains", { domain: newDomain, type: newType, reason: newReason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-rules"] });
      setNewDomain("");
      setNewReason("");
      toast(t("admin.domains.ruleAdded", "Domain rule added"), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.domains.addFailed", "Failed to add rule"), "error"),
  });

  const removeRule = useMutation({
    mutationFn: (id: string) => api.delete(`/api/domains/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-rules"] });
      toast(t("admin.domains.ruleRemoved", "Domain rule removed"), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.domains.removeFailed", "Failed to remove rule"), "error"),
  });

  const checkUrl = async () => {
    try {
      const result = await api.post<{ allowed: boolean }>("/api/domains/check", { url: testUrl });
      setTestResult(result);
    } catch {
      toast(t("admin.domains.checkFailed", "Failed to check URL"), "error");
    }
  };

  const allowRules = rules.filter((r) => r.type === "allow");
  const blockRules = rules.filter((r) => r.type === "block");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text">{t("admin.domains.title", "Domain Rules")}</h2>
        <p className="text-sm text-text-secondary mt-1">
          {t("admin.domains.description", "Control which domains can be scraped when users reference URLs in conversations.")}
        </p>
      </div>

      {/* Add Rule Form */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-3">
        <h3 className="text-sm font-medium text-text">{t("admin.domains.addRule", "Add Rule")}</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-text-secondary mb-1">{t("admin.domains.domain", "Domain")}</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="w-full h-8 rounded-lg border border-border bg-surface px-2.5 text-sm text-text"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-text-secondary mb-1">{t("admin.domains.type", "Type")}</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "allow" | "block")}
              className="w-full h-8 rounded-lg border border-border bg-surface px-2 text-sm text-text"
            >
              <option value="block">{t("admin.domains.block", "Block")}</option>
              <option value="allow">{t("admin.domains.allow", "Allow")}</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-text-secondary mb-1">{t("admin.domains.reason", "Reason (optional)")}</label>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder={t("admin.domains.reasonPlaceholder", "Why this rule exists...")}
              className="w-full h-8 rounded-lg border border-border bg-surface px-2.5 text-sm text-text"
            />
          </div>
          <Button size="sm" onClick={() => addRule.mutate()} disabled={!newDomain.trim() || addRule.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("common.add", "Add")}
          </Button>
        </div>
      </div>

      {/* URL Test */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-3">
        <h3 className="text-sm font-medium text-text">{t("admin.domains.testUrl", "Test URL")}</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <input
              type="url"
              value={testUrl}
              onChange={(e) => { setTestUrl(e.target.value); setTestResult(null); }}
              placeholder="https://example.com/page"
              className="w-full h-8 rounded-lg border border-border bg-surface px-2.5 text-sm text-text"
            />
          </div>
          <Button variant="secondary" size="sm" onClick={checkUrl} disabled={!testUrl.trim()}>
            <Search className="h-3.5 w-3.5 mr-1" /> {t("admin.domains.check", "Check")}
          </Button>
          {testResult && (
            <Badge variant={testResult.allowed ? "success" : "danger"}>
              {testResult.allowed ? t("admin.domains.allowed", "Allowed") : t("admin.domains.blocked", "Blocked")}
            </Badge>
          )}
        </div>
      </div>

      {/* Rules Lists */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Block List */}
          <div>
            <h3 className="text-sm font-medium text-text flex items-center gap-1.5 mb-3">
              <ShieldOff className="h-4 w-4 text-danger" /> {t("admin.domains.blockedDomains", "Blocked Domains")}
              <span className="text-xs text-text-tertiary">({blockRules.length})</span>
            </h3>
            {blockRules.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4">{t("admin.domains.noBlockRules", "No blocked domains")}</p>
            ) : (
              <div className="space-y-1.5">
                {blockRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                    <div>
                      <span className="text-sm font-mono text-text">{rule.domain}</span>
                      {rule.reason && <p className="text-[10px] text-text-tertiary mt-0.5">{rule.reason}</p>}
                    </div>
                    <button
                      onClick={() => removeRule.mutate(rule.id)}
                      className="p-1 text-text-tertiary hover:text-danger rounded transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Allow List */}
          <div>
            <h3 className="text-sm font-medium text-text flex items-center gap-1.5 mb-3">
              <ShieldCheck className="h-4 w-4 text-success" /> {t("admin.domains.allowedDomains", "Allowed Domains")}
              <span className="text-xs text-text-tertiary">({allowRules.length})</span>
            </h3>
            {allowRules.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4">{t("admin.domains.noAllowRules", "No allow-list rules")}</p>
            ) : (
              <div className="space-y-1.5">
                {allowRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                    <div>
                      <span className="text-sm font-mono text-text">{rule.domain}</span>
                      {rule.reason && <p className="text-[10px] text-text-tertiary mt-0.5">{rule.reason}</p>}
                    </div>
                    <button
                      onClick={() => removeRule.mutate(rule.id)}
                      className="p-1 text-text-tertiary hover:text-danger rounded transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
