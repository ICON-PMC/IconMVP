import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <NotFoundView
      title="No encontramos esta página"
      message="Puede que el link esté mal escrito o que la página ya no exista."
    />
  );
}
