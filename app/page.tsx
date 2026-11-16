"use client";

import React, { useState, useEffect } from "react";

interface MCQuestion {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  trapType: string;
}

interface BlankItem {
  id: number;
  options: string[];
  correctIndex: number;
  explanation: string;
  trapType: string;
}

interface PartDiagnostic {
  coreErrorPattern: string;
  skimOrReadingAudit: string;
  nextTimeRules: string[];
  missedItemsBreakdown: {
    questionId: number;
    whyYourChoiceBaitedYou: string;
    fixForNextTime: string;
  }[];
}

const PART_CONFIG: Record<
  1 | 2 | 3 | 4,
  { name: string; shortName: string; seconds: number; totalQ: number; desc: string }
> = {
  1: {
    name: "Part 1: Reading Correspondence",
    shortName: "Part 1 (11m)",
    seconds: 660,
    totalQ: 11,
    desc: "Semi-formal Canadian email + 6 comprehension questions + 5 reply dropdowns.",
  },
  2: {
    name: "Part 2: Reading to Apply a Diagram",
    shortName: "Part 2 (9m)",
    seconds: 540,
    totalQ: 8,
    desc: "Visual comparison schedule/brochure + 5 email dropdowns + 3 synthesis questions.",
  },
  3: {
    name: "Part 3: Reading for Information",
    shortName: "Part 3 (10m)",
    seconds: 600,
    totalQ: 9,
    desc: "4-Archetype encyclopedic passage + Skimming Scratchpad + 9 shuffled statements (A–E).",
  },
  4: {
    name: "Part 4: Reading for Viewpoints",
    shortName: "Part 4 (13m)",
    seconds: 780,
    totalQ: 10,
    desc: "Multi-stakeholder Canadian opinion article + 5 MC questions + 5 reader comment blanks.",
  },
};

export default function TabbedCelpipTrainer() {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(3);
  const [customTopic, setCustomTopic] = useState("");

  // Independent per-part state (1 API call only when user clicks Generate on that tab)
  const [partData, setPartData] = useState<Record<number, any>>({});
  const [loadingPart, setLoadingPart] = useState<Record<number, boolean>>({});
  const [errorPart, setErrorPart] = useState<Record<number, string>>({});
  const [timers, setTimers] = useState<Record<number, number>>({
    1: 660,
    2: 540,
    3: 600,
    4: 780,
  });
  const [submittedPart, setSubmittedPart] = useState<Record<number, boolean>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, Record<number, any>>>({
    1: {},
    2: {},
    3: {},
    4: {},
  });

  // Part 3 Skimming Scratchpad
  const [part3SkimLocked, setPart3SkimLocked] = useState(false);
  const [skimNotes, setSkimNotes] = useState({ A: "", B: "", C: "", D: "" });
  const [skimSeconds, setSkimSeconds] = useState(0);

  // Per-part AI Root-Cause Coach
  const [diagnostics, setDiagnostics] = useState<Record<number, PartDiagnostic | null>>({});
  const [diagnosingPart, setDiagnosingPart] = useState<Record<number, boolean>>({});

  // Active tab countdown timer (runs only for the currently active, generated, unsubmitted tab)
  useEffect(() => {
    const data = partData[activeTab];
    const isSub = submittedPart[activeTab];
    const timeLeft = timers[activeTab];

    if (!data || isSub || timeLeft <= 0) return;

    const interval = setInterval(() => {
      if (activeTab === 3 && !part3SkimLocked) {
        setSkimSeconds((s) => s + 1);
      }
      setTimers((prev) => {
        const nextVal = prev[activeTab] - 1;
        if (nextVal <= 0) {
          clearInterval(interval);
          submitCurrentPart(activeTab, true);
          return { ...prev, [activeTab]: 0 };
        }
        return { ...prev, [activeTab]: nextVal };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTab, partData, submittedPart, timers, part3SkimLocked]);

  const generatePart = async (partNum: 1 | 2 | 3 | 4) => {
    setLoadingPart((prev) => ({ ...prev, [partNum]: true }));
    setErrorPart((prev) => ({ ...prev, [partNum]: "" }));
    setSubmittedPart((prev) => ({ ...prev, [partNum]: false }));
    setUserAnswers((prev) => ({ ...prev, [partNum]: {} }));
    setDiagnostics((prev) => ({ ...prev, [partNum]: null }));
    setTimers((prev) => ({ ...prev, [partNum]: PART_CONFIG[partNum].seconds }));

    if (partNum === 3) {
      setPart3SkimLocked(false);
      setSkimNotes({ A: "", B: "", C: "", D: "" });
      setSkimSeconds(0);
    }

    try {
      const savedTopics = JSON.parse(localStorage.getItem("celpip_topics") || "[]");
      const res = await fetch("/api/generate-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part: partNum,
          topic: customTopic,
          previousTopics: savedTopics,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to generate Part ${partNum}`);

      setPartData((prev) => ({ ...prev, [partNum]: json }));

      if (partNum === 3 && json.title) {
        localStorage.setItem(
          "celpip_topics",
          JSON.stringify([...savedTopics, json.title].slice(-15))
        );
      }
    } catch (err: any) {
      setErrorPart((prev) => ({ ...prev, [partNum]: err.message }));
    } finally {
      setLoadingPart((prev) => ({ ...prev, [partNum]: false }));
    }
  };

  const calculatePartScore = (partNum: 1 | 2 | 3 | 4) => {
    const data = partData[partNum];
    const ans = userAnswers[partNum] || {};
    if (!data) return 0;

    let score = 0;
    if (partNum === 1) {
      data.comprehensionQuestions.forEach((q: MCQuestion) => {
        if (ans[q.id] === q.correctIndex) score++;
      });
      data.replyBlanks.forEach((b: BlankItem) => {
        if (ans[b.id] === b.correctIndex) score++;
      });
    } else if (partNum === 2) {
      data.emailBlanks.forEach((b: BlankItem) => {
        if (ans[b.id] === b.correctIndex) score++;
      });
      data.comprehensionQuestions.forEach((q: MCQuestion) => {
        if (ans[q.id] === q.correctIndex) score++;
      });
    } else if (partNum === 3) {
      data.questions.forEach((q: any) => {
        if (ans[q.id] === q.correctAnswer) score++;
      });
    } else if (partNum === 4) {
      data.comprehensionQuestions.forEach((q: MCQuestion) => {
        if (ans[q.id] === q.correctIndex) score++;
      });
      data.commentBlanks.forEach((b: BlankItem) => {
        if (ans[b.id] === b.correctIndex) score++;
      });
    }
    return score;
  };

  const estimatePartCLB = (score: number, total: number) => {
    const pct = score / total;
    if (pct >= 0.9) return "CLB 11–12";
    if (pct >= 0.8) return "CLB 10";
    if (pct >= 0.7) return "CLB 9";
    if (pct >= 0.6) return "CLB 8";
    return "CLB 7 or below";
  };

  const submitCurrentPart = async (partNum: 1 | 2 | 3 | 4, auto = false) => {
    const totalQ = PART_CONFIG[partNum].totalQ;
    const answered = Object.values(userAnswers[partNum] || {}).filter(
      (v) => v !== undefined && v !== ""
    ).length;

    if (!auto && answered < totalQ) {
      const ok = window.confirm(
        `You answered ${answered} of ${totalQ} questions in Part ${partNum}. Submit and grade now?`
      );
      if (!ok) return;
    }

    setSubmittedPart((prev) => ({ ...prev, [partNum]: true }));
    if (partNum === 3) setPart3SkimLocked(true);

    const score = calculatePartScore(partNum);
    setDiagnosingPart((prev) => ({ ...prev, [partNum]: true }));

    try {
      const res = await fetch("/api/diagnose-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partNumber: partNum,
          partData: partData[partNum],
          userAnswers: userAnswers[partNum],
          skimNotes: partNum === 3 ? skimNotes : undefined,
          score,
          total: totalQ,
        }),
      });
      if (res.ok) {
        const diag = await res.json();
        setDiagnostics((prev) => ({ ...prev, [partNum]: diag }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosingPart((prev) => ({ ...prev, [partNum]: false }));
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const renderTemplatedText = (
    template: string,
    blanks: BlankItem[],
    partNum: 1 | 2 | 4
  ) => {
    const isSub = submittedPart[partNum];
    const tokens = template.split(/(\{\{\d+\}\})/g);
    return (
      <div className="leading-8 text-[15px] text-slate-800 whitespace-pre-line">
        {tokens.map((token, idx) => {
          const match = token.match(/^\{\{(\d+)\}\}$/);
          if (!match) return <span key={idx}>{token}</span>;

          const blankId = parseInt(match[1], 10);
          const blankObj = blanks.find((b) => b.id === blankId);
          if (!blankObj) return <span key={idx}>{token}</span>;

          const selectedVal = userAnswers[partNum]?.[blankId];
          const isCorrect = isSub && selectedVal === blankObj.correctIndex;

          return (
            <span key={idx} className="inline-block mx-1 align-middle">
              <select
                disabled={isSub}
                value={selectedVal ?? ""}
                onChange={(e) =>
                  setUserAnswers((prev) => ({
                    ...prev,
                    [partNum]: {
                      ...prev[partNum],
                      [blankId]:
                        e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                    },
                  }))
                }
                className={`px-2 py-1 rounded border text-xs font-semibold ${
                  isSub
                    ? isCorrect
                      ? "bg-emerald-100 border-emerald-500 text-emerald-900"
                      : "bg-red-100 border-red-500 text-red-900"
                    : "bg-blue-50/70 border-blue-300 text-slate-900"
                }`}
              >
                <option value="">[{blankId}] Select...</option>
                {blankObj.options.map((opt, i) => (
                  <option key={i} value={i}>
                    {opt}
                  </option>
                ))}
              </select>
            </span>
          );
        })}
      </div>
    );
  };

  const renderMCList = (questions: MCQuestion[], partNum: 1 | 2 | 4) => {
    const isSub = submittedPart[partNum];
    return (
      <div className="space-y-4">
        {questions.map((q) => {
          const chosen = userAnswers[partNum]?.[q.id];
          const isCorrect = isSub && chosen === q.correctIndex;
          return (
            <div
              key={q.id}
              className={`p-4 rounded-lg border ${
                isSub
                  ? isCorrect
                    ? "bg-emerald-50/70 border-emerald-300"
                    : "bg-red-50/70 border-red-300"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <p className="text-sm font-semibold text-slate-800 mb-2.5">
                <span className="text-slate-500 mr-1.5">{q.id}.</span>
                {q.prompt}
              </p>
              <div className="space-y-1.5">
                {q.options.map((opt, idx) => {
                  const isSelected = chosen === idx;
                  const isRight = isSub && idx === q.correctIndex;
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-2.5 p-2 rounded border text-xs cursor-pointer ${
                        isSub
                          ? isRight
                            ? "bg-emerald-100 border-emerald-400 font-bold text-emerald-950"
                            : isSelected
                            ? "bg-red-100 border-red-400 text-red-950"
                            : "bg-white border-slate-200 text-slate-600"
                          : isSelected
                          ? "bg-blue-50 border-blue-400 font-medium text-blue-950"
                          : "bg-white border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        disabled={isSub}
                        name={`p${partNum}-q-${q.id}`}
                        checked={isSelected}
                        onChange={() =>
                          setUserAnswers((prev) => ({
                            ...prev,
                            [partNum]: { ...prev[partNum], [q.id]: idx },
                          }))
                        }
                        className="mt-0.5"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
              {isSub && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs text-slate-700 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className={isCorrect ? "text-emerald-700" : "text-red-700"}>
                      {isCorrect
                        ? "✓ Correct"
                        : `✗ Correct Option: ${q.options[q.correctIndex]}`}
                    </span>
                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                      {q.trapType}
                    </span>
                  </div>
                  <p>{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderBlankExplanations = (blanks: BlankItem[], partNum: 1 | 2 | 4) => {
    if (!submittedPart[partNum]) return null;
    return (
      <div className="mt-4 pt-4 border-t border-slate-200 space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Dropdown Blanks Breakdown
        </h4>
        {blanks.map((b) => {
          const chosen = userAnswers[partNum]?.[b.id];
          const isCorrect = chosen === b.correctIndex;
          return (
            <div
              key={b.id}
              className={`p-3 rounded border text-xs ${
                isCorrect
                  ? "bg-emerald-50/70 border-emerald-200"
                  : "bg-red-50/70 border-red-200"
              }`}
            >
              <div className="flex justify-between font-bold mb-1">
                <span className={isCorrect ? "text-emerald-800" : "text-red-800"}>
                  Blank [{b.id}]:{" "}
                  {isCorrect
                    ? "✓ Correct"
                    : `✗ Selected: ${
                        chosen !== undefined ? b.options[chosen] : "Blank"
                      } | Correct: ${b.options[b.correctIndex]}`}
                </span>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {b.trapType}
                </span>
              </div>
              <p className="text-slate-700">{b.explanation}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const currentData = partData[activeTab];
  const isCurrentLoading = loadingPart[activeTab];
  const isCurrentSubmitted = submittedPart[activeTab];
  const currentDiagnostic = diagnostics[activeTab];
  const isCurrentDiagnosing = diagnosingPart[activeTab];
  const currentAnsweredCount = Object.values(userAnswers[activeTab] || {}).filter(
    (v) => v !== undefined && v !== ""
  ).length;
  const currentScore = isCurrentSubmitted ? calculatePartScore(activeTab) : 0;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Top Header & Section Tabs */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 pt-3.5 pb-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-white font-bold text-xs px-2.5 py-1 rounded">
              CELPIP-G
            </span>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                CELPIP Reading Targeted Part Trainer
              </h1>
              <p className="text-[11px] text-slate-400">
                1 API Call Per Tab • Part-Specific Countdown • CLB 10–12 Coach
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Optional topic (e.g., EV Batteries)"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={() => generatePart(activeTab)}
              disabled={isCurrentLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 px-4 py-1.5 rounded text-xs font-semibold transition cursor-pointer"
            >
              {isCurrentLoading
                ? `Generating Part ${activeTab}...`
                : currentData
                ? `New Part ${activeTab} Drill`
                : `Generate Part ${activeTab}`}
            </button>

            {currentData && (
              <div
                className={`px-3 py-1.5 rounded font-mono text-sm font-bold ${
                  timers[activeTab] < 90 && !isCurrentSubmitted
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-slate-800 text-emerald-400"
                }`}
              >
                ⏱ {formatTime(timers[activeTab])}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs for Parts 1–4 */}
        <div className="max-w-7xl mx-auto px-6 flex gap-2 overflow-x-auto pt-2">
          {([1, 2, 3, 4] as const).map((tabNum) => {
            const isActive = activeTab === tabNum;
            const hasData = Boolean(partData[tabNum]);
            const isSub = Boolean(submittedPart[tabNum]);
            return (
              <button
                key={tabNum}
                onClick={() => setActiveTab(tabNum)}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg border-t border-x transition flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "bg-slate-100 text-slate-900 border-slate-300"
                    : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800"
                }`}
              >
                <span>{PART_CONFIG[tabNum].shortName}</span>
                {isSub ? (
                  <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px]">
                    {calculatePartScore(tabNum)}/{PART_CONFIG[tabNum].totalQ}
                  </span>
                ) : hasData ? (
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto p-6">
        {errorPart[activeTab] && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-lg mb-6 text-xs">
            <strong>Error:</strong> {errorPart[activeTab]}
          </div>
        )}

        {/* Empty State for Selected Tab (Zero API calls until clicked!) */}
        {!currentData && !isCurrentLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center max-w-2xl mx-auto mt-10">
            <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full mb-3">
              Official Target Time: {formatTime(PART_CONFIG[activeTab].seconds)} •{" "}
              {PART_CONFIG[activeTab].totalQ} Questions
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {PART_CONFIG[activeTab].name}
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {PART_CONFIG[activeTab].desc}
              <br />
              Nothing is generated in the background—click below to generate{" "}
              <strong>only Part {activeTab}</strong> (1 API request).
            </p>
            <button
              onClick={() => generatePart(activeTab)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
            >
              Start {PART_CONFIG[activeTab].name}
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {isCurrentLoading && (
          <div className="text-center py-28">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium text-slate-600">
              Generating {PART_CONFIG[activeTab].name} at CLB 10–12 calibration...
            </p>
          </div>
        )}

        {/* Post-Submission Root-Cause Coach Banner */}
        {currentData && !isCurrentLoading && isCurrentSubmitted && (
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-700 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-700">
              <h3 className="text-base font-bold text-amber-400">
                🔍 {PART_CONFIG[activeTab].name} — Root-Cause Coach
              </h3>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3.5 py-1 rounded-full text-xs font-bold">
                Score: {currentScore} / {PART_CONFIG[activeTab].totalQ} (
                {estimatePartCLB(currentScore, PART_CONFIG[activeTab].totalQ)})
              </span>
            </div>

            {isCurrentDiagnosing && (
              <p className="text-xs text-amber-300 animate-pulse py-4">
                Auditing your answers and generating next-time rules...
              </p>
            )}

            {currentDiagnostic && !isCurrentDiagnosing && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed mt-4">
                <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700">
                  <p className="font-bold text-rose-300 mb-1">
                    1. Where Things Went Wrong:
                  </p>
                  <p className="text-slate-200">{currentDiagnostic.coreErrorPattern}</p>
                </div>

                <div className="bg-slate-800/90 p-3.5 rounded-lg border border-slate-700">
                  <p className="font-bold text-blue-300 mb-1">
                    2. {activeTab === 3 ? "Skim Map Audit:" : "Reading & Tone Audit:"}
                  </p>
                  <p className="text-slate-200">
                    {currentDiagnostic.skimOrReadingAudit}
                  </p>
                </div>

                <div className="bg-emerald-950/60 p-3.5 rounded-lg border border-emerald-800/70">
                  <p className="font-bold text-emerald-300 mb-1">
                    3. What to Take Care of Next Time:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-200">
                    {currentDiagnostic.nextTimeRules.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PART 1 WORKSPACE */}
        {activeTab === 1 && currentData && !isCurrentLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-bold text-slate-900 mb-3">
                {currentData.title}
              </h2>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 mb-4 text-slate-700">
                <p><strong>From:</strong> {currentData.sender}</p>
                <p><strong>To:</strong> {currentData.recipient}</p>
                <p><strong>Subject:</strong> {currentData.subject}</p>
              </div>
              <div className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-line">
                {currentData.emailBody}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                  Questions 1–6: Comprehension &amp; Tone
                </h3>
                {renderMCList(currentData.comprehensionQuestions, 1)}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 text-sm">
                  Questions 7–11: Complete the Reply Email
                </h3>
                {renderTemplatedText(
                  currentData.replyTemplate,
                  currentData.replyBlanks,
                  1
                )}
                {renderBlankExplanations(currentData.replyBlanks, 1)}

                {!isCurrentSubmitted && (
                  <button
                    onClick={() => submitCurrentPart(1)}
                    className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
                  >
                    Submit &amp; Grade Part 1 ({currentAnsweredCount}/11)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PART 2 WORKSPACE */}
        {activeTab === 2 && currentData && !isCurrentLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-bold text-slate-900">
                {currentData.diagramTitle}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {currentData.diagramSubtitle}
              </p>
              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {currentData.headers.map((h: string, i: number) => (
                        <th key={i} className="p-2.5 border-r border-slate-700 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.rows.map((row: string[], rIdx: number) => (
                      <tr
                        key={rIdx}
                        className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                      >
                        {row.map((cell: string, cIdx: number) => (
                          <td
                            key={cIdx}
                            className="p-2.5 border-t border-r border-slate-200 text-slate-800"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-600 bg-amber-50 border border-amber-200 p-2.5 rounded">
                <strong>Note:</strong> {currentData.footnote}
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 text-sm">
                  Questions 1–5: Complete the Email
                </h3>
                {renderTemplatedText(
                  currentData.emailTemplate,
                  currentData.emailBlanks,
                  2
                )}
                {renderBlankExplanations(currentData.emailBlanks, 2)}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                  Questions 6–8: Diagram Synthesis
                </h3>
                {renderMCList(currentData.comprehensionQuestions, 2)}

                {!isCurrentSubmitted && (
                  <button
                    onClick={() => submitCurrentPart(2)}
                    className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
                  >
                    Submit &amp; Grade Part 2 ({currentAnsweredCount}/8)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PART 3 WORKSPACE (WITH SKIMMING SCRATCHPAD) */}
        {activeTab === 3 && currentData && !isCurrentLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-28 max-h-[80vh] overflow-y-auto">
              <div className="mb-4 pb-3 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">
                  {currentData.title}
                </h2>
                {isCurrentSubmitted && (
                  <span className="inline-block mt-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded">
                    Archetype: {currentData.archetype}
                  </span>
                )}
              </div>
              <div className="space-y-5 text-slate-800 leading-relaxed text-[15px]">
                {(["A", "B", "C", "D"] as const).map((letter) => (
                  <div key={letter} className="flex gap-3">
                    <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2.5 py-0.5 h-fit text-sm">
                      {letter}
                    </span>
                    <p>{currentData.paragraphs[letter]}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {/* Skimming Scratchpad */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Step 1: Paragraph Skimming Scratchpad (3–5 words each)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Skim Timer: {formatTime(skimSeconds)} (Target under 1:30)
                    </p>
                  </div>
                  {part3SkimLocked && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded font-medium">
                      Map Locked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(["A", "B", "C", "D"] as const).map((letter) => (
                    <div key={letter} className="flex items-center gap-2">
                      <span className="font-bold text-xs bg-slate-800 text-white px-2 py-1.5 rounded">
                        {letter}
                      </span>
                      <input
                        type="text"
                        disabled={isCurrentSubmitted}
                        placeholder={`Theme of Para ${letter}...`}
                        value={skimNotes[letter]}
                        onChange={(e) =>
                          setSkimNotes({
                            ...skimNotes,
                            [letter]: e.target.value,
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>

                {!part3SkimLocked && (
                  <button
                    onClick={() => setPart3SkimLocked(true)}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Lock Skim Map &amp; Unlock 9 Statements →
                  </button>
                )}
              </div>

              {/* 9 Shuffled Matching Statements */}
              {part3SkimLocked && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                    Step 2: Match Statements (A–D, or E if Not Given)
                  </h3>
                  <div className="space-y-4">
                    {currentData.questions.map((q: any) => {
                      const userAns = userAnswers[3]?.[q.id] || "";
                      const isCorrect =
                        isCurrentSubmitted && userAns === q.correctAnswer;
                      const itemDiag = currentDiagnostic?.missedItemsBreakdown.find(
                        (m) => m.questionId === q.id
                      );

                      return (
                        <div
                          key={q.id}
                          className={`p-4 rounded-lg border ${
                            isCurrentSubmitted
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
                              disabled={isCurrentSubmitted}
                              value={userAns}
                              onChange={(e) =>
                                setUserAnswers((prev) => ({
                                  ...prev,
                                  3: { ...prev[3], [q.id]: e.target.value },
                                }))
                              }
                              className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold bg-white shrink-0"
                            >
                              <option value="">Select</option>
                              <option value="A">A</option>
                              <option value="B">B</option>
                              <option value="C">C</option>
                              <option value="D">D</option>
                              <option value="E">E (Not Given)</option>
                            </select>
                          </div>

                          {isCurrentSubmitted && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs space-y-1.5">
                              <div className="flex justify-between font-bold">
                                <span
                                  className={
                                    isCorrect ? "text-emerald-700" : "text-red-700"
                                  }
                                >
                                  {isCorrect
                                    ? `✓ Correct (${q.correctAnswer})`
                                    : `✗ Selected: ${
                                        userAns || "Blank"
                                      } | Correct: ${q.correctAnswer}`}
                                </span>
                                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                                  {q.trapType}
                                </span>
                              </div>
                              <p className="text-slate-700">{q.explanation}</p>
                              {!isCorrect && itemDiag && (
                                <div className="bg-white p-2.5 rounded border border-red-200 space-y-1">
                                  <p className="text-red-700">
                                    <strong>Why it baited you:</strong>{" "}
                                    {itemDiag.whyYourChoiceBaitedYou}
                                  </p>
                                  <p className="text-emerald-800 font-medium">
                                    <strong>Next-Time Fix:</strong>{" "}
                                    {itemDiag.fixForNextTime}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!isCurrentSubmitted && (
                    <button
                      onClick={() => submitCurrentPart(3)}
                      className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
                    >
                      Submit &amp; Grade Part 3 ({currentAnsweredCount}/9)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PART 4 WORKSPACE */}
        {activeTab === 4 && currentData && !isCurrentLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-28 max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-slate-900">
                {currentData.title}
              </h2>
              <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-200">
                By {currentData.author}
              </p>
              <div className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-line">
                {currentData.articleBody}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                  Questions 1–5: Stakeholder Viewpoints
                </h3>
                {renderMCList(currentData.comprehensionQuestions, 4)}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 text-sm">
                  Questions 6–10: Reader Response Comment
                </h3>
                {renderTemplatedText(
                  currentData.commentTemplate,
                  currentData.commentBlanks,
                  4
                )}
                {renderBlankExplanations(currentData.commentBlanks, 4)}

                {!isCurrentSubmitted && (
                  <button
                    onClick={() => submitCurrentPart(4)}
                    className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
                  >
                    Submit &amp; Grade Part 4 ({currentAnsweredCount}/10)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
