import { useState } from "react";
import { Check, X, MessageSquare, ListChecks, Send } from "lucide-react";
import type { UserInteractionRequest, UserInteractionResponse } from "@nova/shared/types";
import { api } from "../../lib/api";

interface InteractionPanelProps {
  request: UserInteractionRequest;
  conversationId: string;
  onResponded?: () => void;
}

export function InteractionPanel({ request, conversationId, onResponded }: InteractionPanelProps) {
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sendResponse = async (response: Omit<UserInteractionResponse, "requestId" | "type">) => {
    setSubmitting(true);
    try {
      await api.post(`/api/conversations/${conversationId}/interaction-response`, {
        requestId: request.id,
        type: request.type,
        ...response,
      });
      setSubmitted(true);
      onResponded?.();
    } catch (err) {
      console.error("[InteractionPanel] Failed to send response:", err, { conversationId, requestId: request.id, type: request.type });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-4 my-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success flex items-center gap-2">
        <Check className="h-4 w-4" />
        Response sent
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/20 flex items-center gap-2">
        {request.type === "option_selection" && <ListChecks className="h-4 w-4 text-primary" />}
        {request.type === "approval_gate" && <Check className="h-4 w-4 text-primary" />}
        {(request.type === "feedback_prompt" || request.type === "text_input") && (
          <MessageSquare className="h-4 w-4 text-primary" />
        )}
        <span className="text-sm font-medium text-text">{request.prompt}</span>
      </div>

      <div className="px-4 py-3">
        {/* Option selection */}
        {request.type === "option_selection" && request.options && (
          <div className="flex flex-wrap gap-2">
            {request.options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={submitting}
                onClick={() => sendResponse({ selectedOptionId: option.id })}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-border px-4 py-2.5 text-left hover:bg-muted/50 hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                <span className="text-sm font-medium text-text">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-text-secondary">{option.description}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Approval gate */}
        {request.type === "approval_gate" && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => sendResponse({ approved: true })}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Approve
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => sendResponse({ approved: false })}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
          </div>
        )}

        {/* Text input / feedback prompt */}
        {(request.type === "text_input" || request.type === "feedback_prompt") && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim() && !submitting) {
                  sendResponse({ textInput: textInput.trim() });
                }
              }}
              placeholder="Type your response..."
              disabled={submitting}
              className="flex-1 h-9 px-3 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="button"
              disabled={submitting || !textInput.trim()}
              onClick={() => sendResponse({ textInput: textInput.trim() })}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
