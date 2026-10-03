// Thin fetch wrapper around the LinkFetch REST API. One concern only:
// attach the Bearer token, parse JSON, and return a structured result so
// tool handlers can format error states (402/422/410) distinctly from a
// generic exception.

export interface LinkFetchConfig {
  apiKey: string;
  baseUrl: string;
}

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiFailure {
  ok: false;
  status: number;
  /** Machine-readable error code from the API envelope (`insufficient_credits`, `extension_required`, …). */
  code: string | null;
  /** Human-readable message from the API, suitable for relaying to the LLM. */
  message: string;
  /** Raw body in case the caller wants to dig further. */
  body: unknown;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

// The API sends `{ error: "<code>", message }`; the nested
// `{ error: { code, message } }` shape is accepted too.
interface ErrorEnvelope {
  error?: string | { code?: string; message?: string };
  message?: string;
}

export function createClient(config: LinkFetchConfig) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const authHeader = `Bearer ${config.apiKey}`;

  async function get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<ApiResult<T>> {
    const url = new URL(base + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return send<T>(url, { headers: { authorization: authHeader, accept: "application/json" } });
  }

  async function post<T>(path: string, json: unknown): Promise<ApiResult<T>> {
    return send<T>(new URL(base + path), {
      method: "POST",
      headers: {
        authorization: authHeader,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(json),
    });
  }

  async function send<T>(url: URL, init: RequestInit): Promise<ApiResult<T>> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      return {
        ok: false,
        status: 0,
        code: "network_error",
        message: `Network error calling LinkFetch (${url.pathname}): ${
          err instanceof Error ? err.message : String(err)
        }`,
        body: null,
      };
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON body — fall through with body=null.
    }

    if (res.ok) {
      return { ok: true, status: res.status, data: body as T };
    }

    const envelope = (body ?? {}) as ErrorEnvelope;
    const nested = typeof envelope.error === "object" ? envelope.error : undefined;
    return {
      ok: false,
      status: res.status,
      code: (typeof envelope.error === "string" ? envelope.error : nested?.code) ?? null,
      message:
        envelope.message ?? nested?.message ?? `LinkFetch API returned HTTP ${res.status}.`,
      body,
    };
  }

  return { get, post };
}

export type LinkFetchClient = ReturnType<typeof createClient>;
