import { useState } from "react";
import { clsx } from "clsx";

export function PollWidget({ params }: { params?: Record<string, string> }) {
  const question = params?.question ?? "What do you think?";
  const options = (params?.options ?? "Yes,No,Maybe").split(",").map((s) => s.trim());
  const [votes, setVotes] = useState<number[]>(() => options.map(() => 0));
  const [voted, setVoted] = useState(false);

  const totalVotes = votes.reduce((a, b) => a + b, 0);

  const handleVote = (index: number) => {
    if (voted) return;
    setVotes((prev) => prev.map((v, i) => (i === index ? v + 1 : v)));
    setVoted(true);
  };

  return (
    <div className="px-4 py-3">
      <div className="text-sm font-medium text-text mb-2">{question}</div>
      <div className="space-y-1.5">
        {options.map((option, i) => {
          const pct = totalVotes > 0 ? Math.round((votes[i] / totalVotes) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={voted}
              className={clsx(
                "w-full text-left px-3 py-1.5 rounded-lg border text-xs transition-all relative overflow-hidden",
                voted
                  ? "border-border cursor-default"
                  : "border-primary/30 hover:border-primary cursor-pointer",
              )}
            >
              {voted && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between">
                <span className="text-text">{option}</span>
                {voted && (
                  <span className="text-text-tertiary">{pct}%</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {voted && (
        <div className="text-[10px] text-text-tertiary mt-1.5">{totalVotes} vote(s)</div>
      )}
    </div>
  );
}
