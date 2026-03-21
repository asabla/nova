import { useState, useRef, useCallback, useEffect } from "react";
import { clsx } from "clsx";
import { Plus, X, GripVertical, Maximize2, Minimize2, Download } from "lucide-react";
import { api } from "@/lib/api";

interface KanbanColumn {
  id: string;
  title: string;
}

interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  columnId: string;
}

interface KanbanWidgetProps {
  params?: Record<string, string>;
  endpoint?: string;
  artifactId?: string;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

const DEFAULT_CARDS: KanbanCard[] = [
  { id: "card-1", title: "Research competitors", description: "Analyze top 5 competitors", columnId: "todo" },
  { id: "card-2", title: "Draft wireframes", columnId: "todo" },
];

function parseJSON<T>(raw: string | undefined, fallback: T): { data: T; error?: string } {
  if (!raw) return { data: fallback };
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { data: fallback, error: `Invalid JSON: ${raw.slice(0, 80)}…` };
  }
}

export function KanbanWidget({ params, artifactId }: KanbanWidgetProps) {
  const colResult = parseJSON<KanbanColumn[]>(params?.columns, DEFAULT_COLUMNS);
  const cardResult = parseJSON<KanbanCard[]>(params?.cards, DEFAULT_CARDS);
  const parseError = colResult.error || cardResult.error;

  const [columns, setColumns] = useState<KanbanColumn[]>(colResult.data);
  const [cards, setCards] = useState<KanbanCard[]>(cardResult.data);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef({ columns, cards });
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Keep latest state ref in sync
  useEffect(() => {
    latestStateRef.current = { columns, cards };
  }, [columns, cards]);

  // Focus inputs when they appear
  useEffect(() => {
    if (addingInColumn) addInputRef.current?.focus();
  }, [addingInColumn]);

  useEffect(() => {
    if (editingCardId) editInputRef.current?.focus();
  }, [editingCardId]);

  const persist = useCallback(() => {
    if (!artifactId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { columns: cols, cards: crds } = latestStateRef.current;
      api
        .patch(`/api/artifacts/${artifactId}`, {
          metadata: {
            type: "kanban",
            title: params?.title ?? "Kanban",
            params: { columns: JSON.stringify(cols), cards: JSON.stringify(crds) },
          },
        })
        .catch(console.error);
    }, 500);
  }, [artifactId, params]);

  const updateCards = useCallback(
    (updater: (prev: KanbanCard[]) => KanbanCard[]) => {
      setCards((prev) => {
        const next = updater(prev);
        return next;
      });
      // Persist after state update is scheduled
      setTimeout(persist, 0);
    },
    [persist],
  );

  // --- Drag handlers ---

  function handleDragStart(e: React.DragEvent, cardId: string) {
    e.dataTransfer.setData("text/plain", cardId);
    e.dataTransfer.effectAllowed = "move";
    setDragCardId(cardId);
  }

  function handleDragEnd() {
    setDragCardId(null);
    setDragOverColumnId(null);
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumnId(columnId);
  }

  function handleDragLeave(e: React.DragEvent, columnId: string) {
    // Only clear if we're actually leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverColumnId === columnId) setDragOverColumnId(null);
    }
  }

  function handleDrop(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    if (cardId) {
      updateCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, columnId } : c)));
    }
    setDragCardId(null);
    setDragOverColumnId(null);
  }

  // --- Card operations ---

  function submitNewCard(columnId: string) {
    const title = newCardTitle.trim();
    if (!title) {
      setAddingInColumn(null);
      setNewCardTitle("");
      return;
    }
    const card: KanbanCard = { id: crypto.randomUUID(), title, columnId };
    updateCards((prev) => [...prev, card]);
    setAddingInColumn(null);
    setNewCardTitle("");
  }

  function startEditing(card: KanbanCard) {
    setEditingCardId(card.id);
    setEditTitle(card.title);
  }

  function submitEdit(cardId: string) {
    const title = editTitle.trim();
    if (title) {
      updateCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, title } : c)));
    }
    setEditingCardId(null);
    setEditTitle("");
  }

  function deleteCard(cardId: string) {
    updateCards((prev) => prev.filter((c) => c.id !== cardId));
  }

  function exportAsJSON() {
    const data = { columns, cards };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(params?.title ?? "kanban").toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (parseError) {
    return (
      <div className="px-4 py-3 text-xs text-red-500">
        Failed to parse kanban data: {parseError}
      </div>
    );
  }

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      <div
        className={clsx(
          "px-4 py-3",
          isFullscreen && "fixed inset-4 z-50 bg-surface rounded-xl shadow-2xl overflow-auto flex flex-col",
        )}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-end gap-1 mb-2">
          <button
            type="button"
            onClick={exportAsJSON}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors"
            title="Export as JSON"
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 flex-1">
          {columns.map((col) => {
          const columnCards = cards.filter((c) => c.columnId === col.id);
          const isDropTarget = dragOverColumnId === col.id;

          return (
            <div
              key={col.id}
              className={clsx(
                "flex-shrink-0 flex flex-col rounded-lg bg-surface-tertiary/50 min-w-[200px] max-w-[260px] w-[240px] transition-colors",
                isDropTarget && dragCardId ? "border-2 border-primary" : "border-2 border-transparent",
              )}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold text-text">{col.title}</span>
                <span className="text-[10px] text-text-tertiary">{columnCards.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-1.5 px-2 pb-2 min-h-[40px] flex-1">
                {columnCards.map((card) => (
                  <div
                    key={card.id}
                    draggable={editingCardId !== card.id}
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onDragEnd={handleDragEnd}
                    className={clsx(
                      "group relative bg-surface-secondary border border-border rounded-lg px-2.5 py-2 cursor-grab transition-all",
                      "hover:shadow-sm",
                      dragCardId === card.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="size-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {editingCardId === card.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitEdit(card.id);
                              if (e.key === "Escape") {
                                setEditingCardId(null);
                                setEditTitle("");
                              }
                            }}
                            onBlur={() => submitEdit(card.id)}
                            className="w-full text-xs bg-transparent border-none outline-none text-text p-0"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(card)}
                            className="text-xs text-text text-left w-full cursor-text"
                          >
                            {card.title}
                          </button>
                        )}
                        {card.description && editingCardId !== card.id && (
                          <p className="text-[10px] text-text-tertiary mt-0.5 line-clamp-2">
                            {card.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCard(card.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-red-500 flex-shrink-0 mt-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add card inline input */}
                {addingInColumn === col.id && (
                  <div className="bg-surface-secondary border border-border rounded-lg px-2.5 py-2">
                    <input
                      ref={addInputRef}
                      type="text"
                      placeholder="Card title…"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewCard(col.id);
                        if (e.key === "Escape") {
                          setAddingInColumn(null);
                          setNewCardTitle("");
                        }
                      }}
                      onBlur={() => submitNewCard(col.id)}
                      className="w-full text-xs bg-transparent border-none outline-none text-text placeholder:text-text-tertiary p-0"
                    />
                  </div>
                )}
              </div>

              {/* Add card button */}
              {addingInColumn !== col.id && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingInColumn(col.id);
                    setNewCardTitle("");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-text-tertiary hover:text-text-secondary hover:bg-primary/10 rounded-b-lg transition-colors cursor-pointer"
                >
                  <Plus className="size-3" />
                  Add card
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </>
  );
}
