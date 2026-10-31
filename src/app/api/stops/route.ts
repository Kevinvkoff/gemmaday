import { connection } from "next/server";
import { editorTokenMatches } from "@/lib/editor-auth";
import { readStops, writeStops } from "@/lib/stops";

function unauthorized() {
  return Response.json({ error: "Lien invalide." }, { status: 401 });
}

export async function GET(request: Request) {
  await connection();
  if (!editorTokenMatches(request.headers.get("x-editor-token"))) return unauthorized();
  return Response.json({ stops: readStops() });
}

export async function PUT(request: Request) {
  await connection();
  if (!editorTokenMatches(request.headers.get("x-editor-token"))) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const stops = (body as { stops?: unknown }).stops;
  if (!Array.isArray(stops)) {
    return Response.json({ error: "La liste d’arrêts est manquante." }, { status: 400 });
  }

  try {
    writeStops(stops);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enregistrement impossible.";
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ stops: readStops() });
}
