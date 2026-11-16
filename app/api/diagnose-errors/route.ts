import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI();

const fullDiagnosticSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overallDiagnosis: {
      type: Type.STRING,
      description:
        "2-3 sentence executive summary of the test-taker's performance across Parts 1–4 and what separates their current score from CLB 11–12.",
    },
    part3SkimAudit: {
      type: Type.STRING,
      description:
        "Specific audit of their Part 3 A-D skimming notes vs actual paragraph themes and whether skim gaps caused Part 3 mistakes.",
    },
    weakestPartStrategy: {
      type: Type.STRING,
      description:
        "Targeted tactical advice for the specific Reading Part (1, 2, 3, or 4) where they lost the most points.",
    },
    nextTimeChecklist: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 concrete, high-impact rules to follow on their next full Reading mock.",
    },
    part3MissedBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.INTEGER },
          whyYourChoiceBaitedYou: { type: Type.STRING },
          fixForNextTime: { type: Type.STRING },
        },
        required: ["questionId", "whyYourChoiceBaitedYou", "fixForNextTime"],
      },
    },
  },
  required: [
    "overallDiagnosis",
    "part3SkimAudit",
    "weakestPartStrategy",
    "nextTimeChecklist",
    "part3MissedBreakdown",
  ],
};

export async function POST(req: Request) {
  try {
    const { examData, userAnswers, skimNotes, scoresByPart } = await req.json();

    const part3 = examData.part3;
    const part3Missed = part3
      ? part3.questions
          .filter((q: any) => userAnswers.part3?.[q.id] !== q.correctAnswer)
          .map((q: any) => ({
            id: q.id,
            statement: q.statement,
            userAnswer: userAnswers.part3?.[q.id] || "Blank",
            correctAnswer: q.correctAnswer,
            trapType: q.trapType,
            proof: q.explanation,
          }))
      : [];

    const prompt = `
      You are an elite CELPIP Reading CLB 12 psychometric coach.
      Analyze a candidate's completed 38-question CELPIP Reading Mock Test.

      SCORES BY PART:
      - Part 1 (Correspondence): ${scoresByPart.part1} / 11
      - Part 2 (Apply a Diagram): ${scoresByPart.part2} / 8
      - Part 3 (Reading for Information): ${scoresByPart.part3} / 9
      - Part 4 (Reading for Viewpoints): ${scoresByPart.part4} / 10
      - Total: ${scoresByPart.total} / 38

      PART 3 PARAGRAPHS:
      ${part3 ? JSON.stringify(part3.paragraphs) : "N/A"}

      STUDENT'S PART 3 SKIMMING NOTES:
      A: ${skimNotes?.A || "(Skipped)"}
      B: ${skimNotes?.B || "(Skipped)"}
      C: ${skimNotes?.C || "(Skipped)"}
      D: ${skimNotes?.D || "(Skipped)"}

      PART 3 MISSED QUESTIONS:
      ${JSON.stringify(part3Missed, null, 2)}

      Provide a sharp, honest, high-value CLB 12 coaching diagnosis:
      1. Identify why they lost points across the 4 parts.
      2. Audit their Part 3 A-D skim notes against the actual text.
      3. Give targeted strategies for their weakest part and every missed Part 3 trap.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fullDiagnosticSchema,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return NextResponse.json(JSON.parse(response.text!));
  } catch (error: any) {
    console.error("Full diagnostic error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate diagnosis" },
      { status: 500 }
    );
  }
}
