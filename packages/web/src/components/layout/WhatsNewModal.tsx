import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import { Dialog } from "../ui/Dialog";

const STORAGE_KEY = "nova:last-seen-changelog-version";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

// Changelog entries — newest first. Add new entries at the top.
const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.3.0",
    date: "2026-04-04",
    title: "Security & UX Improvements",
    items: [
      "Role-based access control now enforced across all API endpoints",
      "Group model access restrictions are now enforced at request time",
      "User messages now appear on the right side for clearer visual separation",
      "Conversation execution mode (Direct/Sequential/Orchestrated) shown as a subtle border accent",
      "Slash command menu no longer overflows on small viewports",
      "New /prompt command opens a template picker for quick prompt insertion",
      "Loading status messages are more varied and context-aware",
      "Plan steps now show user-friendly descriptions alongside technical details",
      "Full prompt content is now viewable in the admin evals dashboard",
      "Agent prompts can be rolled back to any previous version",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-28",
    title: "Observability & Tracing",
    items: [
      "Distributed tracing across API, workers, and Redis event streams",
      "Grafana dashboards for API latency, Temporal workflows, and infrastructure health",
      "Prometheus metrics with 8 scrape targets",
      "Loki log aggregation from all Docker containers",
    ],
  },
];

const CURRENT_VERSION = CHANGELOG[0]?.version ?? "1.0.0";

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen !== CURRENT_VERSION) {
        // Small delay so it doesn't flash immediately on page load
        const timer = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  const handleClose = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    } catch { /* ignore */ }
  };

  if (CHANGELOG.length === 0) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("changelog.whatsNew", { defaultValue: "What's New" })}
      size="md"
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {CHANGELOG.slice(0, 3).map((entry) => (
          <div key={entry.version}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text">
                {entry.title}
              </h3>
              <span className="text-xs text-text-tertiary">
                v{entry.version} &middot; {entry.date}
              </span>
            </div>
            <ul className="space-y-1.5 ml-6">
              {entry.items.map((item, i) => (
                <li key={i} className="text-sm text-text-secondary list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
