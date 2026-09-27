import { idSchema } from "@/domain/teams";
import { NotFoundError, ValidationError } from "@/server/errors";

/** Reads a JSON request body. Malformed JSON is a 400, not a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("The request body must be JSON.");
  }
}

/** A bigint id from the URL. Anything malformed is a 404, like an id that doesn't exist. */
export function routeId(value: string, notFoundMessage: string): string {
  const id = idSchema.safeParse(value);
  if (!id.success) throw new NotFoundError(notFoundMessage);
  return id.data;
}
