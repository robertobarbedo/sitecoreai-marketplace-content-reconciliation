/**
 * Small cookie-backed preference store so the user's context-language choice
 * survives page reloads (the app is re-embedded fresh every time it opens
 * inside SitecoreAI).
 */

const LANGUAGE_COOKIE = "cr_context_language";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readLanguageCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LANGUAGE_COOKIE}=`));
  if (!match) return null;
  const value = match.slice(LANGUAGE_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export function writeLanguageCookie(language: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LANGUAGE_COOKIE}=${encodeURIComponent(language)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=None; Secure`;
}
