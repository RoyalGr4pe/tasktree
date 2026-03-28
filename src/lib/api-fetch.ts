'use client';

/**
 * Wrapper around fetch that automatically attaches the monday.com session token
 * as the Authorization header on every request.
 *
 * The session token is captured once during app init and stored in module scope.
 * Call setSessionToken() from getMondayContext() after resolving the token.
 */

let _sessionToken: string | null = null;

export function setSessionToken(token: string) {
  _sessionToken = token;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  const token = _sessionToken ?? process.env.NEXT_PUBLIC_DEV_SESSION_TOKEN;
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
