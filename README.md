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
| Estilos  | CSS (estrategia pendiente)                       |
| Linting  | ESLint 10                                        |

---

## Estado del proyecto

- ✅ **Fases 1–4** — Dominio, modelo conceptual, modelo PostgreSQL, RLS, funciones y triggers.
- ✅ **Fase 5** — Migraciones aplicadas, tipos, servicios, Edge Function `rotate-client-token`.
- ⏳ **Fase 6+** — UI admin, UI cliente, emisión de JWT para clientes.

Ver `docs/estado-fases-1-5.md` para el estado consolidado completo.

---

## Estructura del proyecto

```
Todo-Artesanal/
├── docs/                   Documentación (dominio, modelo, flujos, ADRs)
├── src/
│   ├── features/           Servicios organizados por feature
│   │   ├── cancelaciones/
│   │   ├── clientes/
│   │   ├── historial/
│   │   ├── menus/
│   │   ├── pedidos/
│   │   ├── platos/
│   │   └── semanas/
│   ├── lib/                Helpers compartidos (errores, formatters, supabase client)
│   ├── types/              Tipos generados y de dominio
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── supabase/
│   ├── functions/          Edge Functions (Deno)
│   │   └── rotate-client-token/
│   ├── migrations/         Migraciones SQL
│   └── config.toml
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

### Variables de entorno

Crear `.env.local` en la raíz:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Los valores se obtienen de Supabase Dashboard → **Project Settings → API**.

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

## Base de datos

### Migraciones aplicadas

Las migraciones viven en `supabase/migrations/` y se aplican con:

```bash
npx supabase db push
```

Orden de aplicación (todas ya aplicadas en el proyecto linkeado):

| #   | Archivo                                   | Contenido                                                   |
| --- | ----------------------------------------- | ----------------------------------------------------------- |
| 1   | `20260923000001_schema.sql`               | 15 tablas + `private.admin_users`                           |
| 2   | `20260923000002_functions.sql`            | `calculate_order_price`, `activate_week`, `close_week`      |
| 3   | `20260923000003_triggers.sql`             | Inmutabilidad, validaciones, protección de semanas `closed` |
| 4   | `20260923000004_rls.sql`                  | RLS, policies, grants                                       |
| 5   | `20260923000005_admin_setup.sql`          | INSERT del primer admin (comentado)                         |
| 6   | `20260924000001_menu_rpc.sql`             | `create_menu`, `create_menu_version`                        |
| 7   | `20260924000002_week_rpc.sql`             | `create_week`, `update_week`                                |
| 8   | `20260924000003_edge_function_grants.sql` | Grants de `service_role` sobre `private`                    |
| 9   | `20260924000004_admin_check_rpc.sql`      | `is_user_admin` (RPC público)                               |

### Regenerar tipos TypeScript

Cuando cambia el schema, regenerar los tipos:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

**Nunca** editar `database.ts` a mano.

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

### Deploy

```bash
npx supabase functions deploy rotate-client-token
```

---

## RLS y seguridad

- **Frontera real:** RLS + constraints + funciones de PostgreSQL.
- **Frontend:** no es frontera de seguridad.
- **Admin:** autenticado con Supabase Auth, autorizado en `private.admin_users`.
- **Cliente:** sin cuenta. Emite un JWT con claim `client_id` (pendiente). Las policies limitan todo a sus propios datos + la oferta activa.

Ver `docs/arquitectura.md` y `docs/modelo-datos.md`.

---

## Testing

No hay tests automatizados todavía. Ver `docs/estado-fases-1-5.md` sección
"Pendientes" para el plan de tests de invariantes.

Verificación manual disponible:

```bash
npx tsc -b          # chequeo de tipos
npm run lint        # chequeo de estilo
npm run build       # compilación completa
```

---

## Documentación

Toda la documentación está en `docs/`:

- **`prompt.md`** — Contrato completo del proyecto.
- **`estado-fases-1-5.md`** — Estado consolidado de las fases 1–5.
- **`arquitectura.md`** — Diagramas de capas, flujos y Edge Functions.
- **`dominio.md`** — Conceptos, invariantes y glosario del negocio.
- **`modelo-datos.md`** — Esquema PostgreSQL y ERD.
- **`flujos.md`** — Secuencias operativas típicas.
- **`servicios.md`** — Catálogo de la capa de servicios.
- **`glosario.md`** — Términos del dominio.
- **`adr/`** — Architecture Decision Records.

---

## Flujo operativo

Resumen del ciclo de una semana:

```
1. Admin crea semana (draft)          → createWeek
2. Admin configura oferta por día     → addDayOption
3. Admin activa la semana             → activateWeek
     └─ se congela week_expected_clients
4. Clientes piden/cancelan            → createOrder / createCancellation
5. Admin cierra la semana             → closeWeek
     └─ datos históricos inmutables
6. Admin consulta historial           → getClientHistory / listHistoricalWeeks
```

Ver `docs/flujos.md` para el detalle de cada paso.

---

## Roadmap

### Completado

- [x] Dominio y reglas de negocio
- [x] Modelo de datos PostgreSQL
- [x] RLS y funciones de dominio
- [x] Migraciones aplicadas
- [x] Capa de servicios TypeScript
- [x] Edge Function `rotate-client-token`

### Próximo

- [ ] Edge Function `authenticate-client-token` (emite JWT con `client_id`)
- [ ] UI de admin (`/admin`)
- [ ] UI de cliente (`/menu/:token`)
- [ ] Tests de invariantes contra la DB real
- [ ] Estrategia de estilos (tokens + CSS por feature)
- [ ] Supabase Realtime para el panel admin

### Descartado por ahora

- Integración con WhatsApp
- Estadísticas avanzadas
- Generación automática de flyers

---

## Licencia

Proyecto privado. Sin licencia pública por ahora.
