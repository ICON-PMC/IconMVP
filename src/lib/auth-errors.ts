import type { AuthError } from "@supabase/supabase-js";

// Traduce los errores de Supabase Auth a mensajes en español para /login y /signup.
// Se busca primero por `code` (estable) y, si no viene, por el texto en inglés.
const BY_CODE: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de entrar: revisa tu bandeja de entrada.",
  user_already_exists: "Este correo ya está registrado. Inicia sesión.",
  email_exists: "Este correo ya está registrado. Inicia sesión.",
  weak_password: "La contraseña debe tener al menos 6 caracteres.",
  email_address_invalid: "Ese correo no parece válido. Revísalo.",
  over_request_rate_limit: "Demasiados intentos. Espera un momento y vuelve a intentar.",
  over_email_send_rate_limit: "Enviamos demasiados correos. Espera unos minutos y vuelve a intentar.",
  signup_disabled: "El registro está cerrado por ahora.",
  user_banned: "Esta cuenta está suspendida.",
};

const BY_MESSAGE: [RegExp, string][] = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/already (been )?registered|already exists/i, BY_CODE.user_already_exists],
  [/password should be at least|password.*(short|weak)/i, BY_CODE.weak_password],
  [/(invalid|unable to validate) email/i, BY_CODE.email_address_invalid],
  [/rate limit|too many requests/i, BY_CODE.over_request_rate_limit],
];

export function authErrorMessage(error: Pick<AuthError, "message" | "code">): string {
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  for (const [re, msg] of BY_MESSAGE) if (re.test(error.message)) return msg;
  if (error.code === "validation_failed") return "Revisa el correo y la contraseña.";
  return "Algo salió mal. Intenta de nuevo en un momento.";
}
