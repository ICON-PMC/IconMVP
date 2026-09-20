-- Grupo 7 (auditoría RLS) de specs/2026-09-19-brand-registration.
-- Hueco encontrado: `posts_owner_all` deja a la dueña de una marca escribir cualquier `status`,
-- así que una marca aún no aprobada podía dejar un post en 'published'. La lectura pública
-- (`posts_read`: status = 'published') lo servía directo desde la API aunque el feed y /post/[id]
-- lo ocultaran. Mismo criterio que `garments_protect_status`: solo una marca aprobada
-- (status = 'active') puede publicar; si no, el post queda en 'draft'.
create or replace function public.protect_post_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff()
     and new.status = 'published' and new.author_brand_id is not null
     and not exists (select 1 from public.brands b where b.id = new.author_brand_id and b.status = 'active') then
    new.status := 'draft';
    new.published_at := null;
  end if;
  return new;
end; $$;

drop trigger if exists posts_protect_status on posts;
create trigger posts_protect_status
  before insert or update on posts
  for each row execute function public.protect_post_status();
