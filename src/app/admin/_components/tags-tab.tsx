import { GlassCard } from "@/components/glass-card";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { SectionHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAG_LABELS, type TagType } from "@/lib/tags";
import { Textarea } from "@/components/ui/textarea";
import {
  addStopwords,
  createTag,
  deleteStopword,
  deleteSynonymGroup,
  deleteTag,
  renameTag,
  saveSynonymGroup,
} from "../actions";

export type AdminTag = { id: string; name: string; slug: string; type: TagType; uses: number };

const TYPES: TagType[] = ["style", "occasion", "temperature", "category"];

/**
 * Vocabulario fijo de etiquetas (decisión 1 del spec 2026-10-06). Renombrar cambia solo el
 * nombre visible: el slug sigue igual porque está en las URLs de los filtros. Una etiqueta en
 * uso no se puede borrar (el borrado en cascada vaciaría filtros sin avisar).
 */
export function TagsTab({
  tags,
  synonyms,
  stopwords,
}: {
  tags: AdminTag[];
  synonyms: { id: string; terms: string[] }[];
  stopwords: string[];
}) {
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

      <SearchVocabulary synonyms={synonyms} stopwords={stopwords} />
    </div>
  );
}

/**
 * Sinónimos: cada grupo son palabras equivalentes en la búsqueda ("hoodie" encuentra "capucha").
 * Un sinónimo solo coincide como palabra completa. Palabras ignoradas: se quitan de la consulta
 * ("marcas tropicales" busca "tropicales"). Los cambios aplican en la siguiente búsqueda.
 */
function SearchVocabulary({
  synonyms,
  stopwords,
}: {
  synonyms: { id: string; terms: string[] }[];
  stopwords: string[];
}) {
  return (
    <>
      <section>
        <SectionHeader
          title={`Sinónimos (${synonyms.length})`}
          description="Palabras que la búsqueda trata como iguales, separadas por coma."
        />
        <ul className="mt-3 flex flex-col gap-2">
          {synonyms.map((g) => (
            <li key={g.id} className="glass-input flex flex-wrap items-start gap-2 rounded-xl p-2">
              <form action={saveSynonymGroup} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                <input type="hidden" name="id" value={g.id} />
                <Textarea
                  name="terms"
                  defaultValue={g.terms.join(", ")}
                  rows={1}
                  aria-label="Sinónimos"
                  className="min-h-10 flex-1 resize-y"
                />
                <Button type="submit" variant="outline" size="sm" className="rounded-full sm:self-center">
                  Guardar
                </Button>
              </form>
              <form action={deleteSynonymGroup}>
                <input type="hidden" name="id" value={g.id} />
                <Button type="submit" variant="ghost" size="sm" className="rounded-full text-coral">
                  Borrar
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveSynonymGroup} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField label="Nuevo grupo" htmlFor="syn-new" className="flex-1">
            <Input id="syn-new" name="terms" required placeholder="falda, skirt" />
          </FormField>
          <Button type="submit" className="rounded-full sm:px-6">
            Agregar grupo
          </Button>
        </form>
      </section>

      <section>
        <SectionHeader
          title={`Palabras ignoradas (${stopwords.length})`}
          description="Se quitan de la búsqueda para que no exijan coincidir."
        />
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {stopwords.map((w) => (
            <li key={w}>
              <form action={deleteStopword} className="glass-input flex items-center gap-1 rounded-full py-0.5 pr-1 pl-3 text-sm">
                <input type="hidden" name="word" value={w} />
                {w}
                <button
                  type="submit"
                  aria-label={`Quitar ${w}`}
                  className="flex size-7 items-center justify-center rounded-full text-ink/50 hover:bg-coral/10 hover:text-coral"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addStopwords} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField label="Agregar palabras" htmlFor="stop-new" className="flex-1">
            <Input id="stop-new" name="words" required placeholder="tienda, moda" />
          </FormField>
          <Button type="submit" className="rounded-full sm:px-6">
            Agregar
          </Button>
        </form>
      </section>
    </>
  );
}
