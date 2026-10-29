"use client";

import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warn" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-pine text-white hover:bg-pine-dark",
  secondary: "bg-white text-pine border-2 border-pine/80 hover:bg-pine-50",
  ghost: "text-pine hover:bg-pine-50",
  danger: "bg-brick text-white hover:bg-[#9a2019]",
  warn: "bg-sign text-charcoal hover:bg-[#e09d00]",
  dark: "bg-charcoal text-white hover:bg-black",
};
const SIZE: Record<Size, string> = {
  sm: "min-h-10 px-3.5 text-[0.9rem] gap-1.5",
  md: "min-h-12 px-5 text-base gap-2",
  lg: "min-h-14 px-6 text-[1.05rem] gap-2.5",
};

interface BtnBase {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

function btnClass({ variant = "primary", size = "md", block, className }: BtnBase) {
  return cx(
    "inline-flex select-none items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, BtnBase & Omit<ComponentProps<"button">, "className">>(function Button(
  { variant, size, block, icon, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={btnClass({ variant, size, block, className })} {...rest}>
      {loading ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant, size, block, icon, className, children, ...rest }: BtnBase & { href: string } & Omit<ComponentProps<typeof Link>, "className" | "href">) {
  return (
    <Link href={href} className={btnClass({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li" } & Omit<ComponentProps<"div">, "className">) {
  return (
    <As className={cx("rounded-[var(--radius-card)] border border-line bg-white", className)} {...(rest as object)}>
      {children}
    </As>
  );
}

export function CardHeader({ title, action, sub, icon }: { title: ReactNode; action?: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 text-pine">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[1.15rem] font-bold">{title}</h2>
          {sub && <p className="mt-0.5 text-[0.92rem] text-stone">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export type Tone = "paid" | "late" | "due" | "info" | "neutral" | "processing" | "warn";

const PILL: Record<Tone, string> = {
  paid: "bg-pine-50 text-pine",
  processing: "bg-lake-50 text-lake",
  late: "bg-brick-50 text-brick",
  due: "bg-paper-2 text-charcoal",
  warn: "bg-sign-50 text-sign-ink",
  info: "bg-lake-50 text-lake",
  neutral: "bg-paper-2 text-stone",
};

/** Status pill. Always text plus an icon, never color alone. */
export function Pill({ tone, children, icon, className }: { tone: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.9rem] font-semibold", PILL[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  optional,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  optional?: boolean;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-stone">(optional)</span>}
      </label>
      {hint && <p className="-mt-1 text-[0.9rem] text-stone">{hint}</p>}
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-brick" role="alert">
          <CircleAlert className="h-4 w-4" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full min-h-12 rounded-lg border-2 border-field bg-white px-3.5 py-2 text-base text-charcoal placeholder:text-[#8a8579] focus:border-lake focus:outline-none disabled:bg-paper-2";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input"> & { prefix?: string; suffix?: string }>(function Input(
  { className, prefix, suffix, ...rest },
  ref,
) {
  if (!prefix && !suffix) return <input ref={ref} className={cx(inputBase, className)} {...rest} />;
  return (
    <div className={cx("relative flex items-center", className)}>
      {prefix && <span className="pointer-events-none absolute left-3.5 text-stone">{prefix}</span>}
      <input ref={ref} className={cx(inputBase, prefix && "pl-8", suffix && "pr-14")} {...rest} />
      {suffix && <span className="pointer-events-none absolute right-3.5 text-stone">{suffix}</span>}
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        inputBase,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%235C6159%22><path d=%22M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z%22/></svg>')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, "min-h-28 py-3 leading-relaxed", className)} {...rest} />;
});

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.9rem] text-stone">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50",
          checked ? "border-pine bg-pine" : "border-field bg-paper-2",
        )}
      >
        <span className={cx("inline-block h-6 w-6 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-0.5")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-pine" />
      <label htmlFor={id} className="cursor-pointer">
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-[0.9rem] text-stone">{hint}</span>}
      </label>
    </div>
  );
}

export function Choice<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 1,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode; badge?: ReactNode }[];
  columns?: 1 | 2 | 3;
}) {
  return (
    <div role="radiogroup" className={cx("grid gap-2.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={cx(
              "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border-2 bg-white p-3.5 transition-colors",
              on ? "border-pine bg-pine-50/60" : "border-line hover:border-field",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="mt-1 h-5 w-5 shrink-0 accent-pine" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {o.label}
                {o.badge}
              </span>
              {o.hint && <span className="mt-0.5 block text-[0.9rem] text-stone">{o.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const CALLOUT = {
  info: { cls: "border-lake/30 bg-lake-50 text-charcoal", icon: <Info className="h-5 w-5 text-lake" aria-hidden /> },
  ok: { cls: "border-pine/30 bg-pine-50 text-charcoal", icon: <CircleCheck className="h-5 w-5 text-pine" aria-hidden /> },
  warn: { cls: "border-sign/60 bg-sign-50 text-charcoal", icon: <TriangleAlert className="h-5 w-5 text-sign-ink" aria-hidden /> },
  danger: { cls: "border-brick/30 bg-brick-50 text-charcoal", icon: <CircleAlert className="h-5 w-5 text-brick" aria-hidden /> },
};

export function Callout({ tone = "info", title, children, action, className }: { tone?: keyof typeof CALLOUT; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const c = CALLOUT[tone];
  return (
    <div className={cx("flex gap-3 rounded-lg border px-4 py-3.5", c.cls, className)}>
      <span className="mt-0.5 shrink-0">{c.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx("text-[0.95rem]", !!title && "mt-0.5")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, max, tone = "pine", label }: { value: number; max: number; tone?: "pine" | "sign" | "lake"; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = tone === "sign" ? "bg-sign" : tone === "lake" ? "bg-lake" : "bg-pine";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-3 w-full overflow-hidden rounded-full bg-paper-2">
      <div className={cx("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "late" | "ok" }) {
  return (
    <div>
      <p className="text-[0.95rem] font-semibold text-stone">{label}</p>
      <p className={cx("tnum mt-0.5 font-display text-[1.6rem] font-extrabold leading-tight", tone === "late" && "text-brick", tone === "ok" && "text-pine")}>{value}</p>
      {sub && <p className="text-[0.95rem] text-stone">{sub}</p>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-paper-2 p-3 text-stone">{icon}</div>}
      <p className="text-[1.05rem] font-bold">{title}</p>
      {children && <div className="mt-1 max-w-md text-stone">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Native <dialog>: focus trap, Escape and backdrop handled by the browser. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl bg-white p-0 text-charcoal shadow-lift backdrop:bg-charcoal/50 sm:m-auto sm:max-h-[88dvh] sm:rounded-2xl",
        wide ? "sm:max-w-3xl" : "sm:max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-[1.2rem] font-bold">{title}</h2>
            <button onClick={onClose} className="-mr-2 rounded-lg p-2 text-stone hover:bg-paper-2" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
