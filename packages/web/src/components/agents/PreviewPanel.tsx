import { useEffect, useRef } from "react";
import { Bot, Send, Loader2, User, Sparkles, RotateCcw, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAgentBgStyle, getAgentIconStyle } from "../../lib/agent-appearance";
import type { UseAgentFormReturn } from "./useAgentForm";

export function PreviewPanel({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const {
    form,
    agentColor,
    models,
    testMessages,
    testInput,
    setTestInput,
    sendTestMessage,
    resetTestChat,
    isTesting,
    configChangedSinceChat,
  } = ctx;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [testMessages]);

  const selectedModel = models.find(
    (m: any) => (m.modelIdExternal ?? m.id) === form.modelId,
  );
  const modelLabel = selectedModel?.name ?? "Default model";

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
            style={getAgentBgStyle(agentColor)}
          >
            <Bot className="h-2.5 w-2.5" style={getAgentIconStyle(agentColor)} aria-hidden="true" />
          </div>
          <span className="text-[11px] font-medium text-text-secondary truncate">
            {form.name || t("agents.preview", { defaultValue: "Preview" })}
          </span>
          <span className="text-[10px] text-text-tertiary px-1.5 py-0.5 rounded-md bg-surface-secondary border border-border leading-none">
            {modelLabel}
          </span>
        </div>
        {testMessages.length > 0 && (
          <button
            onClick={resetTestChat}
            className="p-1 rounded-md hover:bg-surface-secondary text-text-tertiary hover:text-text transition-colors"
            title={t("agents.resetChat", { defaultValue: "Reset chat" })}
            aria-label={t("agents.resetChat", { defaultValue: "Reset chat" })}
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Config changed banner */}
      {configChangedSinceChat && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/8 border-b border-warning/15 animate-in slide-in-from-top-2">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" aria-hidden="true" />
          <span className="text-[11px] text-warning/90 flex-1">
            {t("agents.configChanged", {
              defaultValue: "System prompt changed. Reset to test with new settings.",
            })}
          </span>
          <button
            onClick={resetTestChat}
            className="text-[11px] font-medium text-warning hover:text-warning/80 transition-colors px-2 py-0.5 rounded-md hover:bg-warning/10"
          >
            {t("agents.resetNow", { defaultValue: "Reset" })}
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        {testMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center stagger-children">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                ...getAgentBgStyle(agentColor),
                boxShadow: `0 0 32px -4px ${agentColor}25, 0 0 0 1px ${agentColor}10`,
              }}
            >
              <Bot
                className="h-7 w-7"
                style={getAgentIconStyle(agentColor)}
                aria-hidden="true"
              />
            </div>
            <h3 className="text-base font-semibold text-text mb-1">
              {t("agents.previewTitle", { defaultValue: "Preview your agent" })}
            </h3>
            <p className="text-sm text-text-tertiary max-w-xs mb-6 leading-relaxed">
              {t("agents.previewDesc", {
                defaultValue:
                  "Send a message to see how your agent responds with the current configuration.",
              })}
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {[
                t("agents.testSample1", { defaultValue: "Introduce yourself" }),
                t("agents.testSample2", { defaultValue: "What can you help me with?" }),
                t("agents.testSample3", { defaultValue: "Give me an example of your work" }),
                t("agents.testSample4", { defaultValue: "What are your limitations?" }),
              ].map((sample) => (
                <button
                  key={sample}
                  onClick={() => sendTestMessage(sample)}
                  className="text-left text-xs p-3 rounded-xl bg-surface border border-border text-text-secondary hover:border-border-strong hover:text-text transition-all hover:shadow-sm active:scale-[0.98]"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        )}

        {testMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 animate-in slide-up-fade ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role !== "user" && (
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={
                  msg.role === "error"
                    ? { backgroundColor: "rgba(239,68,68,0.15)" }
                    : getAgentBgStyle(agentColor)
                }
              >
                {msg.role === "error" ? (
                  <Sparkles className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                ) : (
                  <Bot
                    className="h-3.5 w-3.5"
                    style={getAgentIconStyle(agentColor)}
                    aria-hidden="true"
                  />
                )}
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : msg.role === "error"
                    ? "bg-danger/10 text-danger border border-danger/20 rounded-bl-md"
                    : "bg-surface-secondary border border-border text-text rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}

        {isTesting && (
          <div className="flex gap-3">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
              style={getAgentBgStyle(agentColor)}
            >
              <Bot
                className="h-3.5 w-3.5"
                style={getAgentIconStyle(agentColor)}
                aria-hidden="true"
              />
            </div>
            <div className="bg-surface-secondary border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: agentColor }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: agentColor, animationDelay: "0.2s" }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: agentColor, animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3 bg-surface">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative input-glow rounded-xl">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendTestMessage();
                }
              }}
              placeholder={t("agents.testInputPlaceholder", {
                defaultValue: "Type a message to test...",
              })}
              disabled={isTesting}
              className="w-full h-10 pl-4 pr-12 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary transition-colors"
            />
            <button
              onClick={() => sendTestMessage()}
              disabled={isTesting || !testInput.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all disabled:opacity-30 active:scale-90"
              style={
                !isTesting && testInput.trim()
                  ? { backgroundColor: `${agentColor}20`, color: agentColor }
                  : undefined
              }
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
