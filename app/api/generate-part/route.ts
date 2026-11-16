import { Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/gemini";

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

const part1Schema: Schema = {
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
  required: ["title", "sender", "recipient", "subject", "emailBody", "comprehensionQuestions", "replyTemplate", "replyBlanks"],
};

const part2Schema: Schema = {
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
  required: ["title", "diagramTitle", "diagramSubtitle", "headers", "rows", "footnote", "emailTemplate", "emailBlanks", "comprehensionQuestions"],
};

const part3Schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    archetype: { type: Type.STRING },
    paragraphs: {
      type: Type.OBJECT,
      properties: { A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING } },
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
};

const part4Schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    articleBody: { type: Type.STRING },
    comprehensionQuestions: { type: Type.ARRAY, items: mcQuestionSchema },
    commentTemplate: { type: Type.STRING },
    commentBlanks: { type: Type.ARRAY, items: blankItemSchema },
  },
  required: ["title", "author", "articleBody", "comprehensionQuestions", "commentTemplate", "commentBlanks"],
};

const PART3_ARCHETYPES = [
  "Canadian Flora, Fauna & Natural Phenomena",
  "Canadian History, Exploration & Historical Figures",
  "Applied Science, Geography & Everyday Technology",
  "Culture, Social Institutions & Urban Life",
];

export async function POST(req: Request) {
  try {
    const { part, topic = "", previousTopics = [] } = await req.json();
    const configs: Record<number, { prompt: string; schema: Schema }> = {
      1: {
        schema: part1Schema,
        prompt: `Generate CELPIP Reading Part 1 (Correspondence, CLB 10–12): 280-word semi-formal Canadian email, 6 MC questions (id 1..6, 0-based correctIndex), and a 140-word reply with placeholders {{7}}, {{8}}, {{9}}, {{10}}, {{11}} plus 5 4-option replyBlanks (id 7..11). ${topic ? `Theme: ${topic}` : ""}`,
      },
      2: {
        schema: part2Schema,
        prompt: `Generate CELPIP Reading Part 2 (Apply a Diagram, CLB 10–12): 4x4 Canadian schedule/brochure comparison table + policy footnote, 150-word email with placeholders {{1}}, {{2}}, {{3}}, {{4}}, {{5}} plus 5 4-option emailBlanks (id 1..5), and 3 MC synthesis questions (id 6..8). ${topic ? `Theme: ${topic}` : ""}`,
      },
      3: {
        schema: part3Schema,
        prompt: `Generate CELPIP Reading Part 3 (Information, CLB 10–12) under archetype "${PART3_ARCHETYPES[Math.floor(Math.random() * PART3_ARCHETYPES.length)]}" (avoid: ${previousTopics.join(", ")}). Write 480-520 words across Paragraphs A, B, C, D in clear Grade 10-12 Canadian Encyclopedia prose. Create 9 shuffled statements (id 1..9) matching A-D or E (Not Given): 3 Conceptual Paraphrase, 3 Intra-Paragraph Synthesis, 1 Keyword Bait, 2 Adjacent-Concept Option E traps. ${topic ? `Topic: ${topic}` : ""}`,
      },
      4: {
        schema: part4Schema,
        prompt: `Generate CELPIP Reading Part 4 (Viewpoints, CLB 10–12): 460-word Canadian opinion article featuring 2+ named stakeholders with opposing views, 5 MC questions (id 1..5), and a 140-word reader comment with placeholders {{6}}, {{7}}, {{8}}, {{9}}, {{10}} plus 5 4-option commentBlanks (id 6..10). ${topic ? `Theme: ${topic}` : ""}`,
      },
    };

    const selected = configs[part];
    if (!selected) return NextResponse.json({ error: "Invalid part" }, { status: 400 });

    const data = await generateWithFallback(selected.prompt, selected.schema);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Part generation error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate part" }, { status: 500 });
  }
}
