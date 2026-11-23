// Keep the browser app and API on the same host in local development. Different
// ports are fine, but mixing localhost and 127.0.0.1 can prevent session cookies
// from being sent because browsers treat them as different sites.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type ApiErrorBody = { detail?: string; message?: string };

export type AuthenticatedUserResponse = {
  user: { role: "manager" | "user" };
  workspace: { onboarding_completed_at: string | null };
};

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

/** Choose the first useful screen from the authenticated account's server-owned role and workspace state. */
export function authenticatedDestination(result: AuthenticatedUserResponse): string {
  if (!result.workspace.onboarding_completed_at) {
    return result.user.role === "manager" ? "/onboarding" : "/workspace-setup-pending";
  }
  return result.user.role === "manager" ? "/" : "/leads";
}

/** Send a JSON request to FastAPI and include the HTTP-only session cookie. */
export async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) throw new ApiError(data.detail ?? data.message ?? "Something went wrong. Please try again.", response.status);
  return data;
}
