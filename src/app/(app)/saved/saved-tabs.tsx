import { LinkTabs } from "@/components/link-tabs";

export function SavedTabs({ active }: { active: "guardados" | "siguiendo" }) {
  return (
    <LinkTabs
      label="Secciones de lo mío"
      active={active}
      className="mb-6"
      tabs={[
        { id: "guardados", label: "Guardados", href: "/saved?tab=guardados" },
        { id: "siguiendo", label: "Siguiendo", href: "/saved?tab=siguiendo" },
      ]}
    />
  );
}
