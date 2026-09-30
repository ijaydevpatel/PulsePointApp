interface ClerkLikeError {
  errors?: { code?: string; message?: string; longMessage?: string }[];
  message?: string;
}

const BY_CODE: Record<string, string> = {
  form_identifier_not_found: 'Incorrect email or password.',
  form_password_incorrect: 'Incorrect email or password.',
  form_param_format_invalid: 'Please enter a valid email address.',
  form_identifier_exists: 'This email is already registered.',
  form_password_pwned: 'Please choose a different password - this one has appeared in a known data breach.',
  form_password_length_too_short: 'Your password needs to be at least 8 characters.',
  form_password_validation_failed: 'Please choose a stronger password.',
  form_param_nil: 'Please fill in every field.',
  form_code_incorrect: 'That code is not right. Check it and try again.',
  verification_expired: 'That code has expired. Ask for a new one.',
  verification_failed: 'We could not verify that code. Ask for a new one.',
  session_exists: 'You are already signed in.',
  too_many_requests: 'Too many attempts. Wait a minute and try again.',
  captcha_invalid: 'We could not confirm the request. Please try again.',
};

function looksOffline(raw: string): boolean {
  const s = raw.toLowerCase();
  return s.includes('network')
    || s.includes('fetch')
    || s.includes('timeout')
    || s.includes('econnrefused');
}

export function humanAuthError(e: unknown): string {
  const err = e as ClerkLikeError;

  const code = err?.errors?.[0]?.code;
  if (code && BY_CODE[code]) return BY_CODE[code];

  const raw = err?.errors?.[0]?.message || err?.message || '';

  if (looksOffline(raw)) {
    return 'We could not reach the server. Check your connection and try again.';
  }

  return 'Something went wrong. Please try again.';
}

export function emailError(v: string): string | null {
  if (!v.trim()) return 'Please enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return 'Please enter a valid email address.';
  return null;
}

export function passwordError(v: string): string | null {
  if (!v) return 'Please enter your password.';
  if (v.length < 8) return 'Your password needs to be at least 8 characters.';
  return null;
}

export function confirmError(pw: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password.';
  if (pw !== confirm) return "Your passwords don't match.";
  return null;
}

export function nameError(v: string): string | null {
  if (!v.trim()) return 'Please enter your name.';
  return null;
}
