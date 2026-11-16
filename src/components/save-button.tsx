import { Bookmark } from "lucide-react";
import { toggleSavedPost, toggleSavedGarment } from "@/app/(app)/saved/actions";

// Botón de guardar (marcador/bookmark). Server component: el form llama a un server action.
// Ícono a propósito distinto del corazón del LikeButton, para no confundirlos.
// Si no hay sesión, el action redirige a /login.
// Va inline en la fila al pie de la tarjeta (decisión 13): ya no existe el modo flotante.
export function SaveButton({
  kind,
  id,
  saved,
  path,
  sourcePostId,
  compact = false,
}: {
  kind: "post" | "garment";
  id: string;
  saved: boolean;
  path: string;
  sourcePostId?: string;
  compact?: boolean;
}) {
  const action = kind === "post" ? toggleSavedPost : toggleSavedGarment;

  return (
    <form action={action}>
      <input type="hidden" name={kind === "post" ? "postId" : "garmentId"} value={id} />
      <input type="hidden" name="path" value={path} />
      {kind === "garment" && sourcePostId && (
        <input type="hidden" name="sourcePostId" value={sourcePostId} />
      )}
      <button
        type="submit"
        aria-label={saved ? "Quitar de guardados" : "Guardar"}
        title={saved ? "Quitar de guardados" : "Guardar"}
        aria-pressed={saved}
        // Spec 007: círculo sólido; guardado = relleno coral con ícono tinta. 40 px sobre la foto, 44 fuera.
        className={`flex ${compact ? "size-10" : "size-11"} items-center justify-center rounded-full shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-line-strong ${
          saved ? "bg-action text-action-ink" : "bg-surface-raised/95 text-text hover:bg-surface-raised"
        }`}
      >
        <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden />
      </button>
    </form>
  );
}
