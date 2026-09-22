import { Bookmark } from "lucide-react";
import { toggleSavedPost, toggleSavedGarment } from "@/app/saved/actions";

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
}: {
  kind: "post" | "garment";
  id: string;
  saved: boolean;
  path: string;
  sourcePostId?: string;
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
        className={`glass flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-105 ${
          saved ? "text-coral" : "text-ink/60"
        }`}
      >
        <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden />
      </button>
    </form>
  );
}
