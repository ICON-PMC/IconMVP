-- OAuth (Google): el proveedor manda el nombre en raw_user_meta_data como
-- full_name / name (no como display_name, que es la clave del signup por email).
-- Tomamos el primero disponible para que el perfil no entre con nombre vacío.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ), '')
  );
  return new;
end; $$;
