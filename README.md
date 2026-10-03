# Todo Artesanal

Aplicación para gestionar un emprendimiento de viandas.

Dos áreas principales:

- **`/admin`** — Panel de administración privado (clientes, platos, menús, semanas, pedidos, cancelaciones, historial).
- **`/menu/:token`** — Menú personalizado por cliente, sin autenticación tradicional.

Los clientes no se registran. Reciben un link personal y desde ahí
arman su pedido de la semana activa.

---

## Stack

| Capa     | Tecnología                                       |
| -------- | ------------------------------------------------ |
| Frontend | React 19 + Vite 8 + TypeScript 6                 |
| Backend  | Supabase (PostgreSQL 17 + Auth + Edge Functions) |
| Estilos  | CSS por feature con tokens semánticos            |
| Linting  | ESLint 10                                        |

---

## Estado del proyecto

- ✅ **Fases 1–4** — Dominio, modelo conceptual, modelo PostgreSQL, RLS, funciones y triggers.
- ✅ **Fase 5** — Migraciones, tipos, servicios y las dos Edge Functions (`rotate-client-token`, `authenticate-client-token`).
- ✅ **Fase 6** — UI de admin completa (`/admin`) y UI de cliente en `/menu/:token` (oferta, pedidos, cancelaciones y media vianda del catálogo).
- ✅ **Fase 7A** — Reportes: montos consolidados en PostgreSQL (RPC `get_week_report`) y página `/admin/reportes`.
- ⏳ **Fase 7B** — Tests de invariantes contra la DB real (pgTAP + `supabase test db`).

**Verificación end-to-end (2026-10-02):** con el proyecto Supabase
`zarvihhrzfcvlegqygnu` se validó el ciclo completo por API: login admin →
`is_user_admin` → `rotate-client-token` → `authenticate-client-token` (JWT
**ES256**) → lecturas de cliente (`week_days`, `list_client_catalog`,
`calculate_my_order_price`) → escritura de pedidos y cancelaciones con sus
invariantes (precio congelado, exclusión mutua, RLS).

**Reportes (2026-10-02):** `get_week_report` verificado por PostgREST con JWT de
admin (devuelve el payload completo) y con un usuario `authenticated` sin fila
en `private.admin_users` (rechaza con `P0001`).

Ver `docs/estado-fases-1-6.md` para el estado consolidado completo
(incluida la **reconciliación de migraciones**) y `docs/README.md` para
el índice de documentación.

---

## Estructura del proyecto

```
Todo-Artesanal/
├── docs/                   Documentación (ver docs/README.md)
│   ├── adr/                Architecture Decision Records
│   └── decisiones/         Decisiones de dominio fechadas
├── src/
│   ├── app/                Router propio (AppRouter, routes)
│   ├── features/           UI + servicios organizados por feature
│   │   ├── admin/          Sección admin compartida
│   │   ├── auth/           Sesión del admin (Supabase Auth)
│   │   ├── cancelaciones/
│   │   ├── clientes/
│   │   ├── dashboard/
│   │   ├── historial/
│   │   ├── menu/           Vista del cliente /menu/:token
│   │   ├── menus/
│   │   ├── pedidos/
│   │   ├── platos/
│   │   └── semanas/
│   ├── components/ui/      Primitivas compartidas (ConfirmDialog, EmptyState)
│   ├── lib/                Helpers compartidos (errors, formatters, supabase, theme)
│   ├── types/              Tipos generados y de dominio
│   ├── App.tsx
│   ├── index.css           Tokens de tema (claro/oscuro)
│   └── main.tsx
├── supabase/
│   ├── functions/          Edge Functions (Deno)
│   │   ├── authenticate-client-token/
│   │   └── rotate-client-token/
│   ├── migrations/         Migraciones SQL
│   └── config.toml
├── .env.example          Plantilla de .env.local (commiteada)
├── .env.local              Variables de entorno (no commiteado)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Conceptos principales

El dominio se divide en cuatro conceptos que no deben mezclarse:

```
Oferta / Semana  = qué se ofrece
Cliente          = qué tiene configurado actualmente
Pedido           = qué eligió realmente
Historial        = qué ocurrió y bajo qué contexto
```

Regla maestra: una modificación posterior de la configuración actual
nunca debe alterar retrospectivamente el significado de un hecho
histórico.

Ver `docs/dominio.md` para el detalle.

---

## Cómo levantar el proyecto

### Requisitos

- Node.js 20+
- npm
- Supabase CLI (`npx supabase` funciona sin instalación global)
- Docker Desktop (con backend WSL2) o Docker Engine — solo para el stack local

### Variables de entorno

El repo trae plantillas **commiteadas** (con placeholders o valores públicos)
para cada archivo secreto; los reales son gitignored y se crean con:

```bash
npm run env:init      # crea los que falten; nunca pisa los existentes
npm run env:cloud     # .env.local -> proyecto en la nube (o env:local)
```

| Plantilla                            | Genera (gitignored)          |
| ------------------------------------ | ---------------------------- |
| `.env.example`                       | `.env.local`                 |
| `supabase/.env.example`              | `supabase/.env.local`        |
| `supabase/signing_keys.example.json` | `supabase/signing_keys.json` |

Detalle (qué lleva cada uno, dónde salen los valores y checklist de migración a
otra máquina): `docs/entorno-y-secretos.md`.

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

Servidor local en `http://localhost:5173`.

### Compilación y verificación

```bash
npm run build       # compila para producción (tsc + vite build)
npx tsc -b          # solo chequeo de tipos (más rápido)
npm run lint        # ESLint
npm run preview     # sirve el build de producción local
```

---

### Probar localmente (stack de Docker)

El stack local es **independiente** del proyecto en la nube: `project_id`
`todo-artesanal`, su propia base (las 6 migraciones) y su propio admin.

```bash
npm run supabase:start   # stack local + secretos de Edge Functions
npm run env:local        # .env.local apunta a 127.0.0.1:54321
npm run dev              # http://localhost:5173
```

`npm run env:cloud` vuelve el frontend al proyecto en la nube.

**Por qué `npm run supabase:start` y no `npx supabase start`:** los secretos
de las Edge Functions viven en `supabase/.env.local` (gitignored) y llegan al
contenedor por la resolución `env(VAR)` de `[edge_runtime.secrets]` en
`supabase/config.toml`. Sin esas variables el arranco **termina OK igual**,
pero `authenticate-client-token` falla recién cuando lo llamás, con
_"Configuración del servidor incompleta"_. El script corta de arranque si
falta el archivo.

**Por qué `signing_keys_path`** (en `config.toml`): GoTrue local debe servir
la clave pública en su JWKS para que el PostgREST local valide el **JWT
ES256** que emite el cliente. Apunta a `supabase/signing_keys.json`, que
guarda la JWK en forma de array (`[{...}]`).

**Archivos locales** (gitignored, no viajan en git — hay que crearlos en cada
clone; `npm run env:init` los arma desde las plantillas):

| Archivo                      | Contenido                                                              | Plantilla                            |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| `supabase/.env.local`        | `CLIENT_JWT_PRIVATE_KEY_JWK` (objeto JWK, no array) + `CLIENT_JWT_KID` | `supabase/.env.example`              |
| `supabase/signing_keys.json` | `[` + esa misma JWK + `]`                                              | `supabase/signing_keys.example.json` |
| `.env.local`                 | URL y publishable key del frontend (lo escribe `npm run env:*`)        | `.env.example`                       |

Los dos de `supabase/` son **la misma clave en dos formas**; para mudarse de
compu alcanza con copiar **uno** y correr `npm run env:init` (deriva el otro).
Ver `docs/entorno-y-secretos.md`.

**Credenciales locales:** el mismo admin que en la nube
(`francoleonettu123@gmail.com`). El usuario se crea contra el Auth local y
se habilita con una fila en `private.admin_users`.

> ⚠️ **`npx supabase db reset` recrea la base y borra `auth.users` y
> `private.admin_users`.** Para volver a sembrar el admin:
>
> ```bash
> # SERVICE_ROLE_KEY lo da: npx supabase status -o env
> curl -sX POST http://127.0.0.1:54321/auth/v1/admin/users \
>   -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{"email":"<mail>","password":"<pass>","email_confirm":true}'
>
> docker exec -i supabase_db_todo-artesanal psql -U postgres -d postgres \
>   -c "insert into private.admin_users (user_id) values ('<id>') on conflict do nothing;"
> ```

La base local no viene con datos: `supabase stop` preserva el volumen, pero
`db reset` la deja vacía (migraciones 6/6, 15 tablas `public`).

---

## Base de datos

### Migraciones

Las migraciones viven en `supabase/migrations/` y son **6 archivos por
responsabilidad** (consolidados 2026-10-02; reproducen el esquema final,
validado con `db reset` + `pg_dump --schema-only` diff = 0 diferencias):

| #   | Archivo                            | Responsabilidad                                                       |
| --- | ---------------------------------- | --------------------------------------------------------------------- |
| 1   | `20261002000001_schema`            | schemas, 15 tablas + `private.admin_users`, constraints, índices, RLS |
| 2   | `20261002000002_functions_private` | 17 funciones de `private` (helpers + trigger fns) y sus grants        |
| 3   | `20261002000003_triggers`          | 17 triggers de dominio + su función de soporte                        |
| 4   | `20261002000004_rls`               | 30 policies (frontera de seguridad)                                   |
| 5   | `20261002000005_rpc_admin`         | RPCs de admin/catálogo/precio interno                                 |
| 6   | `20261002000006_rpc_client`        | RPCs de cliente (`security definer`)                                  |

Se aplican contra un proyecto Supabase linkeado con:

```bash
npx supabase db push --dry-run   # revisar primero
npx supabase db push --yes
```

> Proyecto linkeado: **`zarvihhrzfcvlegqygnu`** (`Todo-Artesanal`). Las 6
> migraciones ya están aplicadas y `npx supabase migration list` muestra
> local y remoto en sync. La cadena vieja (20 migraciones) quedó en el repo
> `Todo-Artesanal-Legacy`.

### Regenerar tipos TypeScript

Cuando cambia el schema, regenerar los tipos:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

**Nunca** editar `database.ts` a mano.

---

### Consultas SQL directas

`npx supabase db query` **no conecta desde esta red**: el host directo
`db.<project-ref>.supabase.co` publica únicamente un registro AAAA (IPv6) y
este equipo no tiene IPv6; además el DNS del ISP secuestra los nombres
desconocidos (`…supabase.co.com.ar`). El error es
`getaddrinfo ENOTFOUND db.<project-ref>.supabase.co`.

La vía que sí funciona es el **pooler** con `psql` (puerto `5432`, modo
_session_: admite transacciones y DDL):

```bash
PGPASSWORD=<db-password> psql \
  -h aws-0-sa-east-1.pooler.supabase.com -p 5432 \
  -U postgres.<project-ref> -d postgres \
  -c "<consulta>"
```

El host del pooler queda en `supabase/.temp/pooler-url`. Por eso
`supabase db push` y `migration list` **sí** funcionan (usan ese pooler) y
`db query` no.

> Si alguna vez hace falta borrar datos de prueba, ojo: `dish_versions` y
> `menu_versions` son **inmutables por trigger** (`prevent_*_version_mutation`),
> así que un `DELETE` por REST/SQL siempre se rechaza. `TRUNCATE` no dispara
> triggers de fila y es el camino para limpiar artefactos propios.

---

## Edge Functions

### `rotate-client-token`

Genera un nuevo token personal para un cliente.

- **Método:** POST
- **Auth:** requiere JWT de admin en `Authorization: Bearer <jwt>`
- **Body:** `{ clientId: uuid }`
- **Respuesta:** `{ token: string, clientId: string }`

El token plaintext se devuelve **una única vez** y nunca se persiste en
frontend. El servidor guarda solo el hash SHA-256.

### `authenticate-client-token`

Canjea el token de un enlace `/menu/:token` por un JWT de sesión.

- **Método:** POST
- **Auth:** ninguna en la llamada (`verify_jwt = false`); la credencial
  es el propio token del link
- **Body:** `{ token: string }`
- **Respuesta:** `{ accessToken: string, clientId: string, expiresIn: number }`
- **Firma:** ES256 con la signing key del proyecto (secrets
  `CLIENT_JWT_PRIVATE_KEY_JWK` y `CLIENT_JWT_KID`), TTL 1 hora
- **Requisito:** la signing key tiene que estar **activa** en el panel
  (Auth → Signing Keys) y su pública publicada en el JWKS; si no, PostgREST
  rechaza el JWT. Procedimiento y errores típicos en
  `docs/decisiones/20261001-cliente-jwt-es256-signing-key.md`.

### Deploy

```bash
# 1. Signing key ES256 del JWT de cliente.
npx supabase gen signing-key --algorithm ES256
#    → confirmar en el panel que la clave queda Active
# 2. Secrets de la funcion (secrets set --env-file <archivo>):
#    CLIENT_JWT_PRIVATE_KEY_JWK=<jwk privada> / CLIENT_JWT_KID=<kid>
# 3. Deploy.
npx supabase functions deploy rotate-client-token
npx supabase functions deploy authenticate-client-token
```

Los dos fallos típicos de este paso (secret sin cargar y `key_ops` incompatible
con la firma) están en
`docs/decisiones/20261001-cliente-jwt-es256-signing-key.md`.

---

## RLS y seguridad

- **Frontera real:** RLS + constraints + funciones de PostgreSQL.
- **Frontend:** no es frontera de seguridad.
- **Admin:** autenticado con Supabase Auth, autorizado en `private.admin_users`.
- **Cliente:** sin cuenta. Su enlace se canjea por un JWT con claim
  `client_id` (Edge Function `authenticate-client-token`); las policies
  limitan todo a sus propios datos + la oferta activa.

Ver `docs/arquitectura.md` y `docs/modelo-datos.md`.

---

## Testing

No hay tests automatizados todavía. La Fase 7B los agrega con **pgTAP** sobre el
stack local (`npx supabase test db`, con Docker levantado). Ver
`docs/estado-fases-1-6.md` sección "Pendientes" para el plan de tests de
invariantes.

Verificación manual disponible:

```bash
npx tsc -b          # chequeo de tipos
npm run lint        # chequeo de estilo
npm run build       # compilación completa
```

---

## Documentación

Toda la documentación está en `docs/` (índice completo en
`docs/README.md`):

- **`historico/prompt.md`** — Contrato completo del proyecto (histórico, no se actualiza).
- **`estado-fases-1-6.md`** — Estado consolidado: qué está hecho, inventario de migraciones/servicios/UI y pendientes.
- **`arquitectura.md`** — Capas, patrones de datos, Edge Functions y diagramas.
- **`dominio.md`** — Conceptos, invariantes y reglas del negocio.
- **`modelo-datos.md`** — Esquema PostgreSQL, ERD y migraciones.
- **`flujos.md`** — Secuencias operativas típicas (13 flujos).
- **`servicios.md`** — Catálogo de la capa de servicios.
- **`glosario.md`** — Términos del dominio.
- **`decisiones/`** — Decisiones de dominio fechadas.
- **`adr/`** — Architecture Decision Records (`001`–`005` escritos).

---

## Flujo operativo

Resumen del ciclo de una semana:

```
1. Admin crea semana (draft)          → createWeek
2. Admin configura oferta por día     → addDayOption (General + Opcional)
     └─ un producto no se repite entre días
3. Admin activa la semana             → activateWeek
     └─ valida 5 días, General+Opcional por día, menús con 1 main
     └─ se congela week_expected_clients
4. Cliente abre su enlace             → authenticate-client-token (JWT 1 h)
5. Clientes piden/cancelan            → createOrder / createCancellation
6. Admin cierra la semana             → closeWeek
     └─ datos históricos inmutables
7. Admin consulta historial           → getClientHistory / listHistoricalWeeks
8. Admin consulta montos consolidados → getWeekReport (RPC get_week_report)
```

Ver `docs/flujos.md` para el detalle de cada paso.

---

## Roadmap

### Completado

- [x] Dominio y reglas de negocio
- [x] Modelo de datos PostgreSQL (RLS, funciones, triggers, RPCs)
- [x] Capa de servicios TypeScript
- [x] Edge Functions `rotate-client-token` y `authenticate-client-token`
- [x] UI de admin (`/admin`: dashboard, clientes, platos, menús, semanas, pedidos, cancelaciones, historial)
- [x] Sesión y estados en `/menu/:token`
- [x] Estrategia de estilos (tokens semánticos + CSS por feature)
- [x] Documentación de estado, arquitectura, servicios y flujos

### Próximo

- [x] **Migraciones consolidadas** (2026-10-02) en 6 archivos por
      responsabilidad; la narrativa de la reconciliación previa quedó
      archivada en `docs/historico/`.
- [x] Verificar el camino de éxito del JWT con un enlace real (hecho 2026-10-01)
- [x] UI de oferta y pedidos en `/menu/:token`
- [x] Media vianda desde el catálogo para el cliente (RPC
      `list_client_catalog` + `ClientCatalogPicker`)
- [x] **Reportes** (2026-10-02): montos consolidados en PostgreSQL con el RPC
      `get_week_report` (migración `20261002000007_rpc_reports`) y página
      `/admin/reportes` (totales, por día, modalidad, producto, cliente y sin
      responder)
- [ ] Tests de invariantes contra la DB real
- [x] ADRs `001`–`005` escritos (`versionado-inmutable`,
      `media-vianda-es-modalidad`, `precio-congelado-en-pedido`,
      `jwt-custom-para-clientes`, `semana-no-pertenece-a-cliente`)
- [ ] Realtime: descartado por ahora (la UI refresca por `reload()`)

### Descartado por ahora

- Integración con WhatsApp
- Estadísticas avanzadas
- Generación automática de flyers

---

## Licencia

Proyecto privado. Sin licencia pública por ahora.
