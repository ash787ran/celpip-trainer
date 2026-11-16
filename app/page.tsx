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

interface Part1Data {
  title: string;
  sender: string;
  recipient: string;
  subject: string;
  emailBody: string;
  comprehensionQuestions: MCQuestion[];
  replyTemplate: string;
  replyBlanks: BlankItem[];
}

interface Part2Data {
  title: string;
  diagramTitle: string;
  diagramSubtitle: string;
  headers: string[];
  rows: string[][];
  footnote: string;
  emailTemplate: string;
  emailBlanks: BlankItem[];
  comprehensionQuestions: MCQuestion[];
}

interface Part3Question {
  id: number;
  statement: string;
  correctAnswer: "A" | "B" | "C" | "D" | "E";
  explanation: string;
  trapType: string;
}

interface Part3Data {
  title: string;
  archetype: string;
  paragraphs: { A: string; B: string; C: string; D: string };
  questions: Part3Question[];
}

interface Part4Data {
  title: string;
  author: string;
  articleBody: string;
  comprehensionQuestions: MCQuestion[];
  commentTemplate: string;
  commentBlanks: BlankItem[];
}

interface ExamData {
  part1: Part1Data | null;
  part2: Part2Data | null;
  part3: Part3Data | null;
  part4: Part4Data | null;
}

interface FullDiagnostic {
  overallDiagnosis: string;
  part3SkimAudit: string;
  weakestPartStrategy: string;
  nextTimeChecklist: string[];
  part3MissedBreakdown: {
    questionId: number;
    whyYourChoiceBaitedYou: string;
    fixForNextTime: string;
  }[];
}

export default function FullCelpipReadingSimulator() {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | "coach">(1);
  const [examStarted, setExamStarted] = useState(false);
  const [examData, setExamData] = useState<ExamData>({
    part1: null,
    part2: null,
    part3: null,
    part4: null,
  });
  const [loadingParts, setLoadingParts] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [customTopic, setCustomTopic] = useState("");

  // User Answers across all 4 parts
  const [answers, setAnswers] = useState<{
    part1: Record<number, number>;
    part2: Record<number, number>;
    part3: Record<number, string>;
    part4: Record<number, number>;
  }>({ part1: {}, part2: {}, part3: {}, part4: {} });

  // Part 3 Skimming Scratchpad
  const [part3SkimLocked, setPart3SkimLocked] = useState(false);
  const [skimNotes, setSkimNotes] = useState({ A: "", B: "", C: "", D: "" });
  const [skimSeconds, setSkimSeconds] = useState(0);

  // Global 55:00 Exam Clock & Submission State
  const [timeLeft, setTimeLeft] = useState(3300); // 55 minutes
  const [submitted, setSubmitted] = useState(false);
  const [diagnostic, setDiagnostic] = useState<FullDiagnostic | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // Global Timer + Part 3 Skim Timer
  useEffect(() => {
    if (!examStarted || submitted || timeLeft <= 0) return;
    const interval = setInterval(() => {
      if (activeTab === 3 && !part3SkimLocked && examData.part3) {
        setSkimSeconds((s) => s + 1);
      }
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [examStarted, submitted, timeLeft, activeTab, part3SkimLocked, examData.part3]);

  const fetchSinglePart = async (partNum: 1 | 2 | 3 | 4) => {
    setLoadingParts((prev) => ({ ...prev, [partNum]: true }));
    try {
      const savedTopics = JSON.parse(
        localStorage.getItem("celpip_topics") || "[]"
      );
      const res = await fetch("/api/generate-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part: partNum,
          topic: customTopic,
          previousTopics: savedTopics,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed Part ${partNum}`);

      setExamData((prev) => ({ ...prev, [`part${partNum}`]: data }));
      if (partNum === 3 && data.title) {
        localStorage.setItem(
          "celpip_topics",
          JSON.stringify([...savedTopics, data.title].slice(-15))
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingParts((prev) => ({ ...prev, [partNum]: false }));
    }
  };

  const startFullReadingMock = async () => {
    setError("");
    setExamStarted(true);
    setSubmitted(false);
    setDiagnostic(null);
    setActiveTab(1);
    setTimeLeft(3300);
    setAnswers({ part1: {}, part2: {}, part3: {}, part4: {} });
    setSkimNotes({ A: "", B: "", C: "", D: "" });
    setPart3SkimLocked(false);
    setSkimSeconds(0);
    setExamData({ part1: null, part2: null, part3: null, part4: null });

    // Generate Part 1 immediately, and pre-fetch Parts 2, 3, 4 in parallel
    await fetchSinglePart(1);
    fetchSinglePart(2);
    fetchSinglePart(3);
    fetchSinglePart(4);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Answered Counters
  const countP1 = Object.keys(answers.part1).length;
  const countP2 = Object.keys(answers.part2).length;
  const countP3 = Object.values(answers.part3).filter(Boolean).length;
  const countP4 = Object.keys(answers.part4).length;
  const totalAnswered = countP1 + countP2 + countP3 + countP4;

  // Score Calculators (Only evaluated after submission)
  const computeScores = () => {
    let p1 = 0;
    if (examData.part1) {
      examData.part1.comprehensionQuestions.forEach((q) => {
        if (answers.part1[q.id] === q.correctIndex) p1++;
      });
      examData.part1.replyBlanks.forEach((b) => {
        if (answers.part1[b.id] === b.correctIndex) p1++;
      });
    }

    let p2 = 0;
    if (examData.part2) {
      examData.part2.emailBlanks.forEach((b) => {
        if (answers.part2[b.id] === b.correctIndex) p2++;
      });
      examData.part2.comprehensionQuestions.forEach((q) => {
        if (answers.part2[q.id] === q.correctIndex) p2++;
      });
    }

    let p3 = 0;
    if (examData.part3) {
      examData.part3.questions.forEach((q) => {
        if (answers.part3[q.id] === q.correctAnswer) p3++;
      });
    }

    let p4 = 0;
    if (examData.part4) {
      examData.part4.comprehensionQuestions.forEach((q) => {
        if (answers.part4[q.id] === q.correctIndex) p4++;
      });
      examData.part4.commentBlanks.forEach((b) => {
        if (answers.part4[b.id] === b.correctIndex) p4++;
      });
    }

    return { part1: p1, part2: p2, part3: p3, part4: p4, total: p1 + p2 + p3 + p4 };
  };

  const estimateOverallCLB = (total: number) => {
    if (total >= 35) return "CLB 11–12";
    if (total >= 32) return "CLB 10";
    if (total >= 28) return "CLB 9";
    if (total >= 24) return "CLB 8";
    return "CLB 7 or below";
  };

  const handleFinalSubmit = async (auto = false) => {
    if (!auto && totalAnswered < 38) {
      const ok = window.confirm(
        `You have completed ${totalAnswered} of 38 questions across Parts 1–4. Submit entire Reading Test now?`
      );
      if (!ok) return;
    }

    setSubmitted(true);
    setPart3SkimLocked(true);
    setActiveTab("coach");

    const scoresByPart = computeScores();
    setDiagnosing(true);
    try {
      const res = await fetch("/api/diagnose-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examData,
          userAnswers: answers,
          skimNotes,
          scoresByPart,
        }),
      });
      if (res.ok) {
        setDiagnostic(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosing(false);
    }
  };

  // Helper to render text with inline {{id}} dropdowns
  const renderTemplatedText = (
    template: string,
    blanks: BlankItem[],
    partKey: "part1" | "part2" | "part4"
  ) => {
    const tokens = template.split(/(\{\{\d+\}\})/g);
    return (
      <div className="leading-8 text-[15px] text-slate-800 whitespace-pre-line">
        {tokens.map((token, index) => {
          const match = token.match(/^\{\{(\d+)\}\}$/);
          if (!match) return <span key={index}>{token}</span>;

          const blankId = parseInt(match[1], 10);
          const blankObj = blanks.find((b) => b.id === blankId);
          if (!blankObj) return <span key={index}>{token}</span>;

          const selectedVal = answers[partKey][blankId];
          const isCorrect = submitted && selectedVal === blankObj.correctIndex;

          return (
            <span key={index} className="inline-block mx-1 align-middle">
              <select
                disabled={submitted}
                value={selectedVal ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [partKey]: {
                      ...prev[partKey],
                      [blankId]: parseInt(e.target.value, 10),
                    },
                  }))
                }
                className={`px-2 py-1 rounded border text-xs font-semibold transition ${
                  submitted
                    ? isCorrect
                      ? "bg-emerald-100 border-emerald-500 text-emerald-900"
                      : "bg-red-100 border-red-500 text-red-900"
                    : "bg-blue-50/70 border-blue-300 text-slate-900 focus:border-blue-600"
                }`}
              >
                <option value="">[{blankId}] Select...</option>
                {blankObj.options.map((opt, idx) => (
                  <option key={idx} value={idx}>
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

  // Helper to render standard 4-option MC questions
  const renderMCList = (
    questions: MCQuestion[],
    partKey: "part1" | "part2" | "part4"
  ) => (
    <div className="space-y-4">
      {questions.map((q) => {
        const chosen = answers[partKey][q.id];
        const isCorrect = submitted && chosen === q.correctIndex;

        return (
          <div
            key={q.id}
            className={`p-4 rounded-lg border ${
              submitted
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
                const isRightOption = submitted && idx === q.correctIndex;

                return (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-2 rounded border text-xs cursor-pointer transition ${
                      submitted
                        ? isRightOption
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
                      disabled={submitted}
                      name={`${partKey}-q-${q.id}`}
                      checked={isSelected}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [partKey]: { ...prev[partKey], [q.id]: idx },
                        }))
                      }
                      className="mt-0.5"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>

            {submitted && (
              <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between font-bold">
                  <span className={isCorrect ? "text-emerald-700" : "text-red-700"}>
                    {isCorrect ? "✓ Correct" : `✗ Correct Option: ${q.options[q.correctIndex]}`}
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

  // Helper to render post-submission explanations for inline dropdown blanks
  const renderBlankExplanations = (
    blanks: BlankItem[],
    partKey: "part1" | "part2" | "part4"
  ) => {
    if (!submitted) return null;
    return (
      <div className="mt-4 pt-4 border-t border-slate-200 space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Dropdown Blanks Breakdown
        </h4>
        {blanks.map((b) => {
          const chosen = answers[partKey][b.id];
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
                  Blank [{b.id}]: {isCorrect ? "✓ Correct" : `✗ Selected: ${chosen !== undefined ? b.options[chosen] : "Blank"} | Correct: ${b.options[b.correctIndex]}`}
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

  const scores = submitted ? computeScores() : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      {/* Top Global Exam Header */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-white font-bold text-xs px-2.5 py-1 rounded">
            CELPIP-G
          </span>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              Full Reading Test Simulator (Parts 1–4)
            </h1>
            <p className="text-[11px] text-slate-400">
              38 Scored Questions • CLB 10–12 Calibration • Strict Exam Mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Optional theme (e.g., Toronto Transit)"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={startFullReadingMock}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-xs font-semibold transition cursor-pointer"
          >
            {examStarted ? "Restart New Full Test" : "Start Full 55-Min Test"}
          </button>

          {examStarted && (
            <>
              <div className="bg-slate-800 px-3 py-1.5 rounded text-xs font-semibold text-slate-200">
                Answered: {totalAnswered} / 38
              </div>
              <div
                className={`px-3 py-1.5 rounded font-mono text-sm font-bold ${
                  timeLeft < 300 && !submitted
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-slate-800 text-emerald-400"
                }`}
              >
                ⏱ {formatTime(timeLeft)}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Landing Screen before starting */}
      {!examStarted ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Complete 4-Part CELPIP Reading Simulation
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Navigate freely between all 4 official parts using the left sidebar
              under a single 55:00 clock. Answers remain locked until you submit
              the entire test, followed by a full AI Root-Cause Diagnostic.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left mb-8 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-blue-700">Part 1 (11 Qs)</p>
                <p className="text-slate-600 mt-0.5">Correspondence (~11m)</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-blue-700">Part 2 (8 Qs)</p>
                <p className="text-slate-600 mt-0.5">Apply Diagram (~9m)</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-blue-700">Part 3 (9 Qs)</p>
                <p className="text-slate-600 mt-0.5">Information + Skim (~10m)</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-blue-700">Part 4 (10 Qs)</p>
                <p className="text-slate-600 mt-0.5">Viewpoints (~13m)</p>
              </div>
            </div>
            <button
              onClick={startFullReadingMock}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer"
            >
              Launch Full 38-Question Reading Exam
            </button>
          </div>
        </main>
      ) : (
        /* Main Two-Column Shell: Left Navigation Rail + Right Workspace */
        <div className="flex-1 flex flex-col md:flex-row">
          {/* LEFT NAVIGATION PANE FOR ALL 4 PARTS */}
          <aside className="w-full md:w-64 bg-slate-900 text-slate-200 p-4 flex flex-col justify-between border-r border-slate-800 shrink-0">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-2">
                Reading Sections
              </p>

              {[
                {
                  id: 1 as const,
                  title: "Part 1: Correspondence",
                  pace: "Target: 11 min",
                  done: countP1,
                  total: 11,
                  score: scores?.part1,
                },
                {
                  id: 2 as const,
                  title: "Part 2: Apply Diagram",
                  pace: "Target: 9 min",
                  done: countP2,
                  total: 8,
                  score: scores?.part2,
                },
                {
                  id: 3 as const,
                  title: "Part 3: Information",
                  pace: "Target: 10 min",
                  done: countP3,
                  total: 9,
                  score: scores?.part3,
                },
                {
                  id: 4 as const,
                  title: "Part 4: Viewpoints",
                  pace: "Target: 13 min",
                  done: countP4,
                  total: 10,
                  score: scores?.part4,
                },
              ].map((item) => {
                const isActive = activeTab === item.id;
                const isLoading = loadingParts[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left p-3 rounded-lg transition border cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                        : "bg-slate-800/60 text-slate-300 border-slate-700/70 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{item.title}</span>
                      {isLoading ? (
                        <span className="text-[10px] animate-pulse text-amber-300">
                          Loading...
                        </span>
                      ) : submitted ? (
                        <span className="bg-slate-950/60 px-2 py-0.5 rounded text-emerald-300">
                          {item.score}/{item.total}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            item.done === item.total
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-slate-950/50 text-slate-300"
                          }`}
                        >
                          {item.done}/{item.total}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        isActive ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {item.pace}
                    </p>
                  </button>
                );
              })}

              {submitted && (
                <button
                  onClick={() => setActiveTab("coach")}
                  className={`w-full text-left p-3 rounded-lg transition border mt-4 cursor-pointer ${
                    activeTab === "coach"
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                      : "bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-700 font-semibold"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span>🔍 Root-Cause Coach</span>
                    <span>{scores?.total}/38</span>
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-85">
                    {scores ? estimateOverallCLB(scores.total) : ""}
                  </p>
                </button>
              )}
            </div>

            {/* Bottom Submit Button inside Left Rail */}
            <div className="pt-4 border-t border-slate-800 mt-6">
              {!submitted ? (
                <button
                  onClick={() => handleFinalSubmit(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  Submit Full Reading Test ({totalAnswered}/38)
                </button>
              ) : (
                <div className="bg-slate-800 p-3 rounded-lg text-center border border-slate-700">
                  <p className="text-xs text-slate-400">Final Reading Score</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {scores?.total} / 38
                  </p>
                  <p className="text-xs font-semibold text-white">
                    {scores ? estimateOverallCLB(scores.total) : ""}
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT WORKSPACE AREA */}
          <main className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-lg mb-6 text-xs">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Loading indicator if user clicks a tab still generating */}
            {typeof activeTab === "number" && loadingParts[activeTab] && (
              <div className="text-center py-28">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-medium text-slate-600">
                  Generating Part {activeTab} at CLB 10–12 calibration...
                </p>
              </div>
            )}

            {/* PART 1: READING CORRESPONDENCE */}
            {activeTab === 1 && examData.part1 && !loadingParts[1] && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 xl:sticky xl:top-20">
                  <h2 className="text-lg font-bold text-slate-900 mb-3">
                    Part 1: {examData.part1.title}
                  </h2>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 mb-4 text-slate-700">
                    <p><strong>From:</strong> {examData.part1.sender}</p>
                    <p><strong>To:</strong> {examData.part1.recipient}</p>
                    <p><strong>Subject:</strong> {examData.part1.subject}</p>
                  </div>
                  <div className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-line">
                    {examData.part1.emailBody}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                      Questions 1–6: Comprehension &amp; Tone
                    </h3>
                    {renderMCList(examData.part1.comprehensionQuestions, "part1")}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 text-sm">
                      Questions 7–11: Complete the Reply Email
                    </h3>
                    {renderTemplatedText(
                      examData.part1.replyTemplate,
                      examData.part1.replyBlanks,
                      "part1"
                    )}
                    {renderBlankExplanations(examData.part1.replyBlanks, "part1")}
                  </div>
                </div>
              </div>
            )}

            {/* PART 2: READING TO APPLY A DIAGRAM */}
            {activeTab === 2 && examData.part2 && !loadingParts[2] && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 xl:sticky xl:top-20">
                  <h2 className="text-lg font-bold text-slate-900">
                    {examData.part2.diagramTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    {examData.part2.diagramSubtitle}
                  </p>
                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          {examData.part2.headers.map((h, i) => (
                            <th key={i} className="p-2.5 border-r border-slate-700 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {examData.part2.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            {row.map((cell, cIdx) => (
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
                    <strong>Note:</strong> {examData.part2.footnote}
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 text-sm">
                      Questions 1–5: Complete the Correspondence
                    </h3>
                    {renderTemplatedText(
                      examData.part2.emailTemplate,
                      examData.part2.emailBlanks,
                      "part2"
                    )}
                    {renderBlankExplanations(examData.part2.emailBlanks, "part2")}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                      Questions 6–8: Diagram Synthesis
                    </h3>
                    {renderMCList(examData.part2.comprehensionQuestions, "part2")}
                  </div>
                </div>
              </div>
            )}

            {/* PART 3: READING FOR INFORMATION + SKIMMING SCRATCHPAD */}
            {activeTab === 3 && examData.part3 && !loadingParts[3] && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 xl:sticky xl:top-20 max-h-[82vh] overflow-y-auto">
                  <div className="mb-4 pb-3 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">
                      Part 3: {examData.part3.title}
                    </h2>
                    {submitted && (
                      <span className="inline-block mt-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded">
                        Archetype: {examData.part3.archetype}
                      </span>
                    )}
                  </div>
                  <div className="space-y-5 text-slate-800 leading-relaxed text-[15px]">
                    {(["A", "B", "C", "D"] as const).map((letter) => (
                      <div key={letter} className="flex gap-3">
                        <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2.5 py-0.5 h-fit text-sm">
                          {letter}
                        </span>
                        <p>{examData.part3!.paragraphs[letter]}</p>
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
                            disabled={submitted}
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
                        {examData.part3.questions.map((q) => {
                          const userAns = answers.part3[q.id] || "";
                          const isCorrect =
                            submitted && userAns === q.correctAnswer;
                          return (
                            <div
                              key={q.id}
                              className={`p-4 rounded-lg border ${
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
                                  value={userAns}
                                  onChange={(e) =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      part3: {
                                        ...prev.part3,
                                        [q.id]: e.target.value,
                                      },
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

                              {submitted && (
                                <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs space-y-1">
                                  <div className="flex justify-between font-bold">
                                    <span
                                      className={
                                        isCorrect
                                          ? "text-emerald-700"
                                          : "text-red-700"
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
                                  <p className="text-slate-700">
                                    {q.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PART 4: READING FOR VIEWPOINTS */}
            {activeTab === 4 && examData.part4 && !loadingParts[4] && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 xl:sticky xl:top-20 max-h-[82vh] overflow-y-auto">
                  <h2 className="text-lg font-bold text-slate-900">
                    Part 4: {examData.part4.title}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-200">
                    By {examData.part4.author}
                  </p>
                  <div className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-line">
                    {examData.part4.articleBody}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 text-sm">
                      Questions 1–5: Stakeholder Viewpoints &amp; Inference
                    </h3>
                    {renderMCList(examData.part4.comprehensionQuestions, "part4")}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 text-sm">
                      Questions 6–10: Reader Response Comment
                    </h3>
                    {renderTemplatedText(
                      examData.part4.commentTemplate,
                      examData.part4.commentBlanks,
                      "part4"
                    )}
                    {renderBlankExplanations(examData.part4.commentBlanks, "part4")}
                  </div>
                </div>
              </div>
            )}

            {/* POST-SUBMISSION ROOT-CAUSE COACH TAB */}
            {activeTab === "coach" && submitted && scores && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-700">
                    <div>
                      <h2 className="text-xl font-bold text-amber-400">
                        🔍 Full Reading Mock — Root-Cause Diagnostic
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Click any Part (1–4) in the left sidebar to inspect
                        highlighted answers and trap proofs.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-4 py-1.5 rounded-full text-sm font-bold">
                        {scores.total} / 38 ({estimateOverallCLB(scores.total)})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 text-xs">
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400">Part 1 (Correspondence)</p>
                      <p className="text-base font-bold text-white mt-0.5">
                        {scores.part1} / 11
                      </p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400">Part 2 (Diagram)</p>
                      <p className="text-base font-bold text-white mt-0.5">
                        {scores.part2} / 8
                      </p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400">Part 3 (Information)</p>
                      <p className="text-base font-bold text-white mt-0.5">
                        {scores.part3} / 9
                      </p>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-400">Part 4 (Viewpoints)</p>
                      <p className="text-base font-bold text-white mt-0.5">
                        {scores.part4} / 10
                      </p>
                    </div>
                  </div>

                  {diagnosing && (
                    <p className="text-xs text-amber-300 animate-pulse py-6">
                      Analyzing your 38 answers and Part 3 skimming map...
                    </p>
                  )}

                  {diagnostic && !diagnosing && (
                    <div className="space-y-4 text-xs leading-relaxed mt-4">
                      <div className="bg-slate-800/90 p-4 rounded-lg border border-slate-700">
                        <p className="font-bold text-amber-300 mb-1">
                          Executive CLB 12 Gap Diagnosis:
                        </p>
                        <p className="text-slate-200">
                          {diagnostic.overallDiagnosis}
                        </p>
                      </div>

                      <div className="bg-slate-800/90 p-4 rounded-lg border border-slate-700">
                        <p className="font-bold text-blue-300 mb-1">
                          Part 3 Skimming Map Audit:
                        </p>
                        <p className="text-slate-200">
                          {diagnostic.part3SkimAudit}
                        </p>
                      </div>

                      <div className="bg-slate-800/90 p-4 rounded-lg border border-slate-700">
                        <p className="font-bold text-rose-300 mb-1">
                          Weakest Section Tactical Fix:
                        </p>
                        <p className="text-slate-200">
                          {diagnostic.weakestPartStrategy}
                        </p>
                      </div>

                      <div className="bg-emerald-950/60 p-4 rounded-lg border border-emerald-800/70">
                        <p className="font-bold text-emerald-300 mb-1.5">
                          What to Take Care of Next Time:
                        </p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-200">
                          {diagnostic.nextTimeChecklist.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      {diagnostic.part3MissedBreakdown.length > 0 && (
                        <div className="bg-slate-800/90 p-4 rounded-lg border border-slate-700 space-y-2.5">
                          <p className="font-bold text-rose-300">
                            Part 3 Missed Question Root-Cause Breakdown:
                          </p>
                          {diagnostic.part3MissedBreakdown.map((m) => (
                            <div
                              key={m.questionId}
                              className="p-3 bg-slate-900/80 rounded border border-slate-700 space-y-1"
                            >
                              <p className="font-bold text-white">
                                Question {m.questionId}:
                              </p>
                              <p className="text-slate-300">
                                <span className="text-rose-400 font-semibold">
                                  Why your choice baited you:
                                </span>{" "}
                                {m.whyYourChoiceBaitedYou}
                              </p>
                              <p className="text-emerald-300">
                                <span className="font-semibold">
                                  Next-Time Fix:
                                </span>{" "}
                                {m.fixForNextTime}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
