import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI();

const mcQuestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.INTEGER },
    prompt: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctIndex: { type: Type.INTEGER },
    explanation: { type: Type.STRING },
    trapType: { type: Type.STRING },
  },
  required: ["id", "prompt", "options", "correctIndex", "explanation", "trapType"],
};

const blankItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.INTEGER },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctIndex: { type: Type.INTEGER },
    explanation: { type: Type.STRING },
    trapType: { type: Type.STRING },
  },
  required: ["id", "options", "correctIndex", "explanation", "trapType"],
};

const fullExamSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    part1: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        sender: { type: Type.STRING },
        recipient: { type: Type.STRING },
        subject: { type: Type.STRING },
        emailBody: { type: Type.STRING },
        comprehensionQuestions: { type: Type.ARRAY, items: mcQuestionSchema },
        replyTemplate: { type: Type.STRING },
        replyBlanks: { type: Type.ARRAY, items: blankItemSchema },
      },
      required: [
        "title",
        "sender",
        "recipient",
        "subject",
        "emailBody",
        "comprehensionQuestions",
        "replyTemplate",
        "replyBlanks",
      ],
    },
    part2: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        diagramTitle: { type: Type.STRING },
        diagramSubtitle: { type: Type.STRING },
        headers: { type: Type.ARRAY, items: { type: Type.STRING } },
        rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
        footnote: { type: Type.STRING },
        emailTemplate: { type: Type.STRING },
        emailBlanks: { type: Type.ARRAY, items: blankItemSchema },
        comprehensionQuestions: { type: Type.ARRAY, items: mcQuestionSchema },
      },
      required: [
        "title",
        "diagramTitle",
        "diagramSubtitle",
        "headers",
        "rows",
        "footnote",
        "emailTemplate",
        "emailBlanks",
        "comprehensionQuestions",
      ],
    },
    part3: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        archetype: { type: Type.STRING },
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
      required: ["title", "archetype", "paragraphs", "questions"],
    },
    part4: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        author: { type: Type.STRING },
        articleBody: { type: Type.STRING },
        comprehensionQuestions: { type: Type.ARRAY, items: mcQuestionSchema },
        commentTemplate: { type: Type.STRING },
        commentBlanks: { type: Type.ARRAY, items: blankItemSchema },
      },
      required: [
        "title",
        "author",
        "articleBody",
        "comprehensionQuestions",
        "commentTemplate",
        "commentBlanks",
      ],
    },
  },
  required: ["part1", "part2", "part3", "part4"],
};

const PART3_ARCHETYPES = [
  "Canadian Flora, Fauna & Natural Phenomena",
  "Canadian History, Exploration & Historical Figures",
  "Applied Science, Geography & Everyday Technology",
  "Culture, Social Institutions & Urban Life",
];

export async function POST(req: Request) {
  try {
    const { topic = "", previousTopics = [] } = await req.json().catch(() => ({}));
    const arch =
      PART3_ARCHETYPES[Math.floor(Math.random() * PART3_ARCHETYPES.length)];

    const prompt = `
      You are an official CELPIP psychometric test developer targeting CLB 10–12.
      Generate a COMPLETE 4-Part CELPIP-General Reading Exam (38 questions total) in ONE structured JSON response.

      PART 1 (Reading Correspondence - 11 Qs):
      - 280–330 word semi-formal Canadian email + 6 MC comprehension questions (id 1..6, 0-based correctIndex) + 140 word reply with placeholders {{7}}, {{8}}, {{9}}, {{10}}, {{11}} and 5 4-option replyBlanks (id 7..11).

      PART 2 (Reading to Apply a Diagram - 8 Qs):
      - 4x4 or 5x5 Canadian comparison schedule/brochure table + policy footnote + 150 word email with placeholders {{1}}, {{2}}, {{3}}, {{4}}, {{5}} and 5 4-option emailBlanks (id 1..5) + 3 MC synthesis questions (id 6..8).

      PART 3 (Reading for Information - 9 Qs):
      - 480–530 word Grade 10–12 Canadian Encyclopedia passage across Paragraphs A, B, C, D under archetype "${arch}" (avoid: ${previousTopics.join(", ")}).
      - 9 SHUFFLED statements (id 1..9) matching A, B, C, D, or E (Not Given): 3 Conceptual Paraphrase, 3 Intra-Paragraph Synthesis, 1 Cross-Paragraph Keyword Bait, 2 Adjacent-Concept Option E traps.

      PART 4 (Reading for Viewpoints - 10 Qs):
      - 460–510 word Canadian news/opinion article with 2+ contrasting named stakeholders + 5 MC comprehension questions (id 1..5) + 150 word reader comment with placeholders {{6}}, {{7}}, {{8}}, {{9}}, {{10}} and 5 4-option commentBlanks (id 6..10).

      ${topic ? `Theme focus across parts where relevant: ${topic}` : ""}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: fullExamSchema,
        temperature: 0.85,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (!response.text) throw new Error("Empty response from Gemini API");
    return NextResponse.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Full exam generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate full exam" },
      { status: 500 }
    );
  }
}
