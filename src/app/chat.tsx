"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { TaxiStop } from "@/data/taxi-stops";
import type { LocationState, MapPoint } from "./route-map";
import { MessageContent } from "./message-content";

const StopPanel = dynamic(() => import("./route-map").then((mod) => mod.StopPanel), {
  ssr: false,
  loading: () => <p className="mt-4 text-sm text-zinc-500">Chargement de la carte…</p>,
});

type Message = {
  role: "user" | "model";
  text: string;
  stop?: TaxiStop | null;
};

const suggestions = [
  "Je veux aller au marché Kenya",
  "Comment aller à l’université ?",
  "Je dois aller à l’aéroport",
  "Où prendre un taxi pour l’hôpital Sendwe ?",
];

const STORAGE_KEY = "gemmaday-chat";

function isStop(value: unknown): value is TaxiStop {
  if (!value || typeof value !== "object") return false;
  const stop = value as TaxiStop;
  return (
    typeof stop.id === "string" &&
    typeof stop.name === "string" &&
    typeof stop.address === "string" &&
    typeof stop.lat === "number" &&
    typeof stop.lng === "number" &&
    typeof stop.serves === "string"
  );
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const message = value as Message;
  return (
    (message.role === "user" || message.role === "model") &&
    typeof message.text === "string" &&
    (message.stop == null || isStop(message.stop))
  );
}

function readStoredMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isMessage)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stored, setStored] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(readStoredMessages());
    setStored(true);
  }, []);

  useEffect(() => {
    if (!stored) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, stored]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function locate() {
    if (locationState === "ready" || locationState === "locating") return;
    if (!navigator.geolocation) {
      setLocationState("unsupported");
      return;
    }
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationState("ready");
      },
      () => setLocationState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const nextMessages: Message[] = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setPending(true);
    locate();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, text: turnText }) => ({ role, text: turnText })),
        }),
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
        stop?: TaxiStop | null;
      };
      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "La réponse du modèle est vide.");
      }
      setMessages((current) => [
        ...current,
        { role: "model", text: data.text!, stop: data.stop ?? null },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendText(draft);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pt-6 sm:px-6">
      <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight">Où veux-tu aller ?</h1>
      </header>

      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-end gap-4">
            <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              Tu viens d’arriver et la ville ne t’est pas familière. Dis à Gemma où tu dois te
              rendre. Elle t’indique l’arrêt de taxi, son adresse, et le chemin depuis là où tu es.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendText(suggestion)}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) =>
            message.role === "user" ? (
              <article
                key={`${message.role}-${index}`}
                className="ml-auto max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-3 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <p className="mb-1 text-xs tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                  Toi
                </p>
                <p className="whitespace-pre-wrap leading-7">{message.text}</p>
              </article>
            ) : (
              <article key={`${message.role}-${index}`} className="w-full">
                <p className="mb-2 text-xs tracking-wide text-zinc-500 uppercase">Gemma</p>
                <MessageContent text={message.text} />
                {message.stop ? (
                  <StopPanel stop={message.stop} origin={origin} locationState={locationState} />
                ) : null}
              </article>
            ),
          )
        )}
        {pending ? <p className="text-sm text-zinc-500">Gemma cherche l’arrêt…</p> : null}
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={sendMessage}
        className="flex shrink-0 gap-2 border-t border-zinc-200 bg-white py-3 dark:border-zinc-800 dark:bg-black"
      >
        <label className="sr-only" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          placeholder="Je veux aller au marché Kenya…"
          className="min-h-14 flex-1 resize-none rounded-2xl border border-zinc-200 bg-transparent px-4 py-3 outline-none focus:border-zinc-400 dark:border-zinc-800"
        />
        <button
          type="submit"
          disabled={pending || draft.trim().length === 0}
          className="h-14 rounded-2xl bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
