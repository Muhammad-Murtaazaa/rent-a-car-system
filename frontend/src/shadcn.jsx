import React, { useRef } from "react";
import { X } from "lucide-react";

/**
 * Shared UI — shadcn patterns + Magic UI (BorderBeam, Shimmer) + UIverse soft press.
 * No extra npm deps; CSS lives in index.css.
 */

export function Button({
  children,
  variant = "default",
  size = "default",
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg cursor-pointer " +
    "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-[var(--bg-app)] disabled:opacity-50 disabled:pointer-events-none " +
    "active:scale-[0.98]";

  const variants = {
    default:
      "bg-[var(--accent-color)] text-white dark:text-[#042f2e] hover:bg-[var(--accent-hover)] shadow-sm",
    destructive: "bg-[var(--danger)] text-white hover:opacity-90 shadow-sm",
    outline:
      "border border-[var(--border-color)] bg-transparent text-[var(--text-main)] " +
      "hover:bg-[var(--tr-hover)] hover:border-[var(--border-strong)]",
    secondary:
      "bg-[var(--tr-hover)] text-[var(--text-main)] hover:bg-[var(--border-color)]",
    ghost: "text-[var(--text-main)] hover:bg-[var(--tr-hover)]",
    link: "text-[var(--accent-color)] underline-offset-4 hover:underline px-0",
  };

  const sizes = {
    default: "h-10 px-4 text-sm",
    sm: "h-8 px-3 text-xs rounded-md",
    lg: "h-11 px-6 text-sm font-semibold",
    icon: "h-9 w-9 p-0",
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`flex flex-col gap-1 p-6 border-b border-[var(--border-color)] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3 className={`text-base font-semibold tracking-tight text-[var(--text-main)] ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...props }) {
  return (
    <p className={`text-sm text-[var(--text-muted)] leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
    <div className={`flex items-center gap-2 p-6 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Badge({ children, variant = "default", className = "", ...props }) {
  const variants = {
    default: "bg-[var(--accent-muted)] text-[var(--accent-color)] border-[var(--accent-color)]/25",
    secondary: "bg-[var(--tr-hover)] text-[var(--text-muted)] border-[var(--border-color)]",
    success: "bg-emerald-500/10 text-[var(--success)] border-emerald-500/25",
    destructive: "bg-rose-500/10 text-[var(--danger)] border-rose-500/25",
    warning: "bg-amber-500/10 text-[var(--warning)] border-amber-500/25",
    outline: "text-[var(--text-main)] border-[var(--border-color)] bg-transparent",
  };

  return (
    <span className={`shadcn-badge ${variants[variant] || variants.default} ${className}`} {...props}>
      {children}
    </span>
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={
        `flex h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] ` +
        `px-3 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] ` +
        `hover:border-[var(--border-strong)] ` +
        `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] ` +
        `focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-app)] ` +
        `disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent ` +
        `file:text-sm file:font-medium ${className}`
      }
      {...props}
    />
  );
}

export function Label({ className = "", children, ...props }) {
  return (
    <label
      className={`text-xs font-medium text-[var(--text-muted)] ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

export function Separator({ className = "", orientation = "horizontal", ...props }) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        className={`w-px self-stretch bg-[var(--border-color)] ${className}`}
        {...props}
      />
    );
  }
  return <hr className={`ui-separator ${className}`} {...props} />;
}

export function Progress({ value = 0, className = "", barClassName = "" }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`ui-progress ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`ui-progress-bar ${barClassName}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className = "", ...props }) {
  return <div className={`ui-skeleton ${className}`} {...props} />;
}

/** Magic UI — Border Beam traveling along card edge */
export function BorderBeam({
  size = 80,
  duration = 8,
  delay = 0,
  colorFrom,
  colorTo,
  className = "",
}) {
  return (
    <div
      aria-hidden
      className={`border-beam ${className}`}
      style={{
        "--beam-size": `${size}px`,
        "--beam-duration": `${duration}s`,
        "--beam-delay": `${delay}s`,
        ...(colorFrom ? { "--beam-from": colorFrom } : {}),
        ...(colorTo ? { "--beam-to": colorTo } : {}),
      }}
    />
  );
}

/** Magic UI — perimeter shimmer CTA (children stay flex siblings so icon+label stay on one line) */
export function ShimmerButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`magic-shimmer-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Magic UI — spotlight card on mouse move */
export function MagicCard({ children, className = "", beam = false, ...props }) {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`magic-card border-beam-host ${className}`}
      {...props}
    >
      {children}
      {beam && <BorderBeam duration={10} size={100} />}
    </div>
  );
}

export function Dialog({ open, onClose, title, description, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm text-[var(--text-main)] max-h-[90vh] overflow-y-auto space-y-4 page-enter border-beam-host"
        role="dialog"
        aria-modal="true"
      >
        <BorderBeam duration={12} size={90} />
        <div className="flex justify-between items-start gap-4 border-b border-[var(--border-color)] pb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-main)]">{title}</h3>
            {description && (
              <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--tr-hover)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

/** UIverse soft-press accent button */
export function GlowButton({ children, className = "", ...props }) {
  return (
    <button
      className={`uiverse-btn-glow inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GradientCard({ children, className = "", ...props }) {
  return (
    <div className={`uiverse-gradient-card p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AnimatedGradientText({ children, className = "", ...props }) {
  return (
    <span className={`magic-gradient-text font-semibold tracking-tight ${className}`} {...props}>
      {children}
    </span>
  );
}
