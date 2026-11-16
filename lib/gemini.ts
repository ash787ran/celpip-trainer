import { GoogleGenAI, Schema } from "@google/genai";

const ai = new GoogleGenAI();
const MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

export async function generateWithFallback(prompt: string, schema: Schema) {
  let lastError: any;
  for (const model of MODELS) {
    try {
      const config: any = {
        responseMimeType: "application/json",
        responseSchema: schema,
      };
      if (model.startsWith("gemini-3")) {
        config.thinkingConfig = { thinkingLevel: "LOW" };
      } else {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });

      if (response.text) return JSON.parse(response.text);
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("404")) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
