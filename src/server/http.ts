import { ValidationError } from "@/server/errors";

/** Reads a JSON request body. Malformed JSON is a 400, not a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("The request body must be JSON.");
  }
}
