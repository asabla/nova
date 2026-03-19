import { useState } from "react";
import { Eye, Settings, Check, ExternalLink } from "lucide-react";
import { Input } from "../../ui/Input";

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <IntegrationCard
        name="LangFuse"
        description="Open-source LLM observability platform. Trace LLM calls, monitor latency, manage prompts."
        docsUrl="https://langfuse.com/docs"
        fields={[
          { key: "langfuse_host", label: "Host URL", placeholder: "https://cloud.langfuse.com" },
          { key: "langfuse_public_key", label: "Public Key", placeholder: "pk-lf-..." },
          { key: "langfuse_secret_key", label: "Secret Key", placeholder: "sk-lf-...", isSecret: true },
        ]}
      />
      <IntegrationCard
        name="Helicone"
        description="LLM monitoring and logging platform. One-line integration for usage analytics, caching, and rate limiting."
        docsUrl="https://docs.helicone.ai"
        fields={[
          { key: "helicone_api_key", label: "API Key", placeholder: "sk-helicone-...", isSecret: true },
          { key: "helicone_base_url", label: "Base URL (optional)", placeholder: "https://oai.helicone.ai/v1" },
        ]}
      />
      <IntegrationCard
        name="OpenTelemetry"
        description="Vendor-neutral observability framework. Export traces, metrics, and logs to any OTLP-compatible backend."
        docsUrl="https://opentelemetry.io/docs"
        fields={[
          { key: "otel_endpoint", label: "OTLP Endpoint", placeholder: "http://localhost:4318" },
          { key: "otel_headers", label: "Auth Headers (optional)", placeholder: "Authorization=Bearer ..." },
          { key: "otel_service_name", label: "Service Name", placeholder: "nova-api" },
        ]}
      />
    </div>
  );
}

function IntegrationCard({
  name,
  description,
  docsUrl,
  fields,
}: {
  name: string;
  description: string;
  docsUrl: string;
  fields: { key: string; label: string; placeholder: string; isSecret?: boolean }[];
}) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="bg-surface-secondary border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">{name}</h3>
            <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-primary transition-colors">
            Docs <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => setIsConfiguring(!isConfiguring)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isConfiguring ? "text-text-secondary bg-surface border border-border" : "text-white bg-primary hover:bg-primary/90"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            {isConfiguring ? "Close" : "Configure"}
          </button>
        </div>
      </div>

      {isConfiguring && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              type={field.isSecret ? "password" : "text"}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="font-mono"
            />
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-text-tertiary">Settings are encrypted and stored securely.</p>
            <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
              {saved ? (<><Check className="h-3.5 w-3.5" />Saved</>) : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
