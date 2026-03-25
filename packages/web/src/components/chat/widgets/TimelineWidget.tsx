import { format, parseISO, isPast, isToday } from "date-fns";

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
}

const DEFAULT_EVENTS: TimelineEvent[] = [
  { date: "2025-01-15", title: "Project kickoff", description: "Initial planning and team assembly" },
  { date: "2025-03-01", title: "Alpha release", description: "Core features complete" },
  { date: "2025-06-15", title: "Public launch" },
];

function formatDate(dateStr: string): string {
  try {
    const parsed = parseISO(dateStr);
    return format(parsed, "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

export function TimelineWidget({ params }: { params?: Record<string, string> }) {
  let events: TimelineEvent[] = DEFAULT_EVENTS;
  let error: string | null = null;

  if (params?.events) {
    try {
      const raw = params.events;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        events = parsed;
      }
    } catch {
      error = "Invalid events JSON";
    }
  }

  if (error) {
    return (
      <div className="px-4 py-3">
        <div className="text-xs text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[4px] top-1 bottom-1 w-0.5 bg-border" />

        <div className="space-y-1">
          {events.map((event, i) => {
            const eventDate = parseISO(event.date);
            const past = isPast(eventDate) && !isToday(eventDate);

            return (
              <div
                key={i}
                className={`relative flex items-start gap-3 pl-5 rounded-lg py-1.5 px-2 ${i % 2 === 0 ? "bg-surface-tertiary/30" : ""}`}
              >
                {/* Dot on the line — filled for past, outlined for future */}
                {past ? (
                  <div className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                ) : (
                  <div className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-primary bg-surface shrink-0" />
                )}

                <div className="min-w-0">
                  <div className="text-[10px] text-text-tertiary">{formatDate(event.date)}</div>
                  <div className="text-xs font-medium text-text">{event.title}</div>
                  {event.description && (
                    <div className="text-xs text-text-secondary mt-0.5">{event.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
