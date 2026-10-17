import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  PackageOpen,
  X,
} from "lucide-react";
import { errorMessage, get, invalidate } from "./api";

const FlashContext = createContext<
  (message: string, kind?: "success" | "error") => void
>(() => {});
export function FlashProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<{ message: string; kind: string } | null>(
    null,
  );
  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => setFlash(null), 7000);
      return () => clearTimeout(t);
    }
  }, [flash]);
  return (
    <FlashContext.Provider
      value={(message, kind = "success") => setFlash({ message, kind })}
    >
      {children}
      {flash && (
        <div
          role={flash.kind === "error" ? "alert" : "status"}
          className={`toast ${flash.kind}`}
        >
          {flash.kind === "error" ? (
            <AlertCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <span>{flash.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setFlash(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </FlashContext.Provider>
  );
}
export const useFlash = () => useContext(FlashContext);
export const useData = <T,>(path: string) =>
  useQuery<T>({ queryKey: [path], queryFn: () => get<T>(path) });
export function useAction<T>(
  action: (data: T) => Promise<unknown>,
  success = "Saved successfully.",
  after?: () => void,
) {
  const flash = useFlash();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await invalidate();
      flash(success);
      after?.();
    },
    onError: (e) => flash(errorMessage(e), "error"),
  });
}
export function QueryState({
  query,
}: {
  query: { isPending: boolean; error: unknown; refetch: () => unknown };
}) {
  if (query.isPending)
    return (
      <div className="state">
        <LoaderCircle className="spin" />
        <p>Loading your shop…</p>
      </div>
    );
  if (query.error)
    return (
      <div className="state error" role="alert">
        <AlertCircle />
        <p>{errorMessage(query.error)}</p>
        <button className="btn" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  return null;
}
export function Empty({
  title = "Nothing here yet",
  text = "New records will appear here.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="state">
      <PackageOpen size={36} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "orange" | "purple" | "red" | "neutral";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export type Field = {
  name: string;
  label: string;
  type?:
    "text" | "number" | "email" | "password" | "date" | "select" | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  hint?: string;
  options?: { value: string; label: string }[];
};
export function DataForm({
  fields,
  initial = {},
  onSubmit,
  pending = false,
  submit = "Save changes",
}: {
  fields: Field[];
  initial?: Record<string, string>;
  onSubmit: (v: Record<string, string>) => void;
  pending?: boolean;
  submit?: string;
}) {
  const formId = useId();
  const shape: Record<string, z.ZodString> = {};
  for (const f of fields) {
    let rule = z.string();
    if (f.required)
      rule = rule
        .min(1, `${f.label} is required.`)
        .refine((v) => v.trim().length > 0, `${f.label} is required.`);
    if (f.type === "email") rule = rule.email("Enter a valid email.");
    if (f.type === "password")
      rule = rule.min(12, "Use at least 12 characters.");
    if (f.type === "number")
      rule = rule.refine(
        (v) =>
          (v === "" && !f.required) ||
          (Number.isFinite(Number(v)) &&
            (f.min === undefined || Number(v) >= f.min) &&
            (f.max === undefined || Number(v) <= f.max)),
        `Enter a valid ${f.label.toLowerCase()}.`,
      );
    shape[f.name] = rule;
  }
  const defaults = Object.fromEntries(
    fields.map((f) => [f.name, initial[f.name] ?? ""]),
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(z.object(shape)),
    defaultValues: defaults,
  });
  return (
    <form
      className="data-form"
      onSubmit={handleSubmit((v) => onSubmit(v))}
      noValidate
    >
      {fields.map((f) => {
        const a11y = {
          "aria-label": f.label,
          "aria-required": f.required,
          "aria-describedby": `${formId}-${f.name}-help`,
          "aria-invalid": !!errors[f.name],
        };
        return (
          <label
            key={f.name}
            className={f.type === "textarea" ? "field full" : "field"}
          >
            <span>
              {f.label}
              {f.required && <span className="required"> *</span>}
            </span>
            {f.type === "select" ? (
              <select {...register(f.name)} {...a11y}>
                <option value="">Choose…</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                {...register(f.name)}
                {...a11y}
                rows={3}
                maxLength={250}
              />
            ) : (
              <input
                {...register(f.name)}
                {...a11y}
                type={f.type ?? "text"}
                min={f.min}
                max={f.max}
                step={f.step}
                autoComplete={
                  f.type === "password" ? "new-password" : undefined
                }
                maxLength={f.type === "number" ? undefined : 250}
              />
            )}
            <small
              id={`${formId}-${f.name}-help`}
              className={errors[f.name] ? "field-error" : ""}
            >
              {(errors[f.name]?.message as string) || f.hint}
            </small>
          </label>
        );
      })}
      <div className="form-footer">
        <button className="btn primary" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle size={17} className="spin" />
              Saving…
            </>
          ) : (
            submit
          )}
        </button>
      </div>
    </form>
  );
}
export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
