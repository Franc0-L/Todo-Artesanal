# Todo Artesanal

App para gestionar el menú semanal de viandas: los clientes eligen su menú por día
desde un link personal, y el panel de administración muestra los pedidos, los montos
ya calculados, y el historial de semanas y clientes.

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (gratis).
2. Instalá el [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started)
   si todavía no lo tenés, y logueate: `supabase login`.
3. Vinculá este repo a tu proyecto (te pide el project ref, lo sacás de la URL del
   dashboard):

   ```bash
   supabase link --project-ref <TU_PROJECT_REF>
   ```
4. Aplicá todas las migraciones de una sola vez:

   ```bash
   supabase db push
   ```

   Esto crea las tablas, la vista de montos, los permisos, el catálogo de platos y
   todas las funciones — en el orden correcto, sin tener que pegar nada a mano en
   el SQL Editor.
5. En **Authentication > Users** del dashboard, creá manualmente un usuario (el
   email/contraseña que va a usar tu mamá para entrar al panel). No hace falta que
   se registre nadie más.
6. En **SQL Editor**, después de crear ese usuario, ejecutá lo siguiente y reemplazá
   `<UUID_DEL_USUARIO>` por su UUID (visible en Authentication > Users):

   ```sql
   insert into private.admin_users (user_id) values ('<UUID_DEL_USUARIO>');
   ```

   Esto es necesario para que solo esa cuenta pueda ver y modificar datos del panel.
7. En **Project Settings > API**, copiá la **Project URL** y la **anon public key**.

### Si ya tenés este proyecto corriendo en Supabase

Si tu base ya tiene todo esto aplicado a mano (como veníamos haciendo hasta ahora),
`supabase db push` va a fallar porque intenta crear cosas que ya existen. Marcá cada
migración como ya aplicada, sin volver a ejecutarla, una por una en orden:

```bash
supabase migration repair --status applied 20260910100001
supabase migration repair --status applied 20260910100002
supabase migration repair --status applied 20260910100003
supabase migration repair --status applied 20260910100004
supabase migration repair --status applied 20260910100005
supabase migration repair --status applied 20260910100006
supabase migration repair --status applied 20260910100007
supabase migration repair --status applied 20260910100008
```

De ahí en más, cualquier cambio nuevo se hace con `supabase migration new <nombre>`
y se aplica con `supabase db push` — un solo comando, nunca más copiar y pegar SQL
a mano.

## 2. Configurar el proyecto

```bash
npm install
cp .env.example .env
```

En Windows PowerShell: `Copy-Item .env.example .env`

Completá `.env` con la URL y la clave que copiaste de Supabase.

## 3. Correr en desarrollo

```bash
npm run dev
```

- Panel de administración: `http://localhost:5173/admin`
- Pantalla de un cliente: `http://localhost:5173/menu/<token-del-cliente>`

## 4. Cargar los primeros datos

Ya no hace falta tocar Supabase directamente para esto:

1. **`/admin/platos`**: cargá algunos platos (nombre, categoría, clima).
2. **`/admin/clientes`**: cargá tus clientes (nombre, teléfono, cuidado especial y,
   si corresponde, un precio especial). El link personal de cada uno se genera solo.
3. **`/admin/nueva-semana`**: armá la primera semana — elegís el plato general y
   opcional de cada día (lunes a viernes), o usás "Sugerir platos" para que proponga
   según el clima esperado y qué tan hace que no se usa cada plato.

## 5. Publicar

El proyecto es una app estática (Vite), así que anda gratis en
[Vercel](https://vercel.com) o [Netlify](https://netlify.com):

1. Conectá este repositorio en Vercel/Netlify.
2. Cargá las mismas dos variables de entorno (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) en la configuración del proyecto ahí.
3. Deploy. La URL que te den es la que vas a compartir por WhatsApp.

## Qué hay en el panel de administración

- **Pedidos** (`/admin`): la semana activa, quién eligió qué, totales y raciones a
  cocinar por día. Se actualiza solo en vivo a medida que responden.
- **Nueva semana**: cargar y activar la semana siguiente.
- **Platos**: catálogo de platos con categoría, clima, y hace cuánto no se usa cada uno.
- **Clientes**: alta y edición de clientes, con su link personal a mano.
- **Historial de semanas**: el mismo resumen diario de cualquier semana pasada, no
  solo la activa.
- **Cancelaciones**: quién no pidió o avisó que no come, para una semana dada.
- **Historial por cliente**: qué pidió (o no) un cliente a través de todas las semanas.

## Cómo pensar el uso semanal

1. Tu mamá arma el menú de la semana en `/admin/nueva-semana`.
2. Manda por WhatsApp el flyer de siempre + el link personal de cada cliente (botón
   "Copiar enlace" en `/admin/clientes` o en el panel de Pedidos).
3. Cada cliente entra a su link, toca su elección por día — se guarda solo.
4. El panel de Pedidos se actualiza solo a medida que responden.
5. Si alguien cancela a mitad de semana, entra al mismo link y cambia su elección a
   "No como este día" — o vos misma tocás su celda en el panel para ciclar el estado.

## Qué queda para después

- Generación automática del flyer a partir del menú cargado.
- "Sin responder" en Historial de semanas se calcula contra los clientes activos
  *hoy*, no contra los que estaban activos en esa semana puntual — una aproximación
  razonable para el tamaño del negocio, pero no es 100% exacta para semanas muy viejas
  si en el medio dieron de baja a algún cliente.
