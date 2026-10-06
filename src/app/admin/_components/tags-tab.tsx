import { GlassCard } from "@/components/glass-card";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { SectionHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAG_LABELS, type TagType } from "@/lib/tags";
import { createTag, deleteTag, renameTag } from "../actions";

export type AdminTag = { id: string; name: string; slug: string; type: TagType; uses: number };

const TYPES: TagType[] = ["style", "occasion", "temperature", "category"];

/**
 * Vocabulario fijo de etiquetas (decisión 1 del spec 2026-10-06). Renombrar cambia solo el
 * nombre visible: el slug sigue igual porque está en las URLs de los filtros. Una etiqueta en
 * uso no se puede borrar (el borrado en cascada vaciaría filtros sin avisar).
 */
export function TagsTab({ tags }: { tags: AdminTag[] }) {
  return (
    <div className="space-y-6">
      <GlassCard className="p-5">
        <form action={createTag} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <FormField label="Tipo" htmlFor="t-type" className="sm:w-48">
            <NativeSelect id="t-type" name="type" defaultValue="style">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TAG_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Nombre" htmlFor="t-name" className="flex-1">
            <Input id="t-name" name="name" required maxLength={40} placeholder="Ej. Tropical" />
          </FormField>
          <Button type="submit" className="rounded-full sm:px-6">
            Crear etiqueta
          </Button>
        </form>
      </GlassCard>

      {TYPES.map((type) => {
        const list = tags.filter((t) => t.type === type);
        return (
          <section key={type}>
            <SectionHeader title={`${TAG_LABELS[type]} (${list.length})`} />
            <ul className="mt-3 flex flex-col gap-2">
              {list.map((t) => (
                <li key={t.id} className="glass-input flex flex-wrap items-center gap-2 rounded-xl p-2">
                  <form action={renameTag} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <Input
                      name="name"
                      defaultValue={t.name}
                      required
                      maxLength={40}
                      aria-label={`Nombre de ${t.name}`}
                      className="min-w-0 flex-1"
                    />
                    <Button type="submit" variant="outline" size="sm" className="rounded-full">
                      Renombrar
                    </Button>
                  </form>
                  <span className="text-xs text-ink/50">
                    {t.uses} {t.uses === 1 ? "uso" : "usos"}
                  </span>
                  <form action={deleteTag}>
                    <input type="hidden" name="id" value={t.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      disabled={t.uses > 0}
                      title={t.uses > 0 ? "Está en uso: no se puede borrar." : undefined}
                      className="rounded-full text-coral"
                    >
                      Borrar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
