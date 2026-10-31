"use client";

import dynamic from "next/dynamic";

export const StopEditor = dynamic(
  () => import("./stop-editor").then((mod) => mod.StopEditor),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm text-zinc-500">Chargement de la carte…</p>,
  },
);
