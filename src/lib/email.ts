import "server-only";
import nodemailer from "nodemailer";

export type EmailResult = { ok: true } | { ok: false; error: string };

// Correo transaccional por SMTP. Supabase Auth solo envía sus propios correos (confirmación,
// reset), no expone una API genérica, así que las notificaciones de la app salen por aquí.
// Configuración: SMTP_HOST/PORT/USER/PASS + EMAIL_FROM (ver .env.example).
export async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM;
  if (!host || !from) {
    console.warn("[email] SMTP_HOST/EMAIL_FROM sin configurar; no se envió:", msg.subject);
    return { ok: false, error: "El correo no está configurado." };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from, ...msg });
    return { ok: true };
  } catch (e) {
    console.error("[email] envío falló:", e instanceof Error ? e.message : e);
    return { ok: false, error: "No se pudo enviar el correo." };
  }
}
