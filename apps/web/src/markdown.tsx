/**
 * Markdown rendering for the assistant's answers: the model replies with headers, lists,
 * tables and bold key figures, so the prose keeps that structure instead of the raw text
 * the first interface showed.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Markdown = ({ content }: { content: string }) => (
  <div className="text-[15px] leading-relaxed text-neutral-800">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 text-[15px] font-semibold text-neutral-900 first:mt-0">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="mb-1.5 mt-3 text-[14px] font-semibold text-neutral-900 first:mt-0">{children}</h4>
        ),
        ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1.5">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full border-collapse text-[13.5px] [&_td]:border-t [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-2 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold">
              {children}
            </table>
          </div>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-emerald-500 pl-3 text-neutral-600 italic">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[13px] text-neutral-800">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
