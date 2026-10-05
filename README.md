# Tinsky — Gestión del taller

## Acceso seguro y recuperación de los datos

La app usa Supabase Authentication y Row Level Security. No tiene una contraseña de acceso compartida ni un modo alternativo que guarde datos en el navegador. Si no puede leer Supabase, muestra un error en vez de presentar un taller vacío.

### Preparación única de Supabase

1. Hacé y guardá una copia de la tabla `public.kv_store`.
2. En **Authentication → Users**, usá la cuenta existente del dueño del taller y copiá su **UID**. No hace falta crear otra cuenta.
3. Abrí el archivo `supabase-setup.sql`, reemplazá todas las apariciones de `PEGAR-UUID-DEL-USUARIO-AQUI` por ese UID y ejecutá el contenido en **SQL Editor** del proyecto `tinsky.ok`.
4. El script conserva las filas de la tabla, las asigna a esa cuenta y deja una política que solo permite acceso a una sesión autenticada del dueño.

### Publicación en Vercel

1. En **Project → Settings → Environment Variables**, verificá que existan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para Production. Son las variables públicas de Supabase; no uses `service_role`.
2. Integrá el cambio de la rama de esta actualización en `main`. Vercel generará una nueva publicación automáticamente.
3. Abrí `https://tinsky-app.vercel.app` e iniciá sesión con el correo y la contraseña de la cuenta existente de Supabase.

Si está habilitado el registro público de Supabase, deshabilitalo en los ajustes de Authentication para que solo el dueño pueda iniciar sesión.

## Desarrollo local

Necesitás Node.js. Configurá las dos variables de Supabase en un archivo `.env` basado en `.env.example`, luego ejecutá `npm install` y `npm run dev`.

## Copias de seguridad

Descargá regularmente el respaldo JSON desde el botón de descarga de la app y guardalo en un lugar seguro.
