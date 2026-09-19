import "server-only";
import { sendEmail, type EmailResult } from "@/lib/email";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(bodyHtml: string, cta: { href: string; label: string }): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#faf7ef;font-family:Arial,Helvetica,sans-serif;color:#16271d">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
  <p style="font-size:22px;font-weight:600;color:#1f5638;margin:0 0 24px">Icon</p>
  ${bodyHtml}
  <p style="margin:28px 0"><a href="${esc(cta.href)}" style="background:#1f5638;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;display:inline-block;font-weight:600">${esc(cta.label)}</a></p>
  <p style="font-size:12px;color:#16271d99">Si el botón no funciona, copia este enlace: ${esc(cta.href)}</p>
</div></body></html>`;
}

export function sendBrandApprovedEmail(
  to: string,
  brandName: string,
  origin: string,
): Promise<EmailResult> {
  const href = `${origin}/marca/panel`;
  return sendEmail({
    to,
    subject: "¡Tu marca fue aprobada en Icon!",
    text: `Te damos la bienvenida a Icon.\n\n${brandName} ya está activa: tu perfil y tus prendas son visibles para todo el público.\n\nEntra a tu panel para seguir agregando prendas y publicaciones:\n${href}\n`,
    html: layout(
      `<h1 style="font-size:20px;color:#1f5638;margin:0 0 12px">¡Tu marca fue aprobada!</h1>
  <p style="line-height:1.5"><strong>${esc(brandName)}</strong> ya está activa en Icon: tu perfil y tus prendas son visibles para todo el público.</p>
  <p style="line-height:1.5">Desde tu panel puedes seguir agregando prendas y publicaciones.</p>`,
      { href, label: "Ir a mi panel" },
    ),
  });
}

export function sendBrandRejectedEmail(
  to: string,
  brandName: string,
  note: string | null,
  origin: string,
): Promise<EmailResult> {
  const href = `${origin}/onboarding/marca?paso=1`;
  const noteText = note ? `\nEsto es lo que nuestro equipo te comenta:\n"${note}"\n` : "";
  return sendEmail({
    to,
    subject: "Tu solicitud en Icon necesita ajustes",
    text: `Revisamos el perfil de ${brandName} y necesita algunos ajustes antes de publicarse.\n${noteText}\nPuedes editar tu perfil y volver a enviarlo cuando quieras:\n${href}\n`,
    html: layout(
      `<h1 style="font-size:20px;color:#1f5638;margin:0 0 12px">Tu solicitud necesita ajustes</h1>
  <p style="line-height:1.5">Revisamos el perfil de <strong>${esc(brandName)}</strong> y necesita algunos ajustes antes de publicarse.</p>
  ${note ? `<p style="line-height:1.5;background:#fff;border-left:4px solid #ee5a2d;padding:12px 16px;margin:16px 0">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
  <p style="line-height:1.5">Puedes editar tu perfil y volver a enviarlo cuando quieras.</p>`,
      { href, label: "Editar mi perfil" },
    ),
  });
}
