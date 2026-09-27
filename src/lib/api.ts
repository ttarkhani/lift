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
