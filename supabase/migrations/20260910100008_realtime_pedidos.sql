-- Todo Artesanal — 08: asegurar Realtime sobre pedidos
-- Sin esto, el canal "pedidos-en-vivo" de AdminPanel.jsx puede no recibir nunca
-- un evento, según cómo haya quedado configurada la publicación por defecto
-- en tu proyecto de Supabase.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
