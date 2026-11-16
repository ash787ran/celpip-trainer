import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI();

const mcQuestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.INTEGER },
    prompt: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly 4 options labeled A, B, C, D (or plain strings).",
    },
    correctIndex: {
      type: Type.INTEGER,
      description: "0-based index (0, 1, 2, or 3) of the correct option.",
    },
    explanation: { type: Type.STRING },
    trapType: { type: Type.STRING },
  },
  required: ["id", "prompt", "options", "correctIndex", "explanation", "trapType"],
};

const blankItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.INTEGER },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly 4 plausible phrase/clause options for this blank.",
    },
    correctIndex: {
      type: Type.INTEGER,
      description: "0-based index (0, 1, 2, or 3) of the correct option.",
    },
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
    comprehensionQuestions: {
      type: Type.ARRAY,
      items: mcQuestionSchema,
      description: "Exactly 6 multiple-choice questions (id 1 to 6).",
    },
    replyTemplate: {
      type: Type.STRING,
      description:
        "Reply email containing exact placeholders {{7}}, {{8}}, {{9}}, {{10}}, {{11}}.",
    },
    replyBlanks: {
      type: Type.ARRAY,
      items: blankItemSchema,
      description: "Exactly 5 blank items matching id 7 through 11.",
    },
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
};

const part2Schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    diagramTitle: { type: Type.STRING },
    diagramSubtitle: { type: Type.STRING },
    headers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "4 to 5 column headers for the visual schedule/brochure table.",
    },
    rows: {
      type: Type.ARRAY,
      items: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      description: "4 to 5 rows matching the exact column count.",
    },
    footnote: { type: Type.STRING },
    emailTemplate: {
      type: Type.STRING,
      description:
        "Email referencing the diagram with exact placeholders {{1}}, {{2}}, {{3}}, {{4}}, {{5}}.",
    },
    emailBlanks: {
      type: Type.ARRAY,
      items: blankItemSchema,
      description: "Exactly 5 inline blank items (id 1 to 5).",
    },
    comprehensionQuestions: {
      type: Type.ARRAY,
      items: mcQuestionSchema,
      description: "Exactly 3 multiple-choice questions (id 6, 7, 8).",
    },
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
};

const part3Schema: Schema = {
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
};

const part4Schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    articleBody: {
      type: Type.STRING,
      description:
        "450-520 word multi-paragraph opinion/news article featuring at least 2 named experts/stakeholders with contrasting viewpoints on a Canadian community/policy issue.",
    },
    comprehensionQuestions: {
      type: Type.ARRAY,
      items: mcQuestionSchema,
      description: "Exactly 5 multiple-choice questions (id 1 to 5).",
    },
    commentTemplate: {
      type: Type.STRING,
      description:
        "Reader response comment containing exact placeholders {{6}}, {{7}}, {{8}}, {{9}}, {{10}}.",
    },
    commentBlanks: {
      type: Type.ARRAY,
      items: blankItemSchema,
      description: "Exactly 5 inline blank items (id 6 to 10).",
    },
  },
  required: [
    "title",
    "author",
    "articleBody",
    "comprehensionQuestions",
    "commentTemplate",
    "commentBlanks",
  ],
};

const PART3_ARCHETYPES = [
  {
    name: "Canadian Flora, Fauna & Natural Phenomena",
    guide:
      "A: Taxonomy, origin, habitat/range, physical comparison. B: Anatomy, lifecycle stages, or subgroup comparisons. C: Behaviors, Indigenous folklore, & scientific theories. D: Superlative records, conservation, & ongoing research.",
  },
  {
    name: "Canadian History, Exploration & Historical Figures",
    guide:
      "A: Era/context, background, & initial challenge. B: Turning point, expedition/invention mechanics, & milestones. C: Setbacks, controversies, or competing historical views. D: Long-term legacy & modern preservation.",
  },
  {
    name: "Applied Science, Geography & Everyday Technology",
    guide:
      "A: Overview of technology/system & Canadian context. B: Step-by-step mechanism. C: Practical limitations, climate/cost challenges, or misconceptions. D: Modern innovations & pilot studies.",
  },
  {
    name: "Culture, Social Institutions & Urban Life",
    guide:
      "A: Cultural/regional roots & core purpose. B: Distinctive rules, processes, or regional variations. C: Debates, shifting demographics, or logistical hurdles. D: Contemporary adaptations & studies.",
  },
];

export async function POST(req: Request) {
  try {
    const { part, topic = "", previousTopics = [] } = await req.json();

    if (part === 1) {
      const prompt = `
        You are an official CELPIP psychometric test developer targeting CLB 10–12.
        Generate CELPIP Reading Part 1: Reading Correspondence (11 questions total).
        - Write a 280–340 word semi-formal or personal Canadian email/letter (e.g., neighborhood committee, workplace event planning, volunteer organization, tenant-landlord update, or alumni reunion) with rich subtext, tone shifts, and implicit motives.
        - Create 6 multiple-choice comprehension questions (id 1..6) testing inference, tone/attitude, implicit cause-effect, and paraphrased details (avoid verbatim keyword matching).
        - Create a 130–160 word reply email containing exact placeholders {{7}}, {{8}}, {{9}}, {{10}}, {{11}} and 5 corresponding 4-option dropdown items (id 7..11) that require understanding both the original email and the reply's tone.
        ${topic ? `Theme hint: ${topic}` : ""}
      `;
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: part1Schema,
          temperature: 0.85,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return NextResponse.json(JSON.parse(res.text!));
    }

    if (part === 2) {
      const prompt = `
        You are an official CELPIP psychometric test developer targeting CLB 10–12.
        Generate CELPIP Reading Part 2: Reading to Apply a Diagram (8 questions total).
        - Create a realistic Canadian comparison diagram/schedule/brochure table (e.g., municipal transit passes, community workshop tiers, regional park camping permits, co-working memberships, or continuing education courses) with 4–5 columns, 4–5 rows, and a critical policy footnote with exceptions/conditions.
        - Create a 140–170 word email between two colleagues/friends discussing choices based on constraints, containing exact placeholders {{1}}, {{2}}, {{3}}, {{4}}, {{5}} and 5 corresponding 4-option dropdown items (id 1..5).
        - Create 3 multiple-choice comprehension/inference questions (id 6, 7, 8) testing synthesis between the email's constraints and the diagram's fine print.
        ${topic ? `Theme hint: ${topic}` : ""}
      `;
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: part2Schema,
          temperature: 0.85,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return NextResponse.json(JSON.parse(res.text!));
    }

    if (part === 3) {
      const arch =
        PART3_ARCHETYPES[Math.floor(Math.random() * PART3_ARCHETYPES.length)];
      const prompt = `
        You are an official CELPIP psychometric test developer targeting CLB 10–12.
        Generate CELPIP Reading Part 3: Reading for Information (9 questions total).
        - Write a 480–540 word passage across Paragraphs A, B, C, D (~120–135 words each) in clear Grade 10–12 Canadian Encyclopedia prose (concrete facts, numbers, clear syntax—NO dense academic jargon).
        - Archetype: "${arch.name}" (${arch.guide}).
        - Generate 9 SHUFFLED statements (id 1..9) matching A, B, C, D, or E (Not Given):
          * 3 Conceptual Paraphrase items
          * 3 Intra-Paragraph Synthesis items
          * 1 Cross-Paragraph Keyword Bait item
          * 2 Adjacent-Concept Option E (Not Given) items combining real passage entities with unstated claims.
        - Avoid previous topics: ${previousTopics.join(", ")}.
        ${topic ? `Specific topic: ${topic}` : ""}
      `;
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: part3Schema,
          temperature: 0.85,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return NextResponse.json(JSON.parse(res.text!));
    }

    if (part === 4) {
      const prompt = `
        You are an official CELPIP psychometric test developer targeting CLB 10–12.
        Generate CELPIP Reading Part 4: Reading for Viewpoints (10 questions total).
        - Write a 460–520 word Canadian news/editorial article on a debated community, urban, workplace, or environmental issue (e.g., 4-day workweek trials, congestion pricing, urban densification, AI in public schools, or municipal waste fees). Include at least two named stakeholders/experts with contrasting viewpoints and nuanced arguments.
        - Create 5 multiple-choice comprehension questions (id 1..5) testing speaker attribution, implicit bias, rhetorical tone, and opposing arguments.
        - Create a 140–170 word reader comment responding to the article with exact placeholders {{6}}, {{7}}, {{8}}, {{9}}, {{10}} and 5 corresponding 4-option dropdown items (id 6..10) requiring deep vocabulary and stance alignment.
        ${topic ? `Theme hint: ${topic}` : ""}
      `;
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: part4Schema,
          temperature: 0.85,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return NextResponse.json(JSON.parse(res.text!));
    }

    return NextResponse.json({ error: "Invalid part number" }, { status: 400 });
  } catch (error: any) {
    console.error("Part generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate part" },
      { status: 500 }
    );
  }
}
