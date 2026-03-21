import { useState, useEffect } from "react";
import { ArrowLeftRight, RefreshCw, AlertTriangle } from "lucide-react";

export function CurrencyWidget({ params }: { params?: Record<string, string> }) {
  const from = params?.from ?? "USD";
  const to = params?.to ?? "EUR";
  const initialAmount = params?.amount ? Number(params.amount) : 1;

  const [amount, setAmount] = useState(initialAmount);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(
      `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
      { signal: AbortSignal.timeout(10_000) },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        const fetched = json?.rates?.[to];
        if (typeof fetched !== "number") throw new Error("Rate not found");
        setRate(fetched);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <RefreshCw className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || rate === null) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Could not load exchange rate: {error ?? "No data"}</span>
      </div>
    );
  }

  const converted = amount * rate;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-xs text-text-tertiary mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full rounded-md border border-border bg-surface-secondary px-3 py-1.5 text-sm text-text outline-none focus:ring-1 focus:ring-primary"
            min={0}
            step="any"
          />
        </div>
        <div className="pt-4">
          <ArrowLeftRight className="h-4 w-4 text-text-tertiary" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-xs text-text-tertiary mb-1">{to}</div>
          <div className="text-2xl font-light text-text">{converted.toFixed(2)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-text-secondary bg-surface-tertiary rounded-md px-3 py-1.5">
        <span className="font-medium">
          1 {from} = {rate.toFixed(4)} {to}
        </span>
        <span className="text-text-tertiary">Live rate</span>
      </div>
    </div>
  );
}
