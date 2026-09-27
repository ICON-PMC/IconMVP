import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <NotFoundView
      title="No encontramos esta marca"
      message="Puede que el link esté mal escrito o que la marca ya no esté publicada en Icon."
    />
  );
}
