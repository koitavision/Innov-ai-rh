import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Logo, LogoMark } from "../brand";
import {
  type Conversation,
  type Citation,
  type StoredMessage,
  type WebSource,
  loadConversations,
  saveConversations,
  newConversation,
  titleFromQuestion,
  relativeDate,
} from "../history";
import { Markdown } from "../markdown";
import { useAppName } from "../app-name";

interface ChatResponse {
  answer: string;
  citations: Citation[];
  web_sources: WebSource[];
  model: string;
}

const SUGGESTIONS = [
  {
    icon: "⏱️",
    text: "Quelle est la durée légale du travail et les majorations d'heures supplémentaires ?",
  },
  {
    icon: "📄",
    text: "Quels sont les délais de préavis et comment calculer l'indemnité de licenciement ?",
  },
  {
    icon: "💰",
    text: "Quel est le SMIG et quelles cotisations sociales paie l'employeur ?",
  },
  {
    icon: "🌍",
    text: "Faut-il un permis de travail pour embaucher un salarié étranger ?",
  },
  {
    icon: "🤰",
    text: "Quels sont les droits en congé de maternité et congés payés ?",
  },
  {
    icon: "⚖️",
    text: "Quelle est la procédure d'un licenciement pour motif économique ?",
  },
];

/* Minimal Web Speech API surface: the browser dictates into the input (Chrome/Edge). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
};

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 13V3.5M4 7 8 3l4 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M2 3.5h10M5.5 3V1.5h3V3M3 3.5l.6 9h6.8l.6-9"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MicIcon = () => (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <rect x="6" y="1.5" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3.5 8.5a5 5 0 0 0 10 0M8.5 13.5V16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const GlobeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
    <ellipse cx="8" cy="8" rx="2.7" ry="6.3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M1.8 8h12.4M2.6 5h10.8M2.6 11h10.8" stroke="currentColor" strokeWidth="1.1" />
  </svg>
);

const SpeakerIcon = ({ off = false }: { off?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M2.5 6.2v3.6h2.4L8.3 12V4L4.9 6.2H2.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    {!off ? (
      <path d="M10.5 5.5a3.6 3.6 0 0 1 0 5M12.3 3.8a6 6 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    ) : (
      <path d="M10.3 6.2l3.5 3.5M13.8 6.2l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    )}
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 3.5v-.2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const RegenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 2.5v8m0 0L4.8 7.3M8 10.5l3.2-3.2M3 13.5h10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TypingIndicator = ({ web }: { web: boolean }) => (
  <div className="flex items-center gap-2 text-sm text-neutral-500">
    <span className="flex gap-1">
      <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-brand" />
      <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-brand" />
      <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-brand" />
    </span>
    {web ? "Veille web et analyse du corpus…" : "Analyse du corpus juridique…"}
  </div>
);

interface MessageActions {
  onSpeak: (message: StoredMessage) => void;
  speaking: boolean;
  onCopy: (message: StoredMessage) => void;
  onRegenerate: () => void;
  canRegenerate: boolean;
}

/** One assistant or user message, with its legal citations and web veille sources. */
const MessageBubble = ({ message, actions }: { message: StoredMessage } & { actions: MessageActions }) =>
  message.role === "user" ? (
    <div className="animate-fade-in-up group flex items-end justify-end gap-2">
      <button
        type="button"
        onClick={() => actions.onCopy(message)}
        className="mb-1 rounded-lg p-1.5 text-neutral-300 opacity-0 transition-all hover:bg-neutral-100 hover:text-neutral-600 group-hover:opacity-100"
        aria-label="Copier le message"
      >
        <CopyIcon />
      </button>
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-sm">
        {message.content}
      </div>
    </div>
  ) : (
    <div className="animate-fade-in-up flex gap-3">
      <div className="mt-0.5 shrink-0">
        <LogoMark size={30} spin className="drop-shadow-sm" />
      </div>
      <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-neutral-200/80 bg-white px-4 py-3 shadow-sm">
        <Markdown content={message.content} />
        <div className="mt-2.5 flex items-center gap-1 border-t border-neutral-100 pt-2">
          <button
            type="button"
            onClick={() => actions.onSpeak(message)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label={actions.speaking ? "Arrêter la lecture" : "Écouter la réponse"}
          >
            <SpeakerIcon off={actions.speaking} />
            {actions.speaking ? "Arrêter" : "Écouter"}
          </button>
          <button
            type="button"
            onClick={() => actions.onCopy(message)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Copier la réponse"
          >
            <CopyIcon />
            Copier
          </button>
          {actions.canRegenerate && (
            <button
              type="button"
              onClick={actions.onRegenerate}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Régénérer la réponse"
            >
              <RegenIcon />
              Régénérer
            </button>
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.citations.map((citation, index) => (
              <a
                key={`${message.at}-${citation.file}-${index}`}
                href={citation.source_url}
                target="_blank"
                rel="noreferrer"
                title={citation.source_url}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11.5px] font-medium text-neutral-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path
                    d="M6 1.5 7.4 4.1l2.9.4-2.1 2 .5 2.9L6 7.9l-2.7 1.5.5-2.9-2.1-2 2.9-.4Z"
                    fill="currentColor"
                  />
                </svg>
                {citation.title.length > 42 ? `${citation.title.slice(0, 42)}…` : citation.title}
                {citation.articles && <span className="text-cyan-700/80">· {citation.articles}</span>}
              </a>
            ))}
          </div>
        )}
        {message.web_sources && message.web_sources.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.web_sources.map((source, index) => (
              <a
                key={`${message.at}-web-${index}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                title={source.url}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
              >
                <GlobeIcon size={11} />
                {source.title.length > 42 ? `${source.title.slice(0, 42)}…` : source.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

/** A small toast at the bottom of the screen, for "copied", "exported" and friends. */
const Toast = ({ message }: { message: string }) => (
  <div className="toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg">
    {message}
  </div>
);

/** Downloads the active conversation as a Markdown file. */
const exportConversation = (conversation: Conversation) => {
  const lines = [
    `# ${conversation.title || "Conversation"} — INNOV-AI-RH`,
    "",
    `Exportée le ${new Date(conversation.updatedAt).toLocaleString("fr-FR")}.`,
    "",
    ...conversation.messages.flatMap((message) => [
      message.role === "user" ? `## Vous` : `## Assistante`,
      "",
      message.content,
      "",
      ...(message.citations ?? []).map(
        (citation) => `- [${citation.title}${citation.articles ? ` (${citation.articles})` : ""}](${citation.source_url})`
      ),
      ...(message.web_sources ?? []).map((source) => `- 🌐 [${source.title}](${source.url})`),
      "",
    ]),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(conversation.title || "conversation").slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, "-")}.md`;
  link.click();
  URL.revokeObjectURL(url);
};

const Chat = () => {
  const appName = useAppName();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [web, setWeb] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speakingAt, setSpeakingAt] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = useRef<boolean>(false);

  useEffect(() => {
    speechSupported.current = getSpeechRecognition() !== null;
    const stored = loadConversations();
    setConversations(stored);
    setActiveId(stored[0]?.id ?? null);
    setHydrated(true);
    inputRef.current?.focus();
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // "/" focuses the input, like the pro chat apps.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Toast auto-hide.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages.length, loading]);

  const persist = useCallback((next: Conversation[]) => {
    setConversations(next);
    saveConversations(next);
  }, []);

  const startNewConversation = () => {
    setActiveId(null);
    setSidebarOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const removeConversation = (id: string) => {
    const next = conversations.filter((conversation) => conversation.id !== id);
    persist(next);
    if (activeId === id) setActiveId(null);
  };

  /** Reads an answer aloud in the browser's French voice; clicking again stops it. */
  const speak = (message: StoredMessage) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speakingAt === message.at) {
      setSpeakingAt(null);
      return;
    }
    const plain = message.content
      .replace(/[#*_`>|-]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ");
    const utterance = new SpeechSynthesisUtterance(plain.slice(0, 3500));
    utterance.lang = "fr-FR";
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.startsWith("fr"));
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeakingAt(null);
    setSpeakingAt(message.at);
    window.speechSynthesis.speak(utterance);
  };

  const copyMessage = async (message: StoredMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setToast("Réponse copiée ✓");
    } catch {
      setToast("Copie impossible dans ce navigateur");
    }
  };

  /** Dictates into the input with the browser's speech recognition, in French. */
  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;
    let base = input ? `${input.trim()} ` : "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setInput(base + transcript);
    };
    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recognition.onerror = recognition.onend;
    recognitionRef.current = recognition;
    setRecording(true);
    recognition.start();
  };

  /** Runs the API call for a conversation and stores the answer. `list` is the fresh array. */
  const ask = async (list: Conversation[], conversation: Conversation) => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/rh/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.messages.map(({ role, content }) => ({ role, content })),
          web,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
        const detail = body?.detail;
        throw new Error(typeof detail === "string" ? detail : `Erreur ${response.status}`);
      }
      const data = (await response.json()) as ChatResponse;
      const answered: Conversation = {
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            role: "assistant",
            content: data.answer,
            citations: data.citations,
            web_sources: data.web_sources,
            at: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      };
      persist(list.map((item) => (item.id === answered.id ? answered : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");

    const now = Date.now();
    // The conversation this message joins: the active one, or a new one it opens. Everything
    // below flows through `list`, the up-to-date array, so no closure can drop a message.
    let conversation = active;
    if (conversation === null) {
      conversation = { ...newConversation(), title: titleFromQuestion(text) };
    }
    const exists = conversations.some((item) => item.id === conversation.id);
    const based: Conversation[] = exists
      ? conversations.map((item) =>
          item.id === conversation.id
            ? {
                ...item,
                title: item.title === "" ? titleFromQuestion(text) : item.title,
                updatedAt: now,
              }
            : item
        )
      : [conversation, ...conversations];
    const userMessage: StoredMessage = { role: "user", content: text, at: now };
    const sent: Conversation = {
      ...(based.find((item) => item.id === conversation!.id) as Conversation),
      messages: [...conversation.messages, userMessage],
      updatedAt: now,
    };
    const list = based.map((item) => (item.id === sent.id ? sent : item));
    persist(list);
    setActiveId(sent.id);
    await ask(list, sent);
  };

  /** Drops the last answer and asks again for the same question. */
  const regenerate = () => {
    if (!active || loading) return;
    const messages = [...active.messages];
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser < 0) return;
    const trimmed: Conversation = {
      ...active,
      messages: messages.slice(0, lastUser + 1),
      updatedAt: Date.now(),
    };
    const list = conversations.map((item) => (item.id === trimmed.id ? trimmed : item));
    persist(list);
    void ask(list, trimmed);
  };

  const sidebar = (
    <div className="flex h-full w-72 flex-col border-r border-neutral-200/70 bg-white">
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Logo size={34} spin />
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          aria-label="Fermer le menu"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={startNewConversation}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ink to-[#26335c] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-[0.98]"
        >
          <PlusIcon />
          Nouvelle conversation
        </button>
      </div>
      <nav className="thin-scrollbar mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {hydrated && conversations.length === 0 && (
          <p className="px-2 pt-4 text-xs leading-relaxed text-neutral-400">
            Vos conversations resteront enregistrées sur cet appareil.
          </p>
        )}
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors ${
              conversation.id === activeId
                ? "bg-cyan-50 text-ink"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveId(conversation.id);
                setSidebarOpen(false);
                setError(null);
              }}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <span className="w-full truncate font-medium">
                {conversation.title || "Conversation"}
              </span>
              <span
                className={`text-[11px] ${
                  conversation.id === activeId ? "text-cyan-600" : "text-neutral-400"
                }`}
              >
                {relativeDate(conversation.updatedAt)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeConversation(conversation.id)}
              className="rounded-lg p-1.5 text-neutral-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              aria-label="Supprimer la conversation"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </nav>
      <div className="border-t border-neutral-100 px-4 py-3">
        <a
          href="https://sgg-mali.ml"
          target="_blank"
          rel="noreferrer"
          className="text-[10.5px] leading-snug text-neutral-400 transition-colors hover:text-cyan-600"
        >
          Information à titre indicatif — pas un conseil juridique · Textes : sgg-mali.ml ↗
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-gradient-to-b from-neutral-50 to-white">
      <aside className="hidden lg:block">{sidebar}</aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="animate-fade-in-up absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-200/70 bg-white/70 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <MenuIcon />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-neutral-800">
              {active?.title || appName}
            </span>
            <span className="text-[11px] text-neutral-400">RH & droit du travail malien</span>
          </div>
          {active && (
            <button
              type="button"
              onClick={() => {
                exportConversation(active);
                setToast("Conversation exportée ✓");
              }}
              className="hidden items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 sm:inline-flex"
              title="Télécharger la conversation en Markdown"
            >
              <DownloadIcon />
              Exporter
            </button>
          )}
          <span className="hidden items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            mistral-large-latest
          </span>
        </header>

        <section className="thin-scrollbar flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {active === null && (
              <div className="animate-fade-in-up flex flex-col items-center pt-6 sm:pt-12">
                <LogoMark size={64} spin className="drop-shadow-md" />
                <h1 className="mt-5 text-center text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                  <span className="text-shimmer">Posez votre question</span> — RH, droit du travail
                  malien
                </h1>
                <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-neutral-500">
                  Des réponses sourcées, article par article, à partir des textes officiels.
                </p>
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion, index) => (
                    <button
                      key={suggestion.text}
                      type="button"
                      onClick={() => send(suggestion.text)}
                      style={{ animationDelay: `${index * 60}ms` }}
                      className="animate-fade-in-up group flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-[13.5px] leading-snug text-neutral-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
                    >
                      <span className="text-base">{suggestion.icon}</span>
                      <span className="flex-1">{suggestion.text}</span>
                      <span className="mt-0.5 shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-500">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {active?.messages.map((message, index) => {
              const isLast = index === active.messages.length - 1;
              return (
                <MessageBubble
                  key={`${message.at}-${index}`}
                  message={message}
                  actions={{
                    onSpeak: speak,
                    speaking: speakingAt === message.at,
                    onCopy: (m) => void copyMessage(m),
                    onRegenerate: regenerate,
                    canRegenerate: isLast && message.role === "assistant" && !loading,
                  }}
                />
              );
            })}
            {loading && (
              <div className="flex gap-3">
                <LogoMark size={30} spin className="mt-0.5 shrink-0" />
                <div className="rounded-2xl rounded-tl-md border border-neutral-200/80 bg-white px-4 py-3 shadow-sm">
                  <TypingIndicator web={web} />
                </div>
              </div>
            )}
            {error && (
              <div className="animate-fade-in-up flex justify-start">
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </section>

        <form
          className="border-t border-neutral-200/70 bg-white/70 px-4 pt-4 pb-3 backdrop-blur-md sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-neutral-300 bg-white p-2 shadow-sm transition-shadow focus-within:border-brand focus-within:shadow-md">
              {speechSupported.current && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                    recording
                      ? "animate-pulse bg-red-100 text-red-600"
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                  }`}
                  aria-label={recording ? "Arrêter la dictée" : "Dicter"}
                >
                  <MicIcon />
                </button>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Votre question sur le droit du travail au Mali…  ( / pour focus )"
                className="thin-scrollbar max-h-36 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[15px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setWeb((enabled) => !enabled)}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-medium transition-all ${
                  web
                    ? "bg-amber-100 text-amber-800"
                    : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                }`}
                title="Rechercher aussi sur le web les informations récentes"
                aria-pressed={web}
              >
                <GlobeIcon />
                <span className="hidden sm:inline">Veille</span>
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink to-[#26335c] text-white shadow-sm transition-all hover:brightness-125 active:scale-95 disabled:opacity-40"
                aria-label="Envoyer"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </form>
      </main>

      {toast && <Toast message={toast} />}
    </div>
  );
};

export const Route = createFileRoute("/chat")({
  staticData: { landing: true },
  component: Chat,
});
