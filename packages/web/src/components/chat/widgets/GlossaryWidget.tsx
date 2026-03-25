import { useState, useMemo, useRef, useCallback } from "react";
import { clsx } from "clsx";
import { ChevronRight, Search } from "lucide-react";

interface GlossaryTerm {
  term: string;
  definition: string;
  category?: string;
}

export function GlossaryWidget({ params }: { params?: Record<string, string> }) {
  const terms = useMemo<GlossaryTerm[]>(() => {
    if (!params?.terms) return [];
    try {
      const parsed = typeof params.terms === "string" ? JSON.parse(params.terms) : params.terms;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (t: unknown): t is GlossaryTerm =>
            typeof t === "object" &&
            t !== null &&
            typeof (t as GlossaryTerm).term === "string" &&
            typeof (t as GlossaryTerm).definition === "string",
        )
        .sort((a: GlossaryTerm, b: GlossaryTerm) =>
          a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
        );
    } catch {
      return [];
    }
  }, [params?.terms]);

  const searchable = useMemo(() => {
    if (params?.searchable === "true") return true;
    if (params?.searchable === "false") return false;
    return terms.length >= 8;
  }, [params?.searchable, terms.length]);

  const showAlphaJump = terms.length >= 15;

  const [openIndices, setOpenIndices] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const filteredTerms = useMemo(() => {
    if (!query.trim()) return terms;
    const q = query.toLowerCase();
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q),
    );
  }, [terms, query]);

  const availableLetters = useMemo(() => {
    if (!showAlphaJump) return [];
    const letters = new Set<string>();
    for (const t of terms) {
      const first = t.term.charAt(0).toUpperCase();
      if (/[A-Z]/.test(first)) letters.add(first);
    }
    return Array.from(letters).sort();
  }, [terms, showAlphaJump]);

  const toggle = useCallback((index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const scrollToLetter = useCallback(
    (letter: string) => {
      const idx = terms.findIndex(
        (t) => t.term.charAt(0).toUpperCase() === letter,
      );
      if (idx === -1) return;
      const el = listRef.current?.querySelector(`[data-term-index="${idx}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [terms],
  );

  if (terms.length === 0) {
    return (
      <p className="p-4 text-sm text-text-tertiary">
        No glossary data provided
      </p>
    );
  }

  const termIndexMap = new Map<GlossaryTerm, number>();
  for (let i = 0; i < terms.length; i++) {
    termIndexMap.set(terms[i], i);
  }

  return (
    <div className="px-4 py-3">
      {showAlphaJump && (
        <div className="flex flex-wrap gap-1 mb-2">
          {availableLetters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => scrollToLetter(letter)}
              className="text-[10px] text-text-tertiary hover:text-text transition-colors px-1"
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      {searchable && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms..."
            className="bg-surface-tertiary border border-border rounded-lg px-3 py-1.5 pl-7 text-xs text-text placeholder:text-text-tertiary w-full"
          />
        </div>
      )}

      <div
        ref={listRef}
        className="bg-surface-secondary border border-border rounded-lg overflow-hidden"
      >
        {filteredTerms.map((item) => {
          const globalIndex = termIndexMap.get(item) ?? 0;
          const isOpen = openIndices.has(globalIndex);

          return (
            <div
              key={globalIndex}
              data-term-index={globalIndex}
              className="border-b border-border/50 last:border-0"
            >
              <button
                type="button"
                onClick={() => toggle(globalIndex)}
                className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer hover:bg-surface-tertiary/50 transition-colors w-full text-left"
              >
                <ChevronRight
                  className={clsx(
                    "size-3 text-text-tertiary shrink-0 transition-transform duration-150",
                    isOpen && "rotate-90",
                  )}
                />
                <span className="text-xs font-medium text-text">
                  {item.term}
                </span>
                {item.category && (
                  <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                    {item.category}
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="text-xs text-text-secondary pl-6 pb-2 pr-2">
                  {item.definition}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-text-tertiary mt-1.5">
        {query.trim() && filteredTerms.length !== terms.length
          ? `${filteredTerms.length} of ${terms.length} terms`
          : `${terms.length} terms`}
      </p>
    </div>
  );
}
