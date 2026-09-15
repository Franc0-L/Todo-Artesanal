begin;
select plan(15);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'noadmin@test.local')
on conflict (id) do nothing;

insert into private.admin_users (user_id)
values ('11111111-1111-1111-1111-111111111111')
on conflict do nothing;

insert into public.clientes (id, nombre, token, activo)
values ('33333333-3333-3333-3333-333333333333', 'Cliente de prueba', 'token-de-prueba-test', true)
on conflict (id) do nothing;

insert into public.platos (id, nombre, clima, activo)
values
  ('44444444-4444-4444-4444-444444444444', 'Plato General Test', 'cualquiera', true),
  ('55555555-5555-5555-5555-555555555555', 'Plato Opcional Test', 'cualquiera', true)
on conflict (id) do nothing;

insert into public.semanas (id, fecha_inicio, precio_general, precio_opcional, activa)
values ('66666666-6666-6666-6666-666666666666', '2026-09-14', 1000, 1200, true)
on conflict (id) do nothing;

insert into public.dias_menu (id, semana_id, dia_semana, fecha, plato_general_id, plato_opcional_id)
values (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  'lunes', '2026-09-14',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
)
on conflict (id) do nothing;

set local role anon;
reset request.jwt.claims;

select throws_ok(
  'select * from public.clientes',
  '42501',
  null,
  'anon no puede leer clientes (permission denied, no solo RLS)'
);

select throws_ok(
  'select * from public.pedidos',
  '42501',
  null,
  'anon no puede leer pedidos'
);

select throws_ok(
  'select public.crear_semana(''2026-09-21''::date, 1000, 1200, ''[]''::jsonb)',
  '42501',
  null,
  'anon no puede ejecutar crear_semana (sin grant de execute)'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is_empty(
  'select * from public.clientes',
  'usuario autenticado no-admin ve la tabla clientes vacía (RLS lo filtra)'
);

select is_empty(
  'select * from public.platos',
  'usuario autenticado no-admin ve la tabla platos vacía'
);

select throws_ok(
  'select public.crear_semana(''2026-09-21''::date, 1000, 1200, ''[]''::jsonb)',
  null,
  'No autorizado',
  'crear_semana rechaza a un autenticado que no es admin'
);

reset role;
reset request.jwt.claims;

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select isnt_empty(
  'select * from public.clientes',
  'el admin sí ve la tabla clientes'
);

select isnt_empty(
  'select * from public.semanas',
  'el admin sí ve la tabla semanas'
);

select lives_ok(
  $$ update public.clientes set nombre = 'Cliente de prueba (editado)'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'el admin puede editar un cliente'
);

reset role;
reset request.jwt.claims;

set local role anon;

select isnt_empty(
  $$ select * from public.get_client_menu('token-de-prueba-test') $$,
  'get_client_menu devuelve el menú para un token válido'
);

select is_empty(
  $$ select * from public.get_client_menu('token-que-no-existe') $$,
  'get_client_menu no devuelve nada para un token inválido'
);

select lives_ok(
  $$ select public.submit_order('token-de-prueba-test', '77777777-7777-7777-7777-777777777777'::uuid, 'general') $$,
  'submit_order acepta un pedido válido del cliente de prueba'
);

reset role;

select isnt_empty(
  $$ select * from public.pedidos where cliente_id = '33333333-3333-3333-3333-333333333333' $$,
  'el pedido insertado por submit_order quedó en la tabla'
);

select * from finish();
rollback;
