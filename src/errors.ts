import { ZodError } from "zod";

export function humanizeError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => {
        const field = issue.path.join(".") || "row";
        return `${field}: ${issue.message}`;
      })
      .join("; ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown row error";
}
