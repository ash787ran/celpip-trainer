import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI();

const part3Schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    paragraphs: {
      type: Type.OBJECT,
      properties: {
        A: { type: Type.STRING },
        B: { type: Type.STRING },
        C: { type: Type.STRING },
        D: { type: Type.STRING },
      },
      required: ["A", "B", "C", "D"],
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          statement: { type: Type.STRING },
          correctAnswer: { type: Type.STRING, enum: ["A", "B", "C", "D", "E"] },
          explanation: { type: Type.STRING },
          trapType: { type: Type.STRING },
        },
        required: ["id", "statement", "correctAnswer", "explanation", "trapType"],
      },
    },
  },
  required: ["title", "paragraphs", "questions"],
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = body.topic || "";
    const previousTopics: string[] = body.previousTopics || [];

    const systemPrompt = `
      You are an official CELPIP psychometric test developer targeting CLB 10–12.
      Generate a Reading Part 3 (Reading for Information) task.
      RULES:
      1. Word Count: 500–550 words total across Paragraphs A, B, C, and D (~130 words each).
      2. Anchor Structure: Assign each paragraph a distinct thematic role (A=Context/Problem, B=Mechanism/Solution, C=Technical Hurdles, D=Policy/Governance).
      3. Questions: Generate exactly 9 statements (id 1 through 9).
      4. Distractor Engineering: Use high-register synonyms rather than verbatim words. Include 1 to 2 "Not Given" (E) statements that inject plausible but unstated numbers, deadlines, or penalties.
      5. Explanations: For each question, provide the exact proof sentence from the passage and name the trap type (e.g., "High-Register Synonym", "Invented Number - Option E", "Keyword Bait").
    `;

    const prompt = topic
      ? `Generate a CLB 10-12 Part 3 reading drill about: ${topic}.`
      : `Generate a CLB 10-12 Part 3 reading drill on a Canadian infrastructure, environmental science, urban policy, or emerging technology topic. Avoid these previously covered topics: ${previousTopics.join(", ")}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: part3Schema,
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    return NextResponse.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate drill" },
      { status: 500 }
    );
  }
}
