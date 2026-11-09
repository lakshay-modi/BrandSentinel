"use client";

/** JSON request to the app's API; throws the server's plain error message on failure. */
export async function send<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
