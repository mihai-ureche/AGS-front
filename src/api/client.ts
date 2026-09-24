export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined>;
type Options = { query?: Query; body?: unknown; signal?: AbortSignal };

export type TokenSource = (forceRefresh?: boolean) => Promise<string>;

export interface Api {
  get<T>(path: string, options?: Options): Promise<T>;
  post<T>(path: string, options?: Options): Promise<T>;
  patch<T>(path: string, options?: Options): Promise<T>;
  delete(path: string, options?: Options): Promise<void>;
}

export function createApi(baseUrl: string, getToken: TokenSource): Api {
  async function send<T>(
    method: string,
    path: string,
    { query, body, signal }: Options = {},
    retried = false,
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const token = await getToken(retried);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError(
        0,
        "The AGS service could not be reached. Check your connection and try again.",
      );
    }
    // Graph tokens can expire between the silent acquisition and the request.
    if (response.status === 401 && !retried) {
      await response.body?.cancel();
      return send(method, path, { query, body, signal }, true);
    }
    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : `Request failed (${response.status}).`;
      throw new ApiError(response.status, message);
    }
    return data as T;
  }

  return {
    get: (path, options) => send("GET", path, options),
    post: (path, options) => send("POST", path, options),
    patch: (path, options) => send("PATCH", path, options),
    delete: (path, options) => send("DELETE", path, options),
  };
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
