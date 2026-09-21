"use client";

import { useState } from "react";
import { SearchableChecklist, type ChecklistOption } from "@/components/searchable-checklist";

/** Campo de formulario `garments`: elegir prendas de una lista larga con búsqueda. */
export function GarmentsField({ options }: { options: ChecklistOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <SearchableChecklist
      name="garments"
      options={options}
      selected={selected}
      onChange={setSelected}
      searchLabel="Buscar prenda"
    />
  );
}
