import "server-only";

import { timingSafeEqual } from "node:crypto";

export function editorTokenMatches(token: string | null | undefined) {
  const expected = process.env.STOPS_EDITOR_TOKEN?.trim() ?? "";
  const given = token?.trim() ?? "";
  if (!expected || !given) return false;
  const provided = Buffer.from(given);
  const secret = Buffer.from(expected);
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(provided, secret);
}
