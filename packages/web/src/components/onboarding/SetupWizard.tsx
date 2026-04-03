import { useState } from "react";
import { Shield, Database, Cpu, Check, ArrowRight, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);

  const { data: healthData } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<any>("/health/ready"),
    refetchInterval: 5000,
  });

  const services = [
    { name: "PostgreSQL", status: healthData?.db ?? "checking" },
    { name: "Redis", status: healthData?.redis ?? "checking" },
    { name: "RustFS", status: healthData?.minio ?? "checking" },
    { name: "LiteLLM", status: healthData?.litellm ?? "checking" },
    { name: "Temporal", status: healthData?.temporal ?? "checking" },
  ];

  const allHealthy = services.every((s) => s.status === "ok" || s.status === "healthy");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-text mb-2">System Setup</h1>
      <p className="text-text-secondary mb-8">Let's make sure everything is connected properly.</p>

      {/* Service Health */}
      <div className="space-y-3 mb-8">
        <h3 className="text-sm font-medium text-text flex items-center gap-2">
          <Database className="h-4 w-4" />
          Service Health
        </h3>
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
            <span className="text-sm text-text">{service.name}</span>
            <span className={`flex items-center gap-1 text-xs ${
              service.status === "ok" || service.status === "healthy"
                ? "text-success"
                : service.status === "checking"
                  ? "text-text-tertiary"
                  : "text-danger"
            }`}>
              {service.status === "ok" || service.status === "healthy" ? (
                <><Check className="h-3.5 w-3.5" /> Connected</>
              ) : service.status === "checking" ? (
                "Checking..."
              ) : (
                <><AlertCircle className="h-3.5 w-3.5" /> Unavailable</>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onComplete}>Skip for now</Button>
        <Button
          variant="primary"
          onClick={onComplete}
          disabled={!allHealthy}
        >
          <Check className="h-4 w-4" />
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
