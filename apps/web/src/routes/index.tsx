import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CYAN, INK, LogoMark, Wordmark } from "../brand";

/**
 * The landing page: the product's front door, with the animated brand (the ring spins, the
 * wordmark reveals itself) and a typewriter cycling example questions. It sends the reader
 * to `/chat`, which is the application itself.
 */

const EXAMPLE_QUESTIONS = [
  "Quelle est la durée légale du travail au Mali ?",
  "Comment calculer l'ITS sur un salaire de 250 000 FCFA ?",
  "Quels sont les délais de préavis de licenciement ?",
  "Un salarié étranger a-t-il besoin d'un permis de travail ?",
  "Comment est calculée l'indemnité de licenciement ?",
];

const FEATURES = [
  {
    icon: "📚",
    title: "Corpus juridique officiel",
    text: "Code du travail, Code de prévoyance sociale, décrets, arrêtés et barèmes DGI/INPS — les textes qui font foi.",
  },
  {
    icon: "🌍",
    title: "Veille web optionnelle",
    text: "Un clic, et l'assistante cherche aussi sur le web les nouveautés récentes — sources affichées à part.",
  },
  {
    icon: "🎙️",
    title: "Parlez, écoutez",
    text: "Dictez vos questions et faites lire les réponses à voix haute, directement dans le navigateur.",
  },
  {
    icon: "🧠",
    title: "Mémoire sur votre appareil",
    text: "Vos conversations restent enregistrées chez vous, jamais sur un serveur tiers. Aucun compte requis.",
  },
];

const STATS = [
  { value: "119", label: "extraits de textes officiels" },
  { value: "40 h", label: "durée légale hebdomadaire — art. 131" },
  { value: "SMIG", label: "40 000 FCFA/mois — décret 2015-0363" },
  { value: "48 h", label: "durée légale agricole — art. 138" },
];

/** Types the example questions one character at a time, then moves to the next. */
const Typewriter = () => {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [length, setLength] = useState(0);

  useEffect(() => {
    const question = EXAMPLE_QUESTIONS[questionIndex];
    if (length < question.length) {
      const timer = window.setTimeout(() => setLength(length + 1), 34);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setQuestionIndex((questionIndex + 1) % EXAMPLE_QUESTIONS.length);
      setLength(0);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [length, questionIndex]);

  const question = EXAMPLE_QUESTIONS[questionIndex];
  return (
    <span>
      {question.slice(0, length)}
      <span className="caret-blink ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.2em] bg-brand" />
    </span>
  );
};

const Home = () => (
  <div className="min-h-full overflow-hidden bg-gradient-to-b from-cyan-50/50 via-white to-white">
    {/* Animated background blobs, behind the content. */}
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        className="blob-drift absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand/15 blur-3xl"
      />
      <div
        className="blob-drift-slow absolute top-40 -right-28 h-[28rem] w-[28rem] rounded-full bg-ink/10 blur-3xl"
      />
      <div
        className="blob-drift absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        style={{ animationDelay: "-7s" }}
      />
    </div>

    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <span className="flex items-center gap-2.5">
        <LogoMark size={34} spin />
        <Wordmark className="text-[16px]" />
      </span>
      <Link
        to="/chat"
        className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md active:translate-y-0"
      >
        Ouvrir l'assistant
      </Link>
    </header>

    <main className="mx-auto max-w-6xl px-5 sm:px-8">
      <section className="flex flex-col items-center pb-14 pt-10 text-center sm:pt-14">
        {/* The brand, animated: the ring spins while the wordmark reveals itself. */}
        <div className="animate-fade-in-up flex items-center gap-4">
          <LogoMark size={72} spin className="drop-shadow-md" />
          <Wordmark reveal className="text-4xl sm:text-5xl" />
        </div>

        <div className="animate-fade-in-up mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-cyan-700 shadow-sm backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Propulsée par Mistral AI · RAG sur les textes officiels du Mali
        </div>

        <h1 className="animate-fade-in-up mt-6 max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight text-neutral-900 sm:text-5xl">
          <span className="text-shimmer">L'expertise RH</span> du droit du travail malien,
          <br className="hidden sm:block" /> à votre écoute
        </h1>
        <p
          className="animate-fade-in-up mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-600 sm:text-base"
          style={{ animationDelay: "0.15s" }}
        >
          Contrats, licenciement, durée du travail, congés, paie (SMIG, ITS, cotisations
          INPS/AMO/ANPE), sécurité sociale et travailleurs étrangers — chaque réponse cite les
          articles des textes officiels.
        </p>

        {/* A fake chat input with a typewriter cycling example questions. */}
        <div
          className="animate-fade-in-up mt-8 w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-lg shadow-ink/5"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-[15px] text-neutral-700">
            <span className="text-brand">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2.5 9.5 6l3.5 1.5L9.5 9 8 12.5 6.5 9 3 7.5 6.5 6 8 2.5Z" fill="currentColor" />
              </svg>
            </span>
            <Typewriter />
          </div>
        </div>

        <div
          className="animate-fade-in-up mt-6 flex flex-col items-center gap-3 sm:flex-row"
          style={{ animationDelay: "0.35s" }}
        >
          <Link
            to="/chat"
            className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-ink to-[#26335c] px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-ink/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:brightness-125 active:translate-y-0"
          >
            <LogoMark size={20} spin />
            Discuter avec l'assistante
          </Link>
          <a
            href="https://sgg-mali.ml"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl px-5 py-3.5 text-[15px] font-medium text-neutral-600 transition-colors hover:text-ink"
          >
            Consulter le Journal officiel ↗
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 pb-14 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => (
          <div
            key={feature.title}
            style={{ animationDelay: `${0.45 + index * 80}ms` }}
            className="animate-fade-in-up group rounded-2xl border border-neutral-200/80 bg-white/80 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-50 to-ink/5 text-lg shadow-inner">
              {feature.icon}
            </span>
            <h2 className="mt-3.5 text-[15px] font-semibold text-neutral-900">{feature.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{feature.text}</p>
          </div>
        ))}
      </section>

      <section
        className="animate-fade-in-up mb-14 grid grid-cols-2 gap-3 rounded-3xl border border-neutral-200/80 bg-white/70 p-6 shadow-sm backdrop-blur sm:grid-cols-4 sm:p-8"
        style={{ animationDelay: "0.8s" }}
      >
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className="bg-gradient-to-r from-ink to-brand bg-clip-text text-2xl font-semibold tracking-tight text-transparent"
              style={{ backgroundImage: `linear-gradient(100deg, ${INK}, ${CYAN})` }}
            >
              {stat.value}
            </div>
            <div className="mt-1 text-[11.5px] leading-snug text-neutral-500">{stat.label}</div>
          </div>
        ))}
      </section>
    </main>

    <footer className="border-t border-neutral-200/70 bg-white/60 py-6 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <p className="text-[11.5px] leading-relaxed text-neutral-400">
          Information à titre indicatif — ce n'est pas un conseil juridique. Vérifiez les textes au
          Journal officiel du Mali (sgg-mali.ml).
        </p>
        <p className="mt-2 text-[11px] font-medium text-neutral-400">
          © {new Date().getFullYear()} INNOVTECH — INNOV-AI-RH
        </p>
      </div>
    </footer>
  </div>
);

export const Route = createFileRoute("/")({
  staticData: { landing: false },
  component: Home,
});
