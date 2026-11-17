import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <NotFoundView
      title="Este perfil no está disponible"
      message="Puede que el enlace esté mal escrito, que la cuenta sea privada o que ya no exista."
    />
  );
}
