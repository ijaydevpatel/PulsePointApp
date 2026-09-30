function optional(value: string | undefined): string | null {
  const v = value?.trim();
  return v && v.length > 0 ? v : null;
}

export const ENV = {
  clerkPublishableKey: optional(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY),

  apiUrl: optional(process.env.EXPO_PUBLIC_API_URL),
} as const;

export const FEATURES = {
  canSignIn: ENV.clerkPublishableKey !== null,
  canSync: ENV.apiUrl !== null,
} as const;
