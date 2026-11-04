-- Row level security performance.
-- Every policy expression is a single call to crm.is_staff() or
-- crm.has_role(...). Wrapping it in a scalar subquery lets Postgres evaluate
-- it once per statement instead of once per row, which matters on joined
-- listings such as guests and bookings.
do $$
declare
  p record;
  q text;
  w text;
begin
  for p in select policyname, tablename, qual, with_check from pg_policies where schemaname = 'crm' loop
    q := case when p.qual is not null and p.qual not like '(select %' then '(select ' || p.qual || ')' else p.qual end;
    w := case when p.with_check is not null and p.with_check not like '(select %' then '(select ' || p.with_check || ')' else p.with_check end;
    if q is not null and w is not null then
      execute format('alter policy %I on crm.%I using (%s) with check (%s)', p.policyname, p.tablename, q, w);
    elsif q is not null then
      execute format('alter policy %I on crm.%I using (%s)', p.policyname, p.tablename, q);
    elsif w is not null then
      execute format('alter policy %I on crm.%I with check (%s)', p.policyname, p.tablename, w);
    end if;
  end loop;
end $$;
