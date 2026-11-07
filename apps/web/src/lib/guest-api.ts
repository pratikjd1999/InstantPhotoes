"use client";

// Guest pages call /api/public/*. Unlike lib/api.ts, a 401 here means "ask for the phone number", not "go to login".

export class GuestApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export async function guestApi<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`/api/public${path}`, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new GuestApiError("Couldn't connect. Check your internet and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new GuestApiError(data.error ?? "Something went wrong. Please try again.", res.status, data.code);
  return data as T;
}

/** Indian mobile numbers: keeps the 10 digits, dropping a pasted +91 or leading 0. */
export function phoneDigits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

export const isValidPhone = (digits: string) => /^[6-9]\d{9}$/.test(digits);
export const fmtPhone = (digits: string) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);
