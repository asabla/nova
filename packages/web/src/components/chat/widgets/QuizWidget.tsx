import { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  HelpCircle,
  CheckCircle,
  XCircle,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
}

type Phase = "idle" | "taking" | "results";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const DEFAULT_QUESTIONS: Question[] = [
  {
    question: "What is the largest planet in our solar system?",
    options: ["Earth", "Mars", "Jupiter", "Saturn"],
    correctIndex: 2,
  },
  {
    question: "Which element has the chemical symbol 'O'?",
    options: ["Gold", "Oxygen", "Osmium", "Oganesson"],
    correctIndex: 1,
  },
  {
    question: "In what year did the first Moon landing occur?",
    options: ["1965", "1967", "1969", "1971"],
    correctIndex: 2,
  },
];

function generateQuizHtml(title: string, questions: Question[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117; color: #e4e4e7;
      min-height: 100vh; display: flex; justify-content: center; padding: 2rem;
    }
    .container { max-width: 640px; width: 100%; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
    .question { background: #1a1b23; border: 1px solid #2a2b35; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
    .question-text { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.75rem; }
    .option {
      display: block; width: 100%; text-align: left; padding: 0.625rem 0.875rem;
      background: transparent; border: 1px solid #2a2b35; border-radius: 8px;
      color: #e4e4e7; cursor: pointer; margin-bottom: 0.375rem; font-size: 0.875rem;
      transition: all 0.15s;
    }
    .option:hover { border-color: #6366f1; }
    .option.selected { border-color: #6366f1; background: rgba(99, 102, 241, 0.1); }
    .option.correct { border-color: #22c55e; background: rgba(34, 197, 94, 0.1); }
    .option.wrong { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    .option:disabled { cursor: default; }
    .btn {
      padding: 0.5rem 1.25rem; border-radius: 8px; border: none; cursor: pointer;
      font-size: 0.875rem; font-weight: 500; transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-secondary { background: #2a2b35; color: #e4e4e7; }
    .score { font-size: 2rem; font-weight: 700; text-align: center; margin: 1.5rem 0; }
    .nav { display: flex; justify-content: space-between; margin-top: 1rem; }
    .progress { height: 3px; background: #2a2b35; border-radius: 2px; margin-bottom: 1.5rem; }
    .progress-fill { height: 100%; background: #6366f1; border-radius: 2px; transition: width 0.3s; }
    .hidden { display: none; }
    .result-icon { display: inline-block; width: 16px; height: 16px; margin-right: 4px; vertical-align: middle; }
    .subtitle { font-size: 0.875rem; color: #a1a1aa; margin-bottom: 1.5rem; }
    .result-answer { font-size: 0.8125rem; margin-top: 0.25rem; }
    .result-correct { color: #22c55e; }
    .result-wrong { color: #ef4444; }
    .result-expected { color: #a1a1aa; font-size: 0.75rem; }
    .actions { display: flex; gap: 0.5rem; justify-content: center; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container" id="app"></div>
  <script>
    const questions = ${JSON.stringify(questions)};
    const title = ${JSON.stringify(title)};
    let phase = "idle";
    let currentIndex = 0;
    let answers = questions.map(() => null);
    const app = document.getElementById("app");

    function render() {
      if (phase === "idle") renderIdle();
      else if (phase === "taking") renderTaking();
      else renderResults();
    }

    function renderIdle() {
      app.innerHTML = \`
        <div class="question" style="text-align:center; padding:2rem;">
          <h1>\${esc(title)}</h1>
          <p class="subtitle">\${questions.length} question\${questions.length === 1 ? "" : "s"}</p>
          <button class="btn btn-primary" id="start">Start Quiz</button>
        </div>\`;
      document.getElementById("start").onclick = () => { phase = "taking"; currentIndex = 0; render(); };
    }

    function renderTaking() {
      const q = questions[currentIndex];
      const isLast = currentIndex === questions.length - 1;
      const answered = answers[currentIndex] !== null;
      app.innerHTML = \`
        <p style="font-size:0.75rem;color:#a1a1aa;margin-bottom:0.5rem;">Question \${currentIndex + 1} of \${questions.length}</p>
        <div class="progress"><div class="progress-fill" style="width:\${((currentIndex + 1) / questions.length) * 100}%"></div></div>
        <div class="question">
          <div class="question-text">\${esc(q.question)}</div>
          \${q.options.map((o, i) => \`<button class="option\${answers[currentIndex] === i ? " selected" : ""}" data-idx="\${i}">\${esc(o)}</button>\`).join("")}
        </div>
        <div class="nav">
          <button class="btn btn-secondary" id="prev" \${currentIndex === 0 ? "disabled style=\\"opacity:0.4;cursor:default\\"" : ""}>Previous</button>
          \${isLast
            ? \`<button class="btn btn-primary" id="submit" \${!answered ? "disabled style=\\"opacity:0.4;cursor:default\\"" : ""}>Submit</button>\`
            : \`<button class="btn btn-primary" id="next">Next</button>\`}
        </div>\`;
      app.querySelectorAll(".option").forEach(btn => {
        btn.onclick = () => { answers[currentIndex] = parseInt(btn.dataset.idx); render(); };
      });
      const prev = document.getElementById("prev");
      if (currentIndex > 0) prev.onclick = () => { currentIndex--; render(); };
      if (isLast) {
        const sub = document.getElementById("submit");
        if (answered) sub.onclick = () => { phase = "results"; render(); };
      } else {
        document.getElementById("next").onclick = () => { currentIndex++; render(); };
      }
    }

    function renderResults() {
      const score = questions.reduce((s, q, i) => s + (answers[i] === q.correctIndex ? 1 : 0), 0);
      const pct = Math.round((score / questions.length) * 100);
      app.innerHTML = \`
        <h1>\${esc(title)} — Results</h1>
        <div class="score">\${score} / \${questions.length} <span style="font-size:1rem;color:#a1a1aa">(\${pct}%)</span></div>
        \${questions.map((q, i) => {
          const correct = answers[i] === q.correctIndex;
          const icon = correct
            ? '<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            : '<svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
          return \`<div class="question">
            <div class="question-text">\${icon}\${esc(q.question)}</div>
            <div class="result-answer \${correct ? "result-correct" : "result-wrong"}">\${correct ? "Correct" : "Wrong"}: \${esc(q.options[answers[i]])}</div>
            \${!correct ? \`<div class="result-expected">Correct answer: \${esc(q.options[q.correctIndex])}</div>\` : ""}
          </div>\`;
        }).join("")}
        <div class="actions">
          <button class="btn btn-secondary" id="retake">Retake</button>
        </div>\`;
      document.getElementById("retake").onclick = () => { phase = "idle"; answers = questions.map(() => null); currentIndex = 0; render(); };
    }

    function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
    render();
  </script>
</body>
</html>`;
}

export function QuizWidget({ params }: { params?: Record<string, string> }) {
  const questions = useMemo<Question[]>(() => {
    if (!params?.questions) return DEFAULT_QUESTIONS;
    if (typeof params.questions !== "string") return params.questions as unknown as Question[];
    try {
      return JSON.parse(params.questions);
    } catch {
      return DEFAULT_QUESTIONS;
    }
  }, [params?.questions]);

  const title = params?.title ?? "Quiz";

  const [phase, setPhase] = useState<Phase>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );

  const score = useMemo(
    () =>
      questions.reduce(
        (s, q, i) => s + (answers[i] === q.correctIndex ? 1 : 0),
        0,
      ),
    [questions, answers],
  );

  const handleSelectOption = (optionIndex: number) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === currentIndex ? optionIndex : a)),
    );
  };

  const handleSubmit = () => {
    setPhase("results");
  };

  const handleRetake = () => {
    setPhase("idle");
    setCurrentIndex(0);
    setAnswers(questions.map(() => null));
  };

  const handleDownload = () => {
    const html = generateQuizHtml(title, questions);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}-quiz.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Idle Phase ----------
  if (phase === "idle") {
    return (
      <div className="px-4 py-3">
        <div className="rounded-xl border border-border bg-surface-secondary p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm font-medium text-text">{title}</div>
          <div className="mt-1 text-xs text-text-tertiary">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </div>
          <button
            onClick={() => setPhase("taking")}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Start Quiz
          </button>
          <button
            onClick={handleDownload}
            className="mt-2 flex items-center gap-1.5 mx-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text"
          >
            <Download className="h-3.5 w-3.5" />
            Save as HTML
          </button>
        </div>
      </div>
    );
  }

  // ---------- Taking Phase ----------
  if (phase === "taking") {
    const q = questions[currentIndex];
    const isLast = currentIndex === questions.length - 1;
    const isFirst = currentIndex === 0;
    const answered = answers[currentIndex] !== null;

    return (
      <div className="px-4 py-3">
        <div className="rounded-xl border border-border bg-surface-secondary p-4">
          {/* Progress */}
          <div className="mb-1 text-[11px] text-text-tertiary">
            Question {currentIndex + 1} of {questions.length}
          </div>
          <div className="mb-4 h-[3px] rounded-full bg-surface-tertiary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question */}
          <div className="mb-3 text-sm font-medium text-text">
            {q.question}
          </div>

          {/* Options */}
          <div className="space-y-1.5">
            {q.options.map((option, i) => (
              <button
                key={i}
                onClick={() => handleSelectOption(i)}
                className={clsx(
                  "w-full rounded-lg border px-3 py-2 text-left text-xs transition-all",
                  answers[currentIndex] === i
                    ? "border-primary bg-primary/10 text-text"
                    : "border-border text-text hover:border-primary/50",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((i) => i - 1)}
              disabled={isFirst}
              className={clsx(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity",
                isFirst
                  ? "cursor-default text-text-tertiary opacity-40"
                  : "text-text-secondary hover:text-text",
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={!answered}
                className={clsx(
                  "rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white transition-opacity",
                  !answered && "cursor-default opacity-40",
                )}
              >
                Submit
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-opacity hover:text-text"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Results Phase ----------
  const pct = Math.round((score / questions.length) * 100);

  return (
    <div className="px-4 py-3">
      <div className="rounded-xl border border-border bg-surface-secondary p-4">
        {/* Score summary */}
        <div className="mb-4 text-center">
          <div className="text-lg font-bold text-text">
            {score}{" "}
            <span className="text-sm font-normal text-text-tertiary">
              / {questions.length}
            </span>
          </div>
          <div className="text-xs text-text-secondary">
            You scored {pct}%
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-2">
          {questions.map((q, i) => {
            const correct = answers[i] === q.correctIndex;
            return (
              <div
                key={i}
                className="rounded-lg border border-border bg-surface-tertiary/50 px-3 py-2"
              >
                <div className="flex items-start gap-1.5 text-xs font-medium text-text">
                  {correct ? (
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  )}
                  <span>{q.question}</span>
                </div>
                <div
                  className={clsx(
                    "ml-5 mt-0.5 text-[11px]",
                    correct ? "text-success" : "text-danger",
                  )}
                >
                  {answers[i] !== null ? q.options[answers[i]!] : "No answer"}
                </div>
                {!correct && (
                  <div className="ml-5 text-[11px] text-text-tertiary">
                    Correct: {q.options[q.correctIndex]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={handleRetake}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retake
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            Save as HTML
          </button>
        </div>
      </div>
    </div>
  );
}
