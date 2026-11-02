"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
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

const STORAGE_KEY = "intercom-chat";

type DictationResult = {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript?: string } | undefined;
};

type DictationSession = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: { length: number; [index: number]: DictationResult | undefined } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type DictationCtor = new () => DictationSession;

function speechRecognitionCtor(): DictationCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: DictationCtor;
    webkitSpeechRecognition?: DictationCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function transcriptOf(event: { results: { length: number; [index: number]: DictationResult | undefined } }) {
  let text = "";
  for (let index = 0; index < event.results.length; index += 1) {
    text += event.results[index]?.[0]?.transcript ?? "";
  }
  const last = event.results[event.results.length - 1];
  return { text, isFinal: Boolean(last?.isFinal) };
}

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
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<DictationSession | null>(null);
  const requestSeq = useRef(0);
  const messagesRef = useRef(messages);
  const pendingRef = useRef(pending);
  const sendTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  messagesRef.current = messages;
  pendingRef.current = pending;

  useEffect(() => {
    setMessages(readStoredMessages());
    setStored(true);
    setCanDictate(speechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!stored) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, stored]);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, pending, error]);

  useEffect(() => {
    if (editingIndex === null) return;
    editInputRef.current?.focus();
  }, [editingIndex]);

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

  function stopDictation() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
  }

  function resetChat() {
    requestSeq.current += 1;
    stopDictation();
    setEditingIndex(null);
    setEditDraft("");
    setDraft("");
    setError(null);
    setPending(false);
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function requestGuidance(nextMessages: Message[]) {
    const seq = requestSeq.current;
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
      if (requestSeq.current !== seq) return;
      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "La réponse du modèle est vide.");
      }
      setMessages((current) => [
        ...current,
        { role: "model", text: data.text!, stop: data.stop ?? null },
      ]);
    } catch (caught) {
      if (requestSeq.current !== seq) return;
      setError(caught instanceof Error ? caught.message : "Envoi impossible.");
    } finally {
      if (requestSeq.current === seq) setPending(false);
    }
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;

    stopDictation();
    setEditingIndex(null);
    setEditDraft("");
    const nextMessages: Message[] = [...messagesRef.current, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setDraft("");
    await requestGuidance(nextMessages);
  }

  function startEdit(index: number) {
    if (pendingRef.current) return;
    const message = messagesRef.current[index];
    if (!message || message.role !== "user") return;
    stopDictation();
    setEditingIndex(index);
    setEditDraft(message.text);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditDraft("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingIndex === null || pendingRef.current) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    const nextMessages = messagesRef.current.slice(0, editingIndex);
    nextMessages.push({ role: "user", text: trimmed });
    setEditingIndex(null);
    setEditDraft("");
    setMessages(nextMessages);
    await requestGuidance(nextMessages);
  }

  sendTextRef.current = sendText;

  async function retryLast() {
    if (pendingRef.current) return;
    const current = messagesRef.current;
    if (current.at(-1)?.role !== "user") return;
    await requestGuidance(current);
  }

  function toggleDictation() {
    if (listening) {
      stopDictation();
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setError("La dictée vocale n’est pas disponible dans ce navigateur.");
      return;
    }
    if (pendingRef.current) return;

    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;
    let sent = false;
    recognition.onresult = (event) => {
      const { text, isFinal } = transcriptOf(event);
      setDraft(text);
      const trimmed = text.trim();
      if (!isFinal || !trimmed || sent) return;
      sent = true;
      void sendTextRef.current(trimmed);
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech") {
        setError("Je n’ai rien entendu. Réessaie en parlant plus près du micro.");
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Le micro est bloqué. Autorise-le pour dicter ta question.");
        return;
      }
      setError("La dictée a échoué. Réessaie ou écris ta question.");
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const canRetry = Boolean(error) && messages.at(-1)?.role === "user";

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendText(draft);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight">Où veux-tu aller ?</h1>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={resetChat}
            className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Recommencer
          </button>
        ) : null}
      </header>

      <div ref={threadRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-auto flex flex-col gap-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
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
              <div key={`${message.role}-${index}`} className="ml-auto flex w-full max-w-[85%] items-end justify-end gap-2">
                {editingIndex === index ? null : (
                  <button
                    type="button"
                    onClick={() => startEdit(index)}
                    disabled={pending}
                    aria-label="Modifier ce message"
                    title="Modifier"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <PencilIcon />
                  </button>
                )}
                <article
                  className={`rounded-2xl bg-zinc-900 px-4 py-3 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 ${
                    editingIndex === index ? "w-full" : ""
                  }`}
                >
                  {editingIndex === index ? (
                    <form onSubmit={(event) => void submitEdit(event)}>
                      <label className="sr-only" htmlFor={`edit-${index}`}>
                        Modifier le message
                      </label>
                      <textarea
                        id={`edit-${index}`}
                        ref={editInputRef}
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelEdit();
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        rows={2}
                        className="w-full resize-none bg-transparent leading-7 outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={cancelEdit} className="rounded-full px-3 py-1 text-xs">
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={pending || editDraft.trim().length === 0}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-900 disabled:opacity-40 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          Envoyer
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="whitespace-pre-wrap leading-7">{message.text}</p>
                  )}
                </article>
              </div>
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
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
            {canRetry ? (
              <button
                type="button"
                onClick={() => void retryLast()}
                disabled={pending}
                aria-label="Réessayer la dernière question"
                title="Réessayer"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <RetryIcon />
              </button>
            ) : null}
          </div>
        ) : null}
        </div>
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
          type="button"
          onClick={toggleDictation}
          disabled={pending || !canDictate}
          aria-pressed={listening}
          aria-label={listening ? "Arrêter la dictée" : "Dicter la question"}
          title={
            canDictate
              ? listening
                ? "Arrêter la dictée"
                : "Dicter la question"
              : "La dictée vocale n’est pas disponible dans ce navigateur"
          }
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border disabled:opacity-40 ${
            listening
              ? "border-red-600 bg-red-600 text-white"
              : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          }`}
        >
          {listening ? <StopIcon /> : <MicIcon />}
        </button>
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

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" strokeLinejoin="round" />
      <path d="M6 11a6 6 0 0 0 12 0" strokeLinecap="round" />
      <path d="M12 17v4M8 21h8" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h4l10.5-10.5-4-4L4 16v4Z" strokeLinejoin="round" />
      <path d="M12.5 7.5l4 4" strokeLinecap="round" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" strokeLinecap="round" />
      <path d="M20 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
