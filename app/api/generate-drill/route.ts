import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI();

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

const ARCHETYPES = [
  {
    name: "Canadian Flora, Fauna & Natural Phenomena",
    guide: `
      - Paragraph A: Taxonomy/classification, name origin or geography, habitat range, and physical traits.
      - Paragraph B: Distinctive anatomy, lifecycle stages, or subgroup comparisons (e.g., male vs. female, seasonal shifts).
      - Paragraph C: Diet/survival behaviors, Indigenous folklore or historical misconceptions, and scientific theories.
      - Paragraph D: Superlative records/metrics, conservation threats, and ongoing field research.
    `,
    examples: "Okanagan/Nk'Mip desert ecology, Carcross sand dunes, Boreal caribou, Bay of Fundy tides, Pacific salmon runs",
  },
  {
    name: "Canadian History, Exploration & Historical Figures",
    guide: `
      - Paragraph A: Historical era/context, background of the figure/event, and initial objective or challenge.
      - Paragraph B: Key turning point, expedition/invention mechanics, and major milestones.
      - Paragraph C: Setbacks, public controversies, or competing historical interpretations.
      - Paragraph D: Long-term national legacy, modern preservation/commemoration, and historical significance.
    `,
    examples: "The Avro Arrow program, Sir Sandford Fleming and standard time, Klondike Gold Rush logistics, Underground Railroad in Ontario",
  },
  {
    name: "Applied Science, Geography & Everyday Technology",
    guide: `
      - Paragraph A: Overview of the technology/system, why it emerged, and where it is used in Canada.
      - Paragraph B: How the underlying mechanism or process works step-by-step.
      - Paragraph C: Practical limitations, climate/cost challenges, or common public misconceptions.
      - Paragraph D: Modern innovations, pilot trials, and future applications.
    `,
    examples: "Cold-weather electric vehicle (EV) battery thermal management, Arctic ice roads, geothermal district heating, marine bioluminescence",
  },
  {
    name: "Culture, Social Institutions & Urban Life",
    guide: `
      - Paragraph A: Cultural or regional origins and core purpose of the practice/institution.
      - Paragraph B: Distinctive rules, processes, or regional variations across Canada.
      - Paragraph C: Contemporary debates, shifting demographics, or logistical hurdles.
      - Paragraph D: Modern adaptations, community initiatives, and ongoing sociological studies.
    `,
    examples: "Canadian maple syrup grading standards, urban co-op housing models, Northern winter festivals, Canadian public library evolution",
  },
];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = body.topic || "";
    const previousTopics: string[] = body.previousTopics || [];

    const selectedArchetype =
      ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];

    const systemPrompt = `
      You are an official CELPIP psychometric test developer targeting CLB 10–12.
      Generate a Reading Part 3 (Reading for Information) task modeled strictly on official CELPIP-General exams.

      PASSAGE CALIBRATION (GRADE 10–12 ENCYCLOPEDIC PROSE):
      1. Readability & Style: Write in clear, engaging, accessible general-interest prose (Canadian Encyclopedia / National Geographic style). Use concrete nouns, vivid descriptions, and real metrics (distances, years, percentages, speeds). AVOID dense academic jargon or convoluted legal/engineering syntax.
      2. Word Count: 480–540 words total across Paragraphs A, B, C, and D (~120–135 words each).
      3. Paragraph Progression:
         ${selectedArchetype.guide}

      CLB 10–12 QUESTION ENGINEERING (EXACTLY 9 ITEMS, SHUFFLED ORDER):
      4. Do NOT order questions sequentially (A -> B -> C -> D). Shuffle the 9 items naturally.
      5. Never copy verbatim phrases from the passage into the statements. Build the 9 items using this exact psychometric mix:
         - 3 "Conceptual Paraphrase" items: Translate concrete examples in the text into abstract conceptual summaries.
         - 3 "Intra-Paragraph Synthesis" items: Require combining two separate facts within the same paragraph to verify the statement.
         - 1 "Cross-Paragraph Keyword Bait" item: Include a decoy noun mentioned casually in one paragraph while the true factual proof sits in a different paragraph.
         - 2 "Adjacent-Concept Option E (Not Given)" items: Combine two real entities/themes from the passage with an unstated comparison, motive, statistic, or geographic claim that sounds plausible but is not verified anywhere in the text.
      6. Explanations: Quote the exact proof sentence(s) from the passage (or explain the exact missing link for Option E) and label the exact trapType from the 4 categories above.
    `;

    const prompt = topic
      ? `Generate an authentic CLB 10–12 CELPIP Part 3 reading drill about: ${topic}. Set archetype to "Custom Topic".`
      : `Generate an authentic CLB 10–12 CELPIP Part 3 reading drill under the archetype "${selectedArchetype.name}" (inspiration examples: ${selectedArchetype.examples}). Avoid these previously covered topics: ${previousTopics.join(", ")}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: part3Schema,
        temperature: 0.85,
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
