"use client";

import React, { useState, useEffect } from "react";

interface Question {
  id: number;
  statement: string;
  correctAnswer: "A" | "B" | "C" | "D" | "E";
  explanation: string;
  trapType: string;
}

interface DrillData {
  title: string;
  paragraphs: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  questions: Question[];
}

export default function CelpipTrainer() {
  const [drill, setDrill] = useState<DrillData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10:00 official Part 3 timer

  useEffect(() => {
    const saved = localStorage.getItem("celpip_topics");
    if (saved) setPreviousTopics(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!drill || submitted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [drill, submitted, timeLeft]);

  const generateDrill = async () => {
    setLoading(true);
    setError("");
    setSubmitted(false);
    setAnswers({});

    try {
      const res = await fetch("/api/generate-drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, previousTopics }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate drill");

      setDrill(data);
      setTimeLeft(600);

      const updatedTopics = [...previousTopics, data.title].slice(-15);
      setPreviousTopics(updatedTopics);
      localStorage.setItem("celpip_topics", JSON.stringify(updatedTopics));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const answeredCount = Object.values(answers).filter(Boolean).length;

  const calculateScore = () => {
    if (!drill || !submitted) return 0;
    return drill.questions.reduce(
      (acc, q) => (answers[q.id] === q.correctAnswer ? acc + 1 : acc),
      0
    );
  };

  const estimateCLB = (score: number) => {
    if (score === 9) return "CLB 11–12";
    if (score === 8) return "CLB 10";
    if (score === 7) return "CLB 9";
    if (score === 6) return "CLB 8";
    return "CLB 7 or below";
  };

  const handleManualSubmit = () => {
    if (answeredCount < 9) {
      const confirmEarly = window.confirm(
        `You have only answered ${answeredCount} of 9 questions. Submit anyway?`
      );
      if (!confirmEarly) return;
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Top Exam Control Bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-md sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            CELPIP Reading Part 3 Simulator
          </h1>
          <p className="text-xs text-slate-400">
            CLB 10–12 Strict Exam Mode
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Optional topic (e.g., Arctic Shipping)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={generateDrill}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 px-4 py-1.5 rounded text-sm font-semibold transition cursor-pointer"
          >
            {loading ? "Generating Drill..." : drill ? "New Drill" : "Start Drill"}
          </button>

          {drill && (
            <div
              className={`px-3 py-1.5 rounded font-mono text-sm font-bold ${
                timeLeft < 120 && !submitted
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-slate-800 text-emerald-400"
              }`}
            >
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-lg mb-6 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!drill && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center max-w-2xl mx-auto mt-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-3">
              Ready for CLB 10–12 Reading Part 3?
            </h2>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Complete all 9 matching statements under the 10:00 exam timer.
              Answers, CLB score estimation, and trap explanations stay hidden
              until you submit.
            </p>
            <button
              onClick={generateDrill}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-sm transition cursor-pointer"
            >
              Generate First Reading Passage
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-24">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 font-medium">
              Constructing 500+ word passage and engineering distractors...
            </p>
          </div>
        )}

        {drill && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Pane: Reading Passage */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-24 max-h-[82vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-4 pb-3 border-b border-slate-200">
                {drill.title}
              </h2>
              <div className="space-y-5 text-slate-800 leading-relaxed text-[15px]">
                {(["A", "B", "C", "D"] as const).map((letter) => (
                  <div key={letter} className="flex gap-3">
                    <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2.5 py-0.5 h-fit text-sm">
                      {letter}
                    </span>
                    <p>{drill.paragraphs[letter]}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane: Questions (Strict Mode until Submit) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">
                  Match Statements (A–D, or E if Not Given)
                </h3>
                {!submitted ? (
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                    Completed: {answeredCount} / 9
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full text-sm font-bold">
                    Score: {calculateScore()} / 9 ({estimateCLB(calculateScore())})
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {drill.questions.map((q) => {
                  const userAnswer = answers[q.id] || "";
                  const isCorrect = submitted && userAnswer === q.correctAnswer;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-lg border transition ${
                        submitted
                          ? isCorrect
                            ? "bg-emerald-50/70 border-emerald-300"
                            : "bg-red-50/70 border-red-300"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-medium text-slate-800 leading-snug">
                          <span className="font-bold text-slate-500 mr-1.5">
                            {q.id}.
                          </span>
                          {q.statement}
                        </p>

                        <select
                          disabled={submitted}
                          value={userAnswer}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.id]: e.target.value })
                          }
                          className="border border-slate-300 rounded px-2.5 py-1.5 text-sm font-semibold bg-white focus:outline-none focus:border-blue-500 shrink-0"
                        >
                          <option value="">Select</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E (Not Given)</option>
                        </select>
                      </div>

                      {/* Answers and explanations ONLY render after submitted === true */}
                      {submitted && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-bold ${
                                isCorrect ? "text-emerald-700" : "text-red-700"
                              }`}
                            >
                              {isCorrect
                                ? `✓ Correct (${q.correctAnswer})`
                                : `✗ Your Answer: ${
                                    userAnswer || "Blank"
                                  } | Correct: ${q.correctAnswer}`}
                            </span>
                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                              Trap: {q.trapType}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!submitted && (
                <button
                  onClick={handleManualSubmit}
                  className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold shadow-sm transition cursor-pointer"
                >
                  Submit & Grade Exam ({answeredCount}/9 Answered)
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
