import { useState, useMemo, useCallback } from "react";
import { clsx } from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  RotateCcw,
} from "lucide-react";

interface Card {
  front: string;
  back: string;
}

const DEFAULT_CARDS: Card[] = [
  { front: "Bonjour", back: "Hello" },
  { front: "Merci", back: "Thank you" },
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function FlashcardWidget({
  params,
}: {
  params?: Record<string, string>;
}) {
  const cards = useMemo<Card[]>(() => {
    if (!params?.cards) return DEFAULT_CARDS;
    try {
      const parsed = typeof params.cards === "string" ? JSON.parse(params.cards) : params.cards;
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CARDS;
      return parsed;
    } catch {
      return DEFAULT_CARDS;
    }
  }, [params?.cards]);

  const shouldShuffle = params?.shuffle === "true";

  const orderedCards = useMemo(() => {
    return shouldShuffle ? shuffleArray(cards) : cards;
  }, [cards, shouldShuffle]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState({ know: 0, dontKnow: 0 });

  const isComplete = scores.know + scores.dontKnow === orderedCards.length;

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setIsFlipped(false);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(orderedCards.length - 1, prev + 1));
    setIsFlipped(false);
  }, [orderedCards.length]);

  const handleScore = useCallback(
    (type: "know" | "dontKnow") => {
      setScores((prev) => ({ ...prev, [type]: prev[type] + 1 }));
      if (currentIndex < orderedCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        setIsFlipped(false);
      }
    },
    [currentIndex, orderedCards.length],
  );

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setScores({ know: 0, dontKnow: 0 });
  }, []);

  if (!orderedCards.length) {
    return (
      <p className="p-4 text-sm text-text-tertiary">
        No flashcard data provided
      </p>
    );
  }

  if (isComplete) {
    return (
      <div className="px-4 py-3">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-secondary p-6">
          <p className="text-sm text-text">
            Complete! ✓ {scores.know} / {orderedCards.length}
          </p>
          <button
            type="button"
            onClick={handleRestart}
            className="flex items-center gap-1.5 rounded-md p-1.5 text-xs text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text"
            aria-label="Restart flashcards"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </button>
        </div>
      </div>
    );
  }

  const card = orderedCards[currentIndex];

  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2">
        {/* Card */}
        <div
          style={{ perspective: "800px" }}
          onClick={handleFlip}
          className="cursor-pointer"
        >
          <div
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.5s",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
            className="relative h-40"
          >
            {/* Front face */}
            <div
              style={{ backfaceVisibility: "hidden" }}
              className="absolute inset-0 flex items-center justify-center rounded-xl border border-border bg-surface-tertiary"
            >
              <span className="text-sm font-medium text-text">
                {card.front}
              </span>
            </div>
            {/* Back face */}
            <div
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
              className="absolute inset-0 flex items-center justify-center rounded-xl border border-border bg-surface-tertiary"
            >
              <span className="text-sm text-text-secondary">{card.back}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className={clsx(
              "rounded-md p-1.5 text-text-tertiary transition-colors",
              "hover:bg-surface-tertiary hover:text-text",
              "disabled:opacity-30",
            )}
            aria-label="Previous card"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-text-tertiary">
            {currentIndex + 1} / {orderedCards.length}
          </span>
          <button
            type="button"
            onClick={goToNext}
            disabled={currentIndex === orderedCards.length - 1}
            className={clsx(
              "rounded-md p-1.5 text-text-tertiary transition-colors",
              "hover:bg-surface-tertiary hover:text-text",
              "disabled:opacity-30",
            )}
            aria-label="Next card"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Score buttons (visible when flipped) */}
        {isFlipped && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleScore("know")}
              className="flex items-center gap-1 rounded-md p-1.5 text-xs text-green-500 transition-colors hover:bg-green-500/10"
            >
              <Check className="h-3.5 w-3.5" />
              Know
            </button>
            <button
              type="button"
              onClick={() => handleScore("dontKnow")}
              className="flex items-center gap-1 rounded-md p-1.5 text-xs text-red-500 transition-colors hover:bg-red-500/10"
            >
              <X className="h-3.5 w-3.5" />
              Don't know
            </button>
          </div>
        )}

        {/* Score line */}
        <p className="text-center text-[10px] text-text-tertiary">
          ✓ {scores.know} · ✗ {scores.dontKnow}
        </p>
      </div>
    </div>
  );
}
