import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <NotFoundView
      title="No encontramos este outfit"
      message="Puede que ya no esté publicado o que el link esté incompleto."
    />
  );
}
