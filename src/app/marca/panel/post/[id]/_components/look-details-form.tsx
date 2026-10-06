import { FormField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { replacePostImage, updatePostCaption } from "../../../actions";

/** Texto y foto del look: dos formularios separados para no subir una foto al cambiar el texto. */
export function LookDetailsForm({ postId, caption }: { postId: string; caption: string | null }) {
  return (
    <div className="space-y-5">
      <form action={updatePostCaption} className="flex flex-col gap-3">
        <input type="hidden" name="post_id" value={postId} />
        <FormField label="Texto" htmlFor="look-caption">
          <Textarea
            id="look-caption"
            name="caption"
            rows={3}
            maxLength={2200}
            defaultValue={caption ?? ""}
          />
        </FormField>
        <SubmitButton variant="outline" pendingText="Guardando…" className="self-start rounded-full">
          Guardar texto
        </SubmitButton>
      </form>
      <form action={replacePostImage} className="flex flex-col gap-3">
        <input type="hidden" name="post_id" value={postId} />
        <FormField label="Cambiar foto" htmlFor="look-image">
          <Input id="look-image" name="image" type="file" accept="image/*" required />
        </FormField>
        <SubmitButton variant="outline" pendingText="Subiendo…" className="self-start rounded-full">
          Cambiar foto
        </SubmitButton>
      </form>
    </div>
  );
}
