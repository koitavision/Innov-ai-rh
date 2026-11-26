import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAppName } from "../app-name";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Citation {
  file: string;
  title: string;
  articles: string;
  source_url: string;
  score: number;
}

interface ChatResponse {
  answer: string;
  citations: Citation[];
  model: string;
}

const SUGGESTIONS = [
  "Quelle est la durée légale du travail au Mali et les majorations d'heures supplémentaires ?",
  "Quels sont les délais de préavis de licenciement ?",
  "Comment calcule-t-on l'indemnité de licenciement ?",
  "Quel est le SMIG au Mali et quelles sont les cotisations sociales employeur ?",
  "Comment calcule-t-on l'ITS sur un salaire ?",
  "Faut-il un permis de travail pour embaucher un salarié étranger ?",
  "Quelle est la procédure d'un licenciement pour motif économique ?",
  "Congé de maternité et congés payés : quels droits ?",
];

const DISCLAIMER =
  "Assistant juridique spécialisé en RH au Mali, fondé sur les textes officiels (Code du travail, Code de prévoyance sociale, CGI, décrets et arrêtés). Information générale, pas un conseil juridique : vérifiez toujours la version en vigueur au Journal officiel (sgg-mali.ml).";

const Chat = () => {
  const appName = useAppName();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/v1/rh/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
        const detail = body?.detail;
        throw new Error(typeof detail === "string" ? detail : `Erreur ${response.status}`);
      }
      const data = (await response.json()) as ChatResponse;
      setMessages([...next, { role: "assistant", content: data.answer }]);
      setCitations(data.citations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{appName}</h1>
        <p className="text-sm text-neutral-600">{DISCLAIMER}</p>
      </header>

      <section className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-neutral-500">Posez votre question sur le droit du travail et la paie au Mali :</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-left text-xs text-neutral-700 hover:bg-neutral-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "self-end" : "self-start max-w-[90%]"}>
            <div
              className={
                message.role === "user"
                  ? "rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white"
                  : "rounded-lg bg-neutral-100 px-3 py-2 text-sm whitespace-pre-wrap"
              }
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && <div className="self-start text-sm text-neutral-500">L’experte réfléchit…</div>}
        {error && <div className="self-start rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {citations.length > 0 && messages.some((message) => message.role === "assistant") && (
          <details className="self-start text-xs text-neutral-500">
            <summary className="cursor-pointer">Sources citées ({citations.length})</summary>
            <ul className="mt-1 list-disc pl-4">
              {citations.map((citation) => (
                <li key={citation.file}>
                  <a href={citation.source_url} target="_blank" rel="noreferrer" className="underline">
                    {citation.title}
                  </a>
                  {citation.articles ? ` — ${citation.articles}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div ref={bottomRef} />
      </section>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Votre question sur la RH au Mali…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </main>
  );
};

export const Route = createFileRoute("/chat")({
  staticData: { landing: true },
  component: Chat,
});
