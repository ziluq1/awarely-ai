import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary: "bg-inverse text-inverse-text hover:opacity-90",
  secondary: "border border-line bg-card text-foreground hover:bg-accent",
  quiet: "bg-transparent text-accent-text hover:bg-accent",
  danger: "border border-line bg-card text-danger hover:bg-blush",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", className = ""): string {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-center text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export const cardClass =
  "rounded-[1.75rem] border border-line bg-card shadow-[0_24px_60px_-40px_rgba(36,31,43,0.45)]";

export const fieldClass =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-base text-foreground outline-none placeholder:text-muted";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children?: ReactNode;
}) {
  const labelClass = "text-sm font-medium uppercase tracking-[0.18em] text-accent-text";
  return (
    <header className="max-w-2xl">
      {title ? <p className={labelClass}>{eyebrow}</p> : <h1 className={labelClass}>{eyebrow}</h1>}
      {title ? (
        <h1 className="mt-3 text-balance font-serif text-3xl leading-[1.1] text-foreground sm:text-4xl lg:text-5xl">{title}</h1>
      ) : null}
      {children ? <div className="mt-4 space-y-3 text-base leading-relaxed text-muted">{children}</div> : null}
    </header>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`${cardClass} p-6`}>
      <p className="font-medium text-foreground">{label}</p>
      <div className="mt-4 space-y-3" aria-hidden="true">
        <div className="h-4 w-40 rounded-full bg-accent motion-reduce:animate-none animate-pulse" />
        <div className="h-4 w-full rounded-full bg-accent/70 motion-reduce:animate-none animate-pulse" />
        <div className="h-4 w-2/3 rounded-full bg-sage motion-reduce:animate-none animate-pulse" />
      </div>
    </div>
  );
}

export function ErrorBlock({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div role="alert" className={`${cardClass} border-danger/40 bg-blush p-6 text-blush-text`}>
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      <p className="mt-2 leading-relaxed">{message}</p>
      {children ? <div className="mt-4 flex flex-wrap gap-3">{children}</div> : null}
    </div>
  );
}

export function EmptyBlock({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${cardClass} p-6 sm:p-8`}>
      <h2 className="font-serif text-3xl text-foreground">{title}</h2>
      <p className="mt-3 max-w-xl leading-relaxed text-muted">{message}</p>
      {children ? <div className="mt-6 flex flex-wrap gap-3">{children}</div> : null}
    </div>
  );
}
