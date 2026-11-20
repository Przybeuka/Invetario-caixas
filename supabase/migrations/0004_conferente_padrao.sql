-- Contas novas entram como conferente (o primeiro usuário continua admin).
create or replace function public.criar_perfil()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    case when exists (select 1 from public.perfis where papel = 'admin')
      then 'conferente'::public.papel
      else 'admin'::public.papel
    end
  );
  return new;
end;
$$;

alter table public.perfis alter column papel set default 'conferente';

-- Quem estava aguardando passa a conferente, como as contas novas.
update public.perfis set papel = 'conferente' where papel = 'pendente';
