let token = localStorage.getItem("tapteddy_token") ?? "";

export function setToken(value: string): void {
  token = value;
  localStorage.setItem("tapteddy_token", value);
}

export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Ошибка сервера");
  return data as T;
}

export async function fingerprint(): Promise<string> {
  try {
    const raw = [navigator.userAgent, screen.width, screen.height, navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone].join("|");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return "nofp";
  }
}
