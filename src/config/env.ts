/**
 * Typed access to public configuration.
 *
 * Nothing here is a secret and nothing is hardcoded. Values arrive from .env
 * through Expo's EXPO_PUBLIC_ mechanism, which inlines them into the bundle at
 * build time. That is exactly why only publishable values may live here: an
 * APK is a zip archive, so anything inlined can be read by anyone who
 * downloads the app.
 *
 * Server-side secrets (Clerk secret key, Mongo URI, JWT secret, Groq and
 * Gemini keys) stay on the backend. The app never holds them; it calls the API
 * and the API talks to those services.
 */

function optional(value: string | undefined): string | null {
  const v = value?.trim();
  return v && v.length > 0 ? v : null;
}

export const ENV = {
  /** Clerk publishable key. Null means the app runs guest-only, which is valid. */
  clerkPublishableKey: optional(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY),

  /** Backend base URL. Null means enrichment and sync are simply unavailable. */
  apiUrl: optional(process.env.EXPO_PUBLIC_API_URL),
} as const;

/**
 * Missing config degrades the app, it never breaks it. Triage, red flags and
 * the medicine check are local and must keep working regardless (QR2).
 */
export const FEATURES = {
  canSignIn: ENV.clerkPublishableKey !== null,
  canSync: ENV.apiUrl !== null,
} as const;
