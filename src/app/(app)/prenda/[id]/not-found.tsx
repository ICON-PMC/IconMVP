import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <NotFoundView
      title="No encontramos esta prenda"
      message="Puede que ya no esté disponible o que la marca la haya retirado del catálogo."
    />
  );
}
