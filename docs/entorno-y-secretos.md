# Entorno y secretos — setup en una máquina nueva

> **Fecha:** 2026-10-03 · **Ámbito:** repo / operación
> **Relacionado:** `README.md` → "Cómo levantar el proyecto",
> `docs/decisiones/20261001-cliente-jwt-es256-signing-key.md`

## Qué archivos hay y quién lleva qué

| Archivo                           | Plantilla (va en git)                | Real (gitignored)            | Sensibilidad                     |
| --------------------------------- | ------------------------------------ | ---------------------------- | -------------------------------- |
| Frontend (Vite)                   | `.env.example`                       | `.env.local`                 | Baja (publishable key = pública) |
| Secrets de Edge Functions         | `supabase/.env.example`              | `supabase/.env.local`        | **Alta: clave privada ES256**    |
| Signing key (forma array, GoTrue) | `supabase/signing_keys.example.json` | `supabase/signing_keys.json` | **Alta: clave privada ES256**    |

- Los `.example` van **siempre** commiteados: son la forma (qué variables existen)
  con placeholders, nunca valores reales.
- Los reales no viajan en git (`.env.local` por `*.local` en `.gitignore`;
  los de `supabase/` por `supabase/.gitignore`).

### Contenido de cada uno

- **`.env.local`** — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Lo escribe
  `npm run env:local` / `npm run env:cloud`; si no existe, `npm run env:init`
  lo crea desde `.env.example` (apuntando a la nube).
- **`supabase/.env.local`** — `CLIENT_JWT_PRIVATE_KEY_JWK` (JWK de la clave
  **privada** ES256, JSON de una línea, objeto **no** array) y `CLIENT_JWT_KID`
  (el `kid` de esa misma JWK). Lo consume `[edge_runtime.secrets]` de
  `supabase/config.toml` en el arranque local y
  `npx supabase secrets set --env-file supabase/.env.local` en la nube.
- **`supabase/signing_keys.json`** — **la misma JWK** pero como array
  (`[{...}]`); la escribe `npx supabase gen signing-key --algorithm ES256` y la
  lee GoTrue local para publicar la JWKS (la firma ES256 del JWT de cliente).

> Los dos archivos de `supabase/` contienen **la misma clave en dos formas**.
> Por eso `npm run env:init` deriva uno del otro: para mudarte de compu alcanza
> con copiar **uno solo** de los dos.

## Arranque en una compu nueva

```bash
git clone <repo> Todo-Artesanal
cd Todo-Artesanal
npm install
npm run env:init      # crea .env.local (nube) + deriva supabase/ si hay clave
npm run dev           # frontend listo (apunta a la nube)
```

Con stack local (Docker) además:

```bash
# requiere supabase/.env.local presente: env:init lo deriva si copiaste
# supabase/signing_keys.json; si no hay ninguna de las dos, el script avisa
# cómo generarla (ver "Si no podés copiar la signing key").
npm run supabase:start
npm run env:local
```

## Docker y stack local en la máquina nueva

El stack local corre **todo en Docker**: no hace falta instalar Postgres ni la
CLI global de Supabase (`npx supabase` baja el binario sola). Solo Docker.

1. **Instalar Docker**: Docker Desktop en Windows/macOS (en Windows, con backend
   **WSL2**) o Docker Engine en Linux. Asignale al daemon al menos **4 GB de
   RAM**: el stack levanta ~10 contenedores (Kong, GoTrue, PostgREST, Realtime,
   Storage, Studio, Inbucket, edge-runtime, Postgres…).
2. **Verificar** que el daemon esté arriba (Docker Desktop abierto):

   ```bash
   docker version     # si falla con "cannot connect", el daemon no corre
   docker ps
   ```

   `npm run env:init` muestra ese mismo estado al final del reporte.

3. **Puertos libres**: `54320` (shadow), `54321` (API), `54322` (Postgres),
   `54323` (Studio), `54324` (Inbucket), `54329` (pooler, deshabilitado) y
   `5173` (Vite). Si alguno está ocupado, `supabase start` falla al arrancar.
4. **Levantar** (requiere `supabase/.env.local` presente — ver la sección
   "Qué copiar desde la máquina anterior"):

   ```bash
   npm run supabase:start   # NO `npx supabase start` crudo: le faltan los secrets
   npx supabase status       # URLs, claves y estado de cada servicio
   npm run env:local         # .env.local -> 127.0.0.1:54321
   npm run dev
   ```

5. **Parar**: `npx supabase stop` — preserva los volúmenes de datos (solo
   `--no-backup` los borra).

### Verificación rápida del stack

```bash
# 1. La función debe responder 400/401 de dominio, NUNCA el 500
#    "Configuración del servidor incompleta" (ese 500 = secrets sin cargar):
curl -s -X POST http://127.0.0.1:54321/functions/v1/authenticate-client-token \
  -H "Content-Type: application/json" \
  -d '{"token":"0123456789012345678901234567890123456789"}'
# -> 401 {"error":"Token inválido o expirado"}  = secrets + DB OK

# 2. Migraciones locales vs nube:
npx supabase migration list        # 7/7 en sync

# 3. Frontend contra el stack local:
npm run env:local && npm run dev   # http://localhost:5173 -> 200
```

### Hallazgos conocidos (Windows · verificado 2026-10-03)

- **`Stopped services: [supabase_imgproxy … supabase_pooler …]` es normal**:
  `pooler` está `enabled = false` en `config.toml` e `imgproxy` no corre porque
  `[storage.image_transformation]` está comentado.
- **`supabase_edge_runtime` en estado "Stopped"**: pasa cuando Docker Desktop
  se cierra a medias. `npx supabase start` solo imprime _"already running"_ y
  **no** lo levanta: hay que hacer `npx supabase stop` +
  `npm run supabase:start` (sin `--no-backup`, los volúmenes se preservan).
  Señal de que los secrets no llegaron: `authenticate-client-token` responde
  **500** "Configuración del servidor incompleta" en vez de 400/401 de dominio.
- **`supabase_vector` en loop de restart**: es el colector de logs de
  `[analytics]` que no conecta a `tcp://localhost:2375`; la propia CLI lo
  advierte al arrancar (_"Analytics on Windows requires Docker daemon exposed
  on tcp://localhost:2375"_). Arreglo: Docker Desktop → Settings → General →
  **"Expose daemon on tcp://localhost:2375 without TLS"** y reiniciar Docker;
  o bien `[analytics] enabled = false` en `config.toml`. No afecta el
  desarrollo: es solo logging.

### Qué NO migra: los volúmenes de Docker

Los datos locales viven en volúmenes de Docker de **esa** compu; en la nueva no
existen. La fuente de verdad es la nube, así que lo normal es arrancar vacío:

```bash
npx supabase db reset   # aplica las 6 migraciones + seed
```

y re-sembrar el admin con el `curl` + `docker exec ... psql` de
`README.md` → "Probar localmente" (`db reset` borra `auth.users` y
`private.admin_users`).

Si querés **conservar los datos de prueba** de la compu vieja, volcalos antes de
desarmarla:

```powershell
# compu vieja (stack corriendo)
npx supabase db dump --local --data-only -f data.sql

# compu nueva (stack corriendo y ya con db reset)
Get-Content data.sql | docker exec -i supabase_db_todo-artesanal psql -U postgres -d postgres
```

> El dump de datos solo sirve si el esquema coincide: siempre `db reset`
> primero (cadena de migraciones 6/6). Ojo con `supabase stop --no-backup`:
> borra los volúmenes y el dump ya no tiene de dónde salir.

### Vincular con la nube (`db push`, tipos)

El link del proyecto vive en `supabase/.temp/` (gitignored), así que hay que
recrearlo en la nueva compu — **no** hace falta si vas a usar solo el stack
local:

```bash
npx supabase login
npx supabase link --project-ref zarvihhrzfcvlegqygnu
# después: npx supabase db push / migration list / gen types typescript --linked
```

## Qué copiar desde la máquina anterior

1. **Obligatorio para stack local:** `supabase/signing_keys.json` **o**
   `supabase/.env.local` (con uno alcanza; `npm run env:init` deriva el otro):

   ```powershell
   copy <ruta-vieja>\supabase\signing_keys.json <nueva>\Todo-Artesanal\supabase\
   npm run env:init
   ```

2. **Opcional:** `.env.local` — es regenerable con `npm run env:cloud` o
   `npm run env:local`, no hace falta copiarlo.
3. **No viven en el repo** (anotarlos aparte / gestor de contraseñas):
   - Contraseña de la DB del proyecto en la nube (la pide `psql`; en local sale
     de `npx supabase status -o env`).
   - Access token de la Supabase CLI (`npx supabase login`).
   - Credenciales del admin (`francoleonettu123@gmail.com` + contraseña).
   - Tokens de cliente en plaintext: no se guardan; se regeneran con
     `rotate-client-token` (la DB solo conserva el hash).

## Si no podés copiar la signing key (rotación)

Perderla/rotarla invalida los JWT de cliente ya emitidos (deseable) y exige
re-setear el secret y redeployar. Procedimiento completo en
`docs/decisiones/20261001-cliente-jwt-es256-signing-key.md`; resumen:

1. `npx supabase gen signing-key --algorithm ES256` → escribe
   `supabase/signing_keys.json`.
2. `npm run env:init` → deriva `supabase/.env.local`.
3. Panel → **Auth → Signing Keys**: dejar la clave **Active** (pública en JWKS).
4. `npx supabase secrets set --env-file supabase/.env.local`.
5. `npx supabase functions deploy authenticate-client-token`.
6. Verificar con un `/menu/<token>` real.

## Secrets en la nube (no migran la compu)

Viven en el proyecto Supabase `zarvihhrzfcvlegqygnu`, no en el repo: al clonar
en otra máquina **ya están**. Se revisan con `npx supabase secrets list` y se
actualizan con `npx supabase secrets set --env-file supabase/.env.local`.
Los únicos que setea Supabase por su cuenta son `SUPABASE_URL`,
`SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (los nuestros no pueden
llamarse `SUPABASE_*`: la CLI los rechaza).

## Regla de mantenimiento

Cuando aparezca un secreto o variable nueva:

1. Agregar su placeholder al `.example` correspondiente (con comentarios de
   dónde sale el valor).
2. Documentarlo acá (qué archivo real genera y quién lo consume).
3. Si el arranque local lo necesita, sumarlo al parser de
   `scripts/supabase-start.mjs` / `[edge_runtime.secrets]` de `config.toml`.
