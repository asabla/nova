import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import clsx from "clsx";

export function CalendarWidget({ params }: { params?: Record<string, string> }) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (params?.month) {
      const parsed = parseISO(`${params.month}-01`);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  });

  const highlights = useMemo(() => {
    if (!params?.highlights) return [];
    return params.highlights
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => parseISO(s))
      .filter((d) => !isNaN(d.getTime()));
  }, [params?.highlights]);

  const labels = useMemo<Record<string, string>>(() => {
    if (!params?.labels) return {};
    if (typeof params.labels !== "string") return params.labels as unknown as Record<string, string>;
    try {
      return JSON.parse(params.labels);
    } catch {
      return {};
    }
  }, [params?.labels]);

  const today = useMemo(() => new Date(), []);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const isCurrentMonth = (day: Date) =>
    day.getMonth() === currentMonth.getMonth() && day.getFullYear() === currentMonth.getFullYear();

  const isHighlighted = (day: Date) => highlights.some((h) => isSameDay(h, day));

  const isToday = (day: Date) => isSameDay(day, today);

  const getLabel = (day: Date): string | undefined => {
    const key = format(day, "yyyy-MM-dd");
    return labels[key];
  };

  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-1 rounded-lg text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-1 rounded-lg text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-text-tertiary py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day) => {
          const highlighted = isHighlighted(day);
          const label = getLabel(day);
          const inMonth = isCurrentMonth(day);
          const todayDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              title={label}
              className={clsx(
                "flex items-center justify-center h-7 w-full rounded text-xs transition-colors",
                !inMonth && "opacity-30",
                highlighted && "bg-primary/20 text-primary font-medium",
                todayDay && !highlighted && "ring-1 ring-primary text-text",
                !highlighted && !todayDay && inMonth && "text-text-secondary",
              )}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
