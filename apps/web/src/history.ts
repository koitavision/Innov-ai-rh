/**
 * The conversation history: each chat is stored in the browser's localStorage, so past
 * conversations survive reloads and visits — the assistant's memory of a user's questions
 * lives on their device, never on a server.
 */

import { createIsomorphicFn } from "@tanstack/react-start";

export interface Citation {
  file: string;
  title: string;
  articles: string;
  source_url: string;
  score: number;
}

/** A web source the assistant consulted in "veille web" mode, kept apart from legal citations. */
export interface WebSource {
  title: string;
  url: string;
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  web_sources?: WebSource[];
  at: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
}

const STORAGE_KEY = "innov-rh-mali:conversations";
const MAX_CONVERSATIONS = 50;

const canUseStorage = (): boolean =>
  typeof window !== "undefined" && window.localStorage !== undefined;

/** Storage is the browser's only: on the server there is no history to read. */
export const loadConversations = createIsomorphicFn()
  .server((): Conversation[] => [])
  .client((): Conversation[] => {
    if (!canUseStorage()) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
    } catch {
      return [];
    }
  });

export const saveConversations = (conversations: Conversation[]): void => {
  if (!canUseStorage()) return;
  try {
    const trimmed = [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // A full or blocked localStorage just means no history is kept.
  }
};

export const newConversation = (): Conversation => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
});

/** A conversation's display title: its first user question, truncated. */
export const titleFromQuestion = (question: string): string => {
  const text = question.trim().replace(/\s+/g, " ");
  return text.length > 52 ? `${text.slice(0, 52)}…` : text;
};

export const relativeDate = (timestamp: number): string => {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(timestamp).toLocaleDateString("fr-FR");
};
