import { useState, useCallback, useRef, useId, type ReactNode } from "react";
import { clsx } from "clsx";

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: (activeTab: string) => ReactNode;
}

export function Tabs({ tabs, defaultTab, activeTab: controlledTab, onTabChange, children }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const tablistRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const active = controlledTab ?? internalTab;

  const setActive = useCallback(
    (tabId: string) => {
      if (!controlledTab) setInternalTab(tabId);
      onTabChange?.(tabId);
    },
    [controlledTab, onTabChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === active);
      let newIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      } else if (e.key === "Home") {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        newIndex = tabs.length - 1;
      } else {
        return;
      }

      setActive(tabs[newIndex].id);
      const tabEl = tablistRef.current?.querySelector<HTMLElement>(`[data-tab-index="${newIndex}"]`);
      tabEl?.focus();
    },
    [active, tabs, setActive],
  );

  return (
    <div>
      <div
        ref={tablistRef}
        role="tablist"
        className="flex gap-1 border-b border-border mb-4"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => {
          const isActive = active === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              data-tab-index={index}
              onClick={() => setActive(tab.id)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-text-secondary hover:text-text",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
      >
        {children(active)}
      </div>
    </div>
  );
}
