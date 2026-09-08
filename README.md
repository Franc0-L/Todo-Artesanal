# Todo Artesanal

App para gestionar el menú semanal de viandas: los clientes eligen su menú por día
desde un link personal, y el panel de administración muestra los pedidos y los montos
ya calculados.

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (gratis).
2. En **SQL Editor > New query**, pegá todo el contenido de `schema.sql` y ejecutalo.
   Esto crea las tablas, la vista de montos, los permisos y las dos funciones que usa
   la pantalla del cliente.
3. En **Authentication > Users**, creá manualmente un usuario (el email/contraseña que
   va a usar tu mamá para entrar al panel). No hace falta que se registre nadie más.
4. En **SQL Editor**, después de crear ese usuario, ejecutá lo siguiente y reemplazá
   `<UUID_DEL_USUARIO>` por su UUID (visible en Authentication > Users):

   ```sql
   insert into private.admin_users (user_id) values ('<UUID_DEL_USUARIO>');
   ```

   Esto es necesario para que solo esa cuenta pueda ver y modificar datos del panel.
5. En **Project Settings > API**, copiá la **Project URL** y la **anon public key**.

## 2. Configurar el proyecto

```bash
npm install
```

En macOS/Linux, creá el archivo con:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Completá `.env` con la URL y la clave que copiaste de Supabase.

## 3. Cargar el primer menú y los clientes

Todavía no hay una pantalla para esto (queda como mejora futura). Por ahora, cargalo
directo desde **Table Editor** en Supabase:

1. En la tabla `semanas`: una fila con `fecha_inicio`, `precio_general`, `precio_opcional`
   y `activa = true`.
2. En la tabla `dias_menu`: una fila por cada día de esa semana (`semana_id`, `dia_semana`,
   `fecha`, `plato_general`, `plato_opcional`, y `notas_temperatura` si aplica).
3. En la tabla `clientes`: una fila por cliente (`nombre`, `telefono`,
   `cuidados_alimentarios`). El `token` se genera solo — es lo que arma su link personal.

## 4. Correr en desarrollo

```bash
npm run dev
```

- Panel de administración: `http://localhost:5173/admin`
- Pantalla de un cliente: `http://localhost:5173/menu/<token-del-cliente>`
  (el token lo ves en la tabla `clientes` de Supabase, o con el botón "Copiar enlace"
  del panel una vez que esté publicado)

## 5. Publicar

El proyecto es una app estática (Vite), así que anda gratis en
[Vercel](https://vercel.com) o [Netlify](https://netlify.com):

1. Subí esta carpeta a un repositorio de GitHub.
2. Conectá el repositorio en Vercel/Netlify.
3. Cargá las mismas dos variables de entorno (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) en la configuración del proyecto ahí.
4. Deploy. La URL que te den es la que vas a compartir por WhatsApp.

## Cómo pensar el uso semanal

1. Tu mamá arma el menú de la semana (por ahora, cargando `dias_menu` en Supabase).
2. Manda por WhatsApp el flyer de siempre + el link personal de cada cliente (con el
   botón "Copiar enlace" del panel).
3. Cada cliente entra, toca su elección por día — se guarda solo, sin pasos extra.
4. El panel de administración (`/admin`) se actualiza solo a medida que responden,
   con los totales de plata y de raciones a cocinar ya calculados.
5. Si alguien cancela a mitad de semana, entra al mismo link y cambia su elección a
   "No como este día" — o vos misma tocás su celda en el panel para ciclar el estado.

## Qué queda para después (no es parte de este MVP)

- Pantalla propia para cargar el menú semanal y los clientes (hoy se hace desde
  Supabase directamente).
- Generación automática del flyer a partir del menú cargado.
- Historial de semanas anteriores en el panel (hoy solo muestra la semana activa).
