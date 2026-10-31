"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageContent } from "./message-content";

type Message = {
  role: "user" | "model";
  text: string;
};

export function Chat({ model }: { model: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    const nextMessages: Message[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "La réponse du modèle est vide.");
      }
      setMessages((current) => [...current, { role: "model", text: data.text! }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pt-6 sm:px-6">
      <header className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <p className="text-sm tracking-wide text-zinc-500 uppercase">gemmaday</p>
          <h1 className="text-2xl font-semibold tracking-tight">Discuter avec Gemma</h1>
        </div>
        <p className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs whitespace-nowrap text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {model}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <p className="text-zinc-500">
            Écris un message pour tester la clé Gemini et le modèle configurés dans{" "}
            <code className="font-mono text-sm">.env</code>.
          </p>
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
              </article>
            ),
          )
        )}
        {pending ? <p className="text-sm text-zinc-500">Gemma écrit…</p> : null}
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      <form onSubmit={sendMessage} className="flex shrink-0 gap-2 border-t border-zinc-200 bg-white py-3 dark:border-zinc-800 dark:bg-black">
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
          placeholder="Écris un message…"
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
