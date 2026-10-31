import "server-only";

import { GoogleGenAI } from "@google/genai";

export type ChatTurn = {
  role: "user" | "model";
  text: string;
};

function requiredEnv(name: "GEMINI_API_KEY" | "AI_MODEL") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export function getAiModel() {
  return requiredEnv("AI_MODEL");
}

function getClient() {
  return new GoogleGenAI({ apiKey: requiredEnv("GEMINI_API_KEY") });
}

function isRetryable(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = Number(error.status);
  return status === 429 || status === 500 || status === 502 || status === 503;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateChatReply(turns: ChatTurn[]) {
  const contents = turns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await getClient().models.generateContent({
        model: getAiModel(),
        contents,
      });
      const text = response.text?.trim();
      if (!text) {
        throw new Error("Le modèle n'a renvoyé aucun texte.");
      }
      return text;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 2) break;
      await wait(1000 * (attempt + 1));
    }
  }

  throw lastError;
}
