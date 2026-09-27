// Client helper for calling the app's JSON API routes.

export type ApiFailure = {
  ok: false;
  status: number;
  message: string;
  /** Per-field messages from a 400, keyed by field name. */
  fieldErrors: Record<string, string>;
};

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, message: "Couldn't reach Lifts. Check your connection and try again.", fieldErrors: {} };
  }
  const json = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: json as T };

  const error = json?.error;
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error?.details?.fieldErrors ?? {})) {
    if (Array.isArray(messages) && messages.length > 0) fieldErrors[field] = String(messages[0]);
  }
  return {
    ok: false,
    status: response.status,
    message: typeof error?.message === "string" ? error.message : "Something went wrong.",
    fieldErrors,
  };
}

export async function getJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const json = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: json as T };
    return {
      ok: false,
      status: response.status,
      message: typeof json?.error?.message === "string" ? json.error.message : "Something went wrong.",
      fieldErrors: {},
    };
  } catch {
    return { ok: false, status: 0, message: "Couldn't reach Lifts.", fieldErrors: {} };
  }
}

/** A server type as it arrives over JSON: dates become ISO strings. */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

/** Converts server data to its JSON shape, so pages hand client components what polling returns. */
export function serialize<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value)) as Serialized<T>;
}
