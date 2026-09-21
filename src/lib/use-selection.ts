"use client";

import { useCallback, useMemo, useState } from "react";

/** Selección múltiple por id: alternar, seleccionar todo, limpiar. */
export function useSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(() => setSelected(new Set(allIds)), [allIds]);

  // Ignora ids que ya no existen (p. ej. tras eliminar y refrescar).
  const visible = useMemo(() => {
    const live = new Set(allIds);
    return new Set([...selected].filter((id) => live.has(id)));
  }, [selected, allIds]);

  return {
    selected: visible,
    count: visible.size,
    allSelected: allIds.length > 0 && visible.size === allIds.length,
    isSelected: (id: string) => visible.has(id),
    toggle,
    selectAll,
    clear,
  };
}
