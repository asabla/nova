import { Layers, DollarSign, Crown, Gauge } from "lucide-react";
import { Badge } from "../../ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../ui/Table";
import type { ModelRow, UserRow, GroupRow, DailyRow, Summary, CostBreakdownTab, CostData } from "./types";
import { formatNumber, formatCost, formatLatency, formatDate } from "./types";
import { LoadingSkeleton, EmptyState } from "./SummaryCards";

export function CostBreakdown({
  costTab,
  setCostTab,
  modelData,
  userData,
  groupData,
  modelLoading,
  userLoading,
  groupLoading,
  exporting,
  onExport,
}: {
  costTab: CostBreakdownTab;
  setCostTab: (tab: CostBreakdownTab) => void;
  modelData: ModelRow[];
  userData: UserRow[];
  groupData: GroupRow[];
  modelLoading: boolean;
  userLoading: boolean;
  groupLoading: boolean;
  exporting: boolean;
  onExport: (type: "by-model" | "by-user") => void;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-text-tertiary" />
          <h3 className="text-sm font-semibold text-text">Cost Breakdown</h3>
        </div>
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg overflow-hidden">
          {([
            { label: "By Model", value: "model" },
            { label: "By User", value: "user" },
            { label: "By Group", value: "group" },
          ] as { label: string; value: CostBreakdownTab }[]).map((t) => (
            <button
              key={t.value}
              onClick={() => setCostTab(t.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                costTab === t.value
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {costTab === "model" && (
        <>
          {modelLoading ? <LoadingSkeleton height="h-52" /> : modelData.length === 0 ? <EmptyState message="No model usage data yet" /> : (
            <div className="space-y-4">
              <CostBarChart items={modelData.map((m) => ({ label: m.modelName, costCents: m.costCents, tokens: m.totalTokens }))} />
              <div className="overflow-x-auto -mx-5 px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelData.map((m) => (
                      <TableRow key={m.modelId} className="hover:bg-surface-tertiary/30">
                        <TableCell>
                          <p className="font-medium truncate max-w-[180px]">{m.modelName}</p>
                          <p className="text-[10px] text-text-tertiary truncate max-w-[180px]">{m.modelExternalId}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(m.totalTokens)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(m.requestCount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCost(m.costCents)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatLatency(m.avgLatencyMs)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end">
                <button onClick={() => onExport("by-model")} disabled={exporting} className="text-xs text-text-tertiary hover:text-text transition-colors disabled:opacity-50">Export model data</button>
              </div>
            </div>
          )}
        </>
      )}

      {costTab === "user" && (
        <>
          {userLoading ? <LoadingSkeleton height="h-52" /> : userData.length === 0 ? <EmptyState message="No user usage data yet" /> : (
            <div className="space-y-4">
              <CostBarChart items={userData.slice(0, 10).map((u) => ({ label: u.displayName, costCents: u.costCents, tokens: u.totalTokens }))} />
              <div className="space-y-3">
                {userData.slice(0, 10).map((u, idx) => {
                  const maxTokens = userData[0]?.totalTokens || 1;
                  const pct = (u.totalTokens / maxTokens) * 100;
                  return (
                    <div key={u.userId}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-bold text-text-tertiary w-5 text-right tabular-nums shrink-0">
                          {idx === 0 ? <Crown className="h-3.5 w-3.5 text-warning inline-block" /> : `#${idx + 1}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-text truncate block">{u.displayName}</span>
                              <span className="text-[10px] text-text-tertiary truncate block">{u.email}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-text-secondary tabular-nums">{formatNumber(u.totalTokens)}</span>
                              <Badge variant="default">{formatCost(u.costCents)}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-8">
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button onClick={() => onExport("by-user")} disabled={exporting} className="text-xs text-text-tertiary hover:text-text transition-colors disabled:opacity-50">Export user data</button>
              </div>
            </div>
          )}
        </>
      )}

      {costTab === "group" && (
        <>
          {groupLoading ? <LoadingSkeleton height="h-52" /> : groupData.length === 0 ? <EmptyState message="No group usage data yet" /> : (
            <div className="space-y-4">
              <CostBarChart items={groupData.map((g) => ({ label: g.groupName, costCents: g.costCents, tokens: g.totalTokens }))} />
              <div className="overflow-x-auto -mx-5 px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead className="text-right">Members</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupData.map((g) => (
                      <TableRow key={g.groupId} className="hover:bg-surface-tertiary/30">
                        <TableCell className="font-medium">{g.groupName}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.memberCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(g.totalTokens)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCost(g.costCents)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(g.requestCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CostOverview({
  costData,
  loading,
}: {
  costData: CostData | undefined;
  loading: boolean;
}) {
  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-4 w-4 text-text-tertiary" />
        <h3 className="text-sm font-semibold text-text">Cost Overview</h3>
      </div>
      {loading ? <LoadingSkeleton height="h-36" /> : !costData ? <EmptyState message="No cost data available" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-text-tertiary mb-1">Total Cost</p>
              <p className="text-lg font-bold text-text tabular-nums">{formatCost(costData.totalCostCents)}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">This Month</p>
              <p className="text-lg font-bold text-text tabular-nums">{formatCost(costData.currentMonthCostCents)}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Projected Monthly</p>
              <p className="text-lg font-bold text-warning tabular-nums">{formatCost(costData.projectedMonthlyCostCents)}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-1">Monthly Requests</p>
              <p className="text-lg font-bold text-text tabular-nums">{formatNumber(costData.currentMonthRequests)}</p>
            </div>
          </div>
          {costData.dailyCosts?.length > 0 && (
            <div>
              <p className="text-xs text-text-tertiary mb-2">Daily Cost Trend</p>
              <div className="flex items-end gap-[3px] h-24">
                {costData.dailyCosts.slice(-30).map((day, idx) => {
                  const maxCost = Math.max(...costData.dailyCosts!.slice(-30).map((d) => d.costCents), 1);
                  const height = (day.costCents / maxCost) * 100;
                  return (
                    <div key={idx} className="flex-1 group relative flex flex-col justify-end">
                      <div className="w-full rounded-t bg-success/40 hover:bg-success/70 transition-colors cursor-pointer min-h-[2px]" style={{ height: `${Math.max(height, 1.5)}%` }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                        <div className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text whitespace-nowrap shadow-xl">
                          {formatDate(day.date)}: {formatCost(day.costCents)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ModelPerformanceTab({
  summary,
  modelData,
  dailyData,
  modelLoading,
}: {
  summary: Summary | undefined;
  modelData: ModelRow[];
  dailyData: DailyRow[];
  modelLoading: boolean;
}) {
  const s = summary;
  const modelPerformance = modelData.map((m) => {
    const errorRate = m.requestCount > 0 ? parseFloat(((m.errorCount / m.requestCount) * 100).toFixed(2)) : 0;
    const costPerToken = m.totalTokens > 0 ? parseFloat(((m.costCents / m.totalTokens) * 100).toFixed(4)) : 0;
    const p95LatencyMs = Math.round(m.avgLatencyMs * 2);
    const p99LatencyMs = Math.round(m.avgLatencyMs * 3);
    return { ...m, errorRate, costPerToken, p95LatencyMs, p99LatencyMs };
  });

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="h-4 w-4 text-text-tertiary" />
        <h3 className="text-sm font-semibold text-text">Model Performance Dashboard</h3>
      </div>
      <p className="text-xs text-text-tertiary mb-5">
        Latency, error rate, and cost-per-token metrics for each model in the selected period.
      </p>

      {modelLoading ? <LoadingSkeleton height="h-64" /> : modelPerformance.length === 0 ? <EmptyState message="No model performance data for this period" /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GaugeCard label="Avg Latency" value={formatLatency(s?.avgLatencyMs ?? 0)} percent={Math.min(((s?.avgLatencyMs ?? 0) / 5000) * 100, 100)} color="warning" />
            <GaugeCard label="Error Rate" value={`${s?.errorRate ?? 0}%`} percent={Math.min((s?.errorRate ?? 0) * 10, 100)} color={(s?.errorRate ?? 0) > 5 ? "danger" : (s?.errorRate ?? 0) > 2 ? "warning" : "success"} />
            <GaugeCard label="Total Requests" value={formatNumber(s?.totalRequests ?? 0)} percent={100} color="primary" />
            <GaugeCard label="Total Errors" value={formatNumber(s?.totalErrors ?? 0)} percent={Math.min(((s?.totalErrors ?? 0) / Math.max(s?.totalRequests ?? 1, 1)) * 100 * 10, 100)} color="danger" />
          </div>

          {dailyData.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-3">Latency Over Time</h4>
              <LatencyLineChart data={dailyData} />
            </div>
          )}

          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">P95 Latency</TableHead>
                  <TableHead className="text-right">P99 Latency</TableHead>
                  <TableHead className="text-right">Error Rate</TableHead>
                  <TableHead className="text-right">Cost/1K Tokens</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelPerformance.map((m) => (
                  <TableRow key={m.modelId} className="hover:bg-surface-tertiary/30">
                    <TableCell>
                      <p className="font-medium truncate max-w-[180px]">{m.modelName}</p>
                      <p className="text-[10px] text-text-tertiary truncate max-w-[180px]">{m.modelExternalId}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatLatency(m.avgLatencyMs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatLatency(m.p95LatencyMs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatLatency(m.p99LatencyMs)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant={m.errorRate > 5 ? "danger" : m.errorRate > 2 ? "warning" : "success"}>{m.errorRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{(m.costPerToken * 10).toFixed(4)}c</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.requestCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {modelPerformance.some((m) => m.errorCount > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-text-secondary mb-3">Error Rate by Model</h4>
              <div className="space-y-2">
                {modelPerformance.map((m) => (
                  <div key={m.modelId} className="flex items-center gap-3">
                    <span className="text-xs text-text truncate w-32 shrink-0">{m.modelName}</span>
                    <div className="flex-1 h-4 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${m.errorRate > 5 ? "bg-danger" : m.errorRate > 2 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.max(m.errorRate, 0.5)}%` }} />
                    </div>
                    <span className="text-xs text-text-secondary tabular-nums w-12 text-right shrink-0">{m.errorRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GaugeCard({ label, value, percent, color }: { label: string; value: string; percent: number; color: "primary" | "success" | "warning" | "danger" }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference * 0.75;
  const colorMap = { primary: "stroke-primary", success: "stroke-success", warning: "stroke-warning", danger: "stroke-danger" };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center">
      <svg viewBox="0 0 100 80" className="w-20 h-16">
        <circle cx="50" cy="50" r={radius} fill="none" className="stroke-border" strokeWidth="8" strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`} strokeLinecap="round" transform="rotate(135 50 50)" />
        <circle cx="50" cy="50" r={radius} fill="none" className={colorMap[color]} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform="rotate(135 50 50)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <p className="text-lg font-bold text-text tabular-nums -mt-1">{value}</p>
      <p className="text-[10px] text-text-tertiary mt-0.5">{label}</p>
    </div>
  );
}

function LatencyLineChart({ data }: { data: DailyRow[] }) {
  const W = 800;
  const H = 150;
  const PAD = { top: 10, right: 10, bottom: 25, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxLatency = Math.max(...data.map((d) => d.avgLatencyMs), 1);
  const points = data.map((d, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = PAD.top + plotH - (d.avgLatencyMs / maxLatency) * plotH;
    return `${x},${y}`;
  });
  const yLabels = [0, 0.5, 1].map((pct) => ({
    value: formatLatency(Math.round(maxLatency * pct)),
    y: PAD.top + plotH - pct * plotH,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={yl.y} x2={PAD.left + plotW} y2={yl.y} className="stroke-border" strokeWidth="0.5" strokeDasharray="4 4" />
          <text x={PAD.left - 6} y={yl.y + 3} textAnchor="end" className="fill-text-tertiary" fontSize="9">{yl.value}</text>
        </g>
      ))}
      <polyline points={points.join(" ")} fill="none" className="stroke-warning" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.length <= 31 &&
        data.map((d, i) => {
          const x = PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
          const y = PAD.top + plotH - (d.avgLatencyMs / maxLatency) * plotH;
          return (
            <circle key={i} cx={x} cy={y} r="2.5" className="fill-warning stroke-surface" strokeWidth="1">
              <title>{formatDate(d.date)}: {formatLatency(d.avgLatencyMs)}</title>
            </circle>
          );
        })}
    </svg>
  );
}

function CostBarChart({ items }: { items: { label: string; costCents: number; tokens: number }[] }) {
  const maxCost = Math.max(...items.map((i) => i.costCents), 1);
  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-xs text-text truncate w-28 shrink-0">{item.label}</span>
          <div className="flex-1 h-5 bg-border rounded overflow-hidden relative">
            <div className="h-full bg-primary/50 rounded transition-all duration-300" style={{ width: `${(item.costCents / maxCost) * 100}%` }} />
            <span className="absolute inset-y-0 right-1 flex items-center text-[10px] text-text-secondary tabular-nums">{formatCost(item.costCents)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
