import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Info, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      className="spinner"
      role="status"
      aria-label={label ?? "Se încarcă"}
    />
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon =
    tone === "info" ? Info : tone === "success" ? Check : AlertTriangle;
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={17} aria-hidden="true" />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
      {onDismiss && (
        <button
          className="icon-button"
          aria-label="Închide mesajul"
          onClick={onDismiss}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={22} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "good" | "warning" | "critical";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Native <dialog> gives focus trapping, Escape and a backdrop for free. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "sheet";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-frame">
          <header className="dialog-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button
              className="icon-button"
              aria-label="Închide"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** A button that opens a floating panel; closes on outside click or Escape. */
export function Popover({
  label,
  icon: Icon,
  badge,
  children,
  align = "start",
  className = "",
}: {
  label: ReactNode;
  icon?: LucideIcon;
  badge?: number;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className={`popover ${className}`} ref={ref}>
      <button
        className={`control ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {Icon && <Icon size={16} aria-hidden="true" />}
        <span className="control-label">{label}</span>
        {badge ? <span className="control-count">{badge}</span> : null}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className={`popover-panel align-${align}`} id={panelId}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "is-selected" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type FieldControl = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/** Label, control and message; the message is linked, not part of the name. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (control: FieldControl) => ReactNode;
}) {
  const id = useId();
  const message = error || hint;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        "aria-describedby": message ? `${id}-message` : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {message && (
        <span
          id={`${id}-message`}
          className={error ? "field-error" : "field-hint"}
        >
          {message}
        </span>
      )}
    </div>
  );
}
