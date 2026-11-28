/**
 * The INNOV-AI-RH brand, drawn from the supplied logo: a navy ring with a gap at the top and
 * a cyan dot sitting in it, and the wordmark INNOV-AI-RH with "AI" in cyan. The ring can spin
 * (the dot orbits) and the wordmark can reveal itself letter by letter.
 */

import type { ComponentProps } from "react";

export const INK = "#0B1026";
export const CYAN = "#0FD1FF";

const WORD = "INNOV-AI-RH";

/** The ring + dot mark. `spin` makes the dot orbit the ring. */
export const LogoMark = ({
  size = 36,
  spin = false,
  ...rest
}: {
  size?: number;
  spin?: boolean;
} & ComponentProps<"svg">) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    {...rest}
  >
    <g className={spin ? "logo-spin" : undefined} style={spin ? { transformOrigin: "32px 32px" } : undefined}>
      {/* Ring with a gap at the top: arc from -82° to 262° around the center. */}
      <path
        d="M35.34 8.23 A24 24 0 1 1 28.66 8.23"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* The cyan dot in the gap. */}
      <circle cx="32" cy="9" r="5.4" fill={CYAN} />
    </g>
  </svg>
);

/** The wordmark INNOV-AI-RH; with `reveal`, each letter fades in one after another. */
export const Wordmark = ({
  reveal = false,
  className = "",
}: {
  reveal?: boolean;
  className?: string;
}) => (
  <span className={`select-none font-extrabold tracking-tight ${className}`} style={{ color: INK }}>
    {WORD.split("").map((letter, index) => (
      <span
        key={index}
        className={reveal ? "logo-letter" : undefined}
        style={
          reveal
            ? { animationDelay: `${0.55 + index * 0.07}s`, color: letter === "A" || letter === "I" ? CYAN : INK }
            : { color: letter === "A" || letter === "I" ? CYAN : INK }
        }
      >
        {letter === "-" ? "\u2011" : letter}
      </span>
    ))}
  </span>
);

/** The mark with its wordmark, as the sidebar and hero show it. */
export const Logo = ({
  size = 36,
  reveal = false,
  spin = false,
  compact = false,
}: {
  size?: number;
  reveal?: boolean;
  spin?: boolean;
  compact?: boolean;
}) => (
  <span className="flex items-center gap-2.5">
    <LogoMark size={size} spin={spin} />
    {!compact && (
      <span className="flex flex-col leading-none">
        <Wordmark reveal={reveal} className="text-[15px]" />
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Assistante IA · Droit du travail
        </span>
      </span>
    )}
  </span>
);
