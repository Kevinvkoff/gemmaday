import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { editorTokenMatches } from "@/lib/editor-auth";
import { StopEditor } from "./editor-loader";

export const metadata: Metadata = {
  title: "Arrêts",
  robots: { index: false, follow: false },
};

export default function StopSettingsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Chargement de la carte…</p>}>
      <EditorGate params={params} />
    </Suspense>
  );
}

async function EditorGate({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  if (!editorTokenMatches(token)) notFound();
  return <StopEditor token={token} />;
}
