-- Roles de usuario y políticas para el equipo (staff) que carga contenido.

-- ============================================================
-- Rol del usuario
-- ============================================================
create type user_role as enum ('user', 'curator', 'admin');
alter table users add column role user_role not null default 'user';

-- Extiende el alta para guardar display_name desde la metadata del signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_id, email, display_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end; $$;

-- ¿El usuario autenticado es staff (curator o admin)?
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_id = auth.uid() and role in ('curator', 'admin')
  );
$$;

-- ============================================================
-- Policies de staff: leer (incluye borradores) y escribir contenido.
-- Se suman (OR) a las policies de lectura pública existentes.
-- ============================================================
create policy cities_staff_write       on cities             for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy tags_staff_write          on tags               for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy sizes_staff_write         on sizes              for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy brands_staff_all          on brands             for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy garments_staff_all        on garments           for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy garment_images_staff_all  on garment_images     for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy garment_tags_staff_all    on garment_tags       for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy garment_sizes_staff_all   on garment_sizes      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy posts_staff_all           on posts              for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy post_images_staff_all     on post_images        for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy post_items_staff_all      on post_items         for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy post_tags_staff_all       on post_tags          for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy post_brand_reviews_staff  on post_brand_reviews for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Grants base para escritura como staff (RLS limita a curator/admin via las policies de arriba).
grant insert, update, delete on
  cities, tags, sizes, brands, garments, garment_images, garment_tags, garment_sizes,
  posts, post_images, post_items, post_tags, post_brand_reviews
to authenticated;
