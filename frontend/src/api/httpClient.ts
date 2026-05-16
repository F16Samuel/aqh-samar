import { supabase } from "@/lib/supabase";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "/api/v1";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOpts {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  raw?: boolean; // return Response (for blob downloads)
  headers?: Record<string, string>;
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function buildUrl(path: string, query?: RequestOpts["query"]): string {
  const url = new URL(
    path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = res.statusText || "Request failed";
  let details: unknown;
  try {
    const body = (await res.json()) as Partial<{
      error: { code: string; message: string; details: unknown };
      detail: unknown;
      message: string;
    }>;
    if (body?.error) {
      code = body.error.code || code;
      message = body.error.message || message;
      details = body.error.details;
    } else if (typeof body?.detail === "string") {
      message = body.detail;
    } else if (body?.message) {
      message = body.message;
    } else if (body?.detail) {
      details = body.detail;
    }
  } catch {
    // not json
  }
  return new ApiError(message, code, res.status, details);
}

export async function request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, query, signal, raw, headers } = opts;
  const auth = await authHeader();
  const init: RequestInit = {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...auth,
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(buildUrl(path, query), init);
  if (!res.ok) throw await parseError(res);
  if (raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return (await res.text()) as unknown as T;
  const data = await res.json();
  // unwrap { data, error } envelope if present
  if (data && typeof data === "object" && "data" in data && "error" in data) {
    if (data.error) throw new ApiError(data.error.message ?? "Error", data.error.code ?? "error", res.status, data.error.details);
    return data.data as T;
  }
  return data as T;
}

export const http = {
  get: <T,>(path: string, opts: Omit<RequestOpts, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T,>(path: string, body?: unknown, opts: Omit<RequestOpts, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T,>(path: string, body?: unknown, opts: Omit<RequestOpts, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  del: <T,>(path: string, opts: Omit<RequestOpts, "method" | "body"> = {}) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
