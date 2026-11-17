"use client";

import { useMemo, useState, useTransition } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Chip } from "@/components/chip";
import { Input } from "@/components/ui/input";
import { LOOK_LIMITS } from "@/lib/look-rules";
import { createStyleForLook, setLookTags } from "@/app/(app)/crear/actions";

type Option = { id: string; name: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const VISIBLE = 14;

/**
 * Estilo y ocasión del look (spec 008, T019). Cada toque se guarda al momento. Estilos: populares
 * primero, buscador y "Crear '{texto}'" (mismas reglas de la spec 004). Ocasiones: chips.
 */
export function StyleOccasionFields({
  postId,
  styles: initialStyles,
  occasions,
  selectedStyleIds,
  selectedOccasionIds,
  disabled = false,
}: {
  postId: string;
  styles: Option[];
  occasions: Option[];
  selectedStyleIds: string[];
  selectedOccasionIds: string[];
  disabled?: boolean;
}) {
  const [styles, setStyles] = useState(initialStyles);
  const [styleIds, setStyleIds] = useState(selectedStyleIds);
  const [occasionIds, setOccasionIds] = useState(selectedOccasionIds);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(nextStyles: string[], nextOccasions: string[]) {
    const prev = { styleIds, occasionIds };
    setStyleIds(nextStyles);
    setOccasionIds(nextOccasions);
    startTransition(async () => {
      const res = await setLookTags(postId, { styleIds: nextStyles, occasionIds: nextOccasions });
      if (!res.ok) {
        toast.error(res.error);
        setStyleIds(prev.styleIds);
        setOccasionIds(prev.occasionIds);
      }
    });
  }

  function toggleStyle(id: string) {
    if (styleIds.includes(id)) return save(styleIds.filter((x) => x !== id), occasionIds);
    if (styleIds.length >= LOOK_LIMITS.styles) return toast.info("Elige hasta 6 estilos.");
    save([...styleIds, id], occasionIds);
  }

  function toggleOccasion(id: string) {
    if (occasionIds.includes(id)) return save(styleIds, occasionIds.filter((x) => x !== id));
    if (occasionIds.length >= LOOK_LIMITS.occasions) return toast.info("Elige hasta 3 ocasiones.");
    save(styleIds, [...occasionIds, id]);
  }

  const q = fold(query);
  const filtered = useMemo(() => (q ? styles.filter((s) => fold(s.name).includes(q)) : styles), [styles, q]);
  const exact = q && styles.some((s) => fold(s.name) === q);
  // Seleccionados siempre visibles, aunque no estén entre los populares.
  const visible = q || showAll ? filtered : [...new Map([...styles.filter((s) => styleIds.includes(s.id)), ...filtered.slice(0, VISIBLE)].map((s) => [s.id, s])).values()];

  function createStyle() {
    const name = query.trim();
    if (styleIds.length >= LOOK_LIMITS.styles) return toast.info("Elige hasta 6 estilos.");
    startTransition(async () => {
      const res = await createStyleForLook(name);
      if (!res.ok) return void toast.error(res.error);
      setStyles((list) => (list.some((s) => s.id === res.tag.id) ? list : [res.tag, ...list]));
      setQuery("");
      const nextStyles = styleIds.includes(res.tag.id) ? styleIds : [...styleIds, res.tag.id];
      const r2 = await setLookTags(postId, { styleIds: nextStyles, occasionIds });
      if (!r2.ok) return void toast.error(r2.error);
      setStyleIds(nextStyles);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <legend className="text-label text-text">Estilo</legend>
          <span className="text-[13px] text-text-muted tabular-nums">
            {styleIds.length} de {LOOK_LIMITS.styles}
          </span>
        </div>
        <label className="relative">
          <span className="sr-only">Buscar estilo</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar o crear un estilo"
            className="pl-9"
            maxLength={30}
          />
        </label>
        <div className="flex flex-wrap gap-x-2" role="group" aria-label="Estilos">
          {visible.map((s) => (
            <Chip key={s.id} selected={styleIds.includes(s.id)} onClick={() => toggleStyle(s.id)}>
              {s.name}
            </Chip>
          ))}
          {q && !exact && query.trim().length >= 2 && (
            <Chip onClick={createStyle} disabled={pending}>
              <PlusIcon className="size-3.5" aria-hidden /> Crear &ldquo;{query.trim()}&rdquo;
            </Chip>
          )}
        </div>
        {!q && styles.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-fit text-sm font-medium text-action-text hover:underline"
          >
            {showAll ? "Ver menos" : `Ver todos (${styles.length})`}
          </button>
        )}
      </fieldset>

      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <legend className="text-label text-text">Ocasión</legend>
          <span className="text-[13px] text-text-muted tabular-nums">
            {occasionIds.length} de {LOOK_LIMITS.occasions}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-2" role="group" aria-label="Ocasiones">
          {occasions.map((o) => (
            <Chip key={o.id} selected={occasionIds.includes(o.id)} onClick={() => toggleOccasion(o.id)}>
              {o.name}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
