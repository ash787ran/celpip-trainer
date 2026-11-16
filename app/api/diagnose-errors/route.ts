import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI();

const partDiagnosticSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    coreErrorPattern: {
      type: Type.STRING,
      description:
        "1-2 sentence diagnosis of the exact cognitive trap pattern causing mistakes in this part.",
    },
    skimOrReadingAudit: {
      type: Type.STRING,
      description:
        "For Part 3, audits their A-D skimming notes vs actual paragraph themes. For Parts 1, 2, or 4, audits their reading/inference approach.",
    },
    nextTimeRules: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 to 3 concrete rules to apply before answering on their next attempt.",
    },
    missedItemsBreakdown: {
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
    "coreErrorPattern",
    "skimOrReadingAudit",
    "nextTimeRules",
    "missedItemsBreakdown",
  ],
};

export async function POST(req: Request) {
  try {
    const { partNumber, partData, userAnswers, skimNotes, score, total } =
      await req.json();

    const prompt = `
      You are an elite CELPIP Reading CLB 12 psychometric coach.
      Analyze a student's completed CELPIP Reading Part ${partNumber} drill (Score: ${score}/${total}).

      PART ${partNumber} CONTENT & QUESTIONS:
      ${JSON.stringify(partData)}

      STUDENT ANSWERS:
      ${JSON.stringify(userAnswers)}

      ${
        partNumber === 3
          ? `STUDENT'S PART 3 SKIMMING NOTES (A-D): ${JSON.stringify(skimNotes)}`
          : ""
      }

      TASK:
      1. Identify the exact cognitive trap pattern behind any missed questions (or if ${score}/${total} is a perfect score, highlight the hardest traps they dodged).
      2. ${
        partNumber === 3
          ? "Audit their Part 3 A-D skimming notes against each paragraph's real theme and identify if any skim gap led to a wrong match."
          : "Evaluate how well they handled tone, inference, and paraphrasing in this section."
      }
      3. Provide 2-3 sharp, tactical rules for their next attempt and a per-question breakdown for every wrong answer.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: partDiagnosticSchema,
        thinkingConfig: { thinkingLevel: "LOW" as any },
      },
    });

    if (!response.text) throw new Error("Empty diagnostic response");
    return NextResponse.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Diagnostic error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate diagnosis" },
      { status: 500 }
    );
  }
}
