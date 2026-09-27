import { cx } from "@/lib/cx";
import { CheckIcon } from "./icons";

const control =
  "w-full rounded-sm border-2 border-rule bg-paper px-3 py-2 text-base text-ink placeholder:text-ink-soft hover:border-ink aria-invalid:border-alert";

type FieldFrameProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
};

function FieldFrame({ id, label, hint, error, optional, children }: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
        {optional && <span className="font-normal text-ink-soft"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-bold text-alert">
          Error: {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return cx(hint && `${id}-hint`, error && `${id}-error`) || undefined;
}

type FieldProps = {
  name: string;
  label: string;
  id?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Monospace text, for codes and snippets. */
  mono?: boolean;
};

function controlProps({ name, hint, error, optional, id = name }: FieldProps) {
  return {
    id,
    name,
    required: !optional,
    "aria-describedby": describedBy(id, hint, error),
    "aria-invalid": error ? true : undefined,
  } as const;
}

export function TextField({
  name,
  label,
  id = name,
  hint,
  error,
  optional,
  mono,
  ...input
}: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "id">) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        type="text"
        {...input}
        {...controlProps({ name, label, id, hint, error, optional })}
        className={cx(control, "min-h-tap", mono && "font-mono")}
      />
    </FieldFrame>
  );
}

export function TextArea({
  name,
  label,
  id = name,
  hint,
  error,
  optional,
  mono,
  rows = 4,
  ...textarea
}: FieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        rows={rows}
        {...textarea}
        {...controlProps({ name, label, id, hint, error, optional })}
        className={cx(control, mono && "font-mono text-sm")}
      />
    </FieldFrame>
  );
}

type SelectFieldProps = {
  name: string;
  label: string;
  id?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
};

export function SelectField({ name, label, id = name, hint, error, options, defaultValue }: SelectFieldProps) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-describedby={describedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={cx(control, "min-h-tap")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

type ChoiceGroupProps = {
  name: string;
  legend: string;
  hint?: string;
  options: { value: string; label: string }[];
  defaultValues?: string[];
};

/** A set of checkboxes drawn as toggle chips. The checkmark and border change with the state, not only the color. */
export function ChoiceGroup({ name, legend, hint, options, defaultValues = [] }: ChoiceGroupProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-bold">{legend}</legend>
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "group relative inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-sm border-2 border-rule bg-paper px-3",
              "hover:border-ink has-checked:border-stamp has-checked:bg-stamp-wash has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-stamp",
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={defaultValues.includes(option.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-sm border-2 border-ink text-xs peer-checked:border-stamp peer-checked:bg-stamp peer-checked:text-paper"
            >
              <CheckIcon className="hidden group-has-checked:block" />
            </span>
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Checkbox({ name, label, hint }: { name: string; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={name}
        name={name}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="mt-1 size-5 shrink-0 accent-stamp"
      />
      <div>
        <label htmlFor={name} className="font-bold">
          {label}
        </label>
        {hint && (
          <p id={`${name}-hint`} className="text-sm text-ink-soft">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
