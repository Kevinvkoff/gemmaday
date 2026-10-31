import { generateChatReply, type ChatTurn } from "@/lib/gemini";

const MAX_TURNS = 40;
const MAX_CHARS = 8000;

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as { role?: unknown; text?: unknown };
  return (
    (turn.role === "user" || turn.role === "model") &&
    typeof turn.text === "string"
  );
}

function redactSecrets(message: string) {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? message.replaceAll(key, "[redacted]") : message;
}

function errorMessage(error: unknown) {
  const raw = redactSecrets(
    error instanceof Error ? error.message : "La requête vers Gemini a échoué.",
  );
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") return parsed.error.message;
  } catch {
    // The SDK sometimes returns a plain string instead of JSON.
  }
  return raw;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_TURNS) {
    return Response.json(
      { error: `Envoie entre 1 et ${MAX_TURNS} messages.` },
      { status: 400 },
    );
  }

  if (!messages.every(isChatTurn)) {
    return Response.json(
      { error: "Chaque message doit avoir un rôle user ou model et un texte." },
      { status: 400 },
    );
  }

  const turns = messages.map((turn) => ({
    role: turn.role,
    text: turn.text.trim(),
  }));

  if (turns.some((turn) => turn.text.length === 0 || turn.text.length > MAX_CHARS)) {
    return Response.json(
      { error: `Chaque message doit contenir entre 1 et ${MAX_CHARS} caractères.` },
      { status: 400 },
    );
  }

  if (turns[0]?.role !== "user" || turns.at(-1)?.role !== "user") {
    return Response.json(
      { error: "La conversation doit commencer et finir par un message utilisateur." },
      { status: 400 },
    );
  }

  try {
    const text = await generateChatReply(turns);
    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 502 });
  }
}
