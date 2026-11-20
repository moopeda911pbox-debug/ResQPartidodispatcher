-- ResQPartido — keep names and municipalities in Title Case at the database level.
--
-- Why: the dispatcher app now title-cases what it displays and what an admin
-- types, but the citizen app, seed scripts and the Supabase dashboard can still
-- write "juan DELA cruz" / "GOA" straight into the tables. This trigger fixes
-- those on the way in, so every screen and export reads the same.
--
-- Safe to re-run. Run once in the Supabase SQL editor.

-- 1) Normaliser: trims, collapses repeated spaces, Title Cases ("goa  jurisdiction" -> "Goa Jurisdiction").
create or replace function public.normalize_person_text(value text)
returns text
language sql
immutable
as $$
  select nullif(initcap(regexp_replace(btrim(value), '\s+', ' ', 'g')), '');
$$;

-- 2) profiles: first_name, last_name, municipality
create or replace function public.profiles_normalize_text()
returns trigger
language plpgsql
as $$
begin
  new.first_name   := public.normalize_person_text(new.first_name);
  new.last_name    := public.normalize_person_text(new.last_name);
  new.municipality := public.normalize_person_text(new.municipality);
  return new;
end;
$$;

drop trigger if exists profiles_normalize_text on public.profiles;
create trigger profiles_normalize_text
  before insert or update of first_name, last_name, municipality on public.profiles
  for each row execute function public.profiles_normalize_text();

-- 3) call_logs keeps name snapshots — normalise those too
do $$
begin
  if to_regclass('public.call_logs') is not null then
    execute $f$
      create or replace function public.call_logs_normalize_text()
      returns trigger language plpgsql as $t$
      begin
        new.citizen_name    := public.normalize_person_text(new.citizen_name);
        new.dispatcher_name := public.normalize_person_text(new.dispatcher_name);
        new.municipality    := public.normalize_person_text(new.municipality);
        return new;
      end;
      $t$
    $f$;
    execute 'drop trigger if exists call_logs_normalize_text on public.call_logs';
    execute 'create trigger call_logs_normalize_text before insert or update of citizen_name, dispatcher_name, municipality on public.call_logs for each row execute function public.call_logs_normalize_text()';
  end if;
end $$;

-- 4) One-time clean-up of rows that are already saved.
update public.profiles
   set first_name   = public.normalize_person_text(first_name),
       last_name    = public.normalize_person_text(last_name),
       municipality = public.normalize_person_text(municipality)
 where first_name   is distinct from public.normalize_person_text(first_name)
    or last_name    is distinct from public.normalize_person_text(last_name)
    or municipality is distinct from public.normalize_person_text(municipality);

do $$
begin
  if to_regclass('public.call_logs') is not null then
    update public.call_logs
       set citizen_name    = public.normalize_person_text(citizen_name),
           dispatcher_name = public.normalize_person_text(dispatcher_name),
           municipality    = public.normalize_person_text(municipality)
     where citizen_name    is distinct from public.normalize_person_text(citizen_name)
        or dispatcher_name is distinct from public.normalize_person_text(dispatcher_name)
        or municipality    is distinct from public.normalize_person_text(municipality);
  end if;
end $$;
