import "server-only";

import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { findTaxiStop, taxiStopCatalog, type TaxiStop } from "@/data/taxi-stops";

export type ChatTurn = {
  role: "user" | "model";
  text: string;
};

export type Guidance = {
  reply: string;
  stop: TaxiStop | null;
};

const guidanceSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: "Réponse en français, deux à quatre phrases.",
    },
    stopId: {
      type: Type.STRING,
      nullable: true,
      description: "Identifiant d’un arrêt de la liste, ou null.",
    },
  },
  required: ["reply", "stopId"],
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

function systemInstruction() {
  return `Tu aides une personne qui vient d'arriver à Lubumbashi et ne connaît pas la ville.
Elle cherche l'arrêt de taxi où monter pour aller quelque part.

Règle de choix :
- Si elle ne dit pas être déjà dans une commune, propose la Poste (id poste). C'est de là que partent les taxis du centre vers les quartiers, l'université, l'aéroport et l'hôpital.
- Propose l'arrêt du quartier seulement si elle dit s'y trouver déjà, ou si elle demande explicitement l'arrêt de ce quartier.
- Si la destination n'est pas claire, pose une question et mets stopId à null.
- N'invente aucun arrêt en dehors de la liste.

Réponds uniquement en JSON : {"reply":"texte français","stopId":"id ou null"}.
Dans reply, donne le nom de l'arrêt, son adresse, et la direction desservie. Deux à quatre phrases. Pas de coordonnées.

Arrêts :
${taxiStopCatalog()}`;
}

function isRetryable(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = Number(error.status);
  return status === 429 || status === 500 || status === 502 || status === 503;
}

function isBadRequest(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && Number(error.status) === 400);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGuidance(raw: string): { reply: string; stopId: string | null } {
  const fenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const candidates = [fenced];
  const embedded = fenced.match(/\{[\s\S]*\}/);
  if (embedded) candidates.push(embedded[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { reply?: unknown; stopId?: unknown };
      if (typeof parsed.reply !== "string" || parsed.reply.trim().length === 0) continue;
      const stopId =
        typeof parsed.stopId === "string" && parsed.stopId.trim() && parsed.stopId.trim() !== "null"
          ? parsed.stopId.trim()
          : null;
      return { reply: parsed.reply.trim(), stopId };
    } catch {
      // Try the next candidate.
    }
  }

  return { reply: raw.trim(), stopId: null };
}

async function requestGuidance(turns: ChatTurn[], jsonMode: boolean) {
  return getClient().models.generateContent({
    model: getAiModel(),
    contents: turns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    config: {
      systemInstruction: systemInstruction(),
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      ...(jsonMode
        ? { responseMimeType: "application/json", responseSchema: guidanceSchema }
        : {}),
    },
  });
}

export async function generateGuidance(turns: ChatTurn[]): Promise<Guidance> {
  let jsonMode = true;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await requestGuidance(turns, jsonMode);
      const text = response.text?.trim();
      if (!text) throw new Error("Le modèle n'a renvoyé aucun texte.");
      const parsed = parseGuidance(text);
      return { reply: parsed.reply, stop: findTaxiStop(parsed.stopId) };
    } catch (error) {
      if (jsonMode && isBadRequest(error)) {
        jsonMode = false;
        continue;
      }
      lastError = error;
      if (!isRetryable(error) || attempt === 2) break;
      await wait(1000 * (attempt + 1));
    }
  }

  throw lastError;
}
