# Tinsky — App de gestión del taller

## 1. Probarla en tu compu (Windows)

Necesitás Node.js instalado (version 18 o mas nueva) desde nodejs.org. Si ya lo tenes:

1. Descomprimi esta carpeta donde quieras (ej: Escritorio\tinsky-app).
2. Abri una terminal (PowerShell o CMD) dentro de esa carpeta.
   - Tip: en el Explorador de Windows, parado en la carpeta, escribi cmd en la barra de direcciones y Enter.
3. Corre:
   npm install
   npm run dev
4. Te va a tirar una URL tipo http://localhost:5173 - abrila en el navegador. Ya esta funcionando, guardando en el navegador de esa compu (localStorage).

Si con esto te alcanza (solo la usas desde esta compu), podes parar aca. Los pasos 2 y 3 son para tener una URL real y usarla tambien desde el celu.

## 2. Guardado en la nube (Supabase, gratis) - para usar desde el celu tambien

1. Anda a supabase.com, crea una cuenta gratis (con GitHub o Google es mas rapido) y crea un proyecto nuevo (elegi cualquier region, por ejemplo "South America").
2. Una vez creado, anda a SQL Editor (menu izquierdo) -> New query, pega el contenido del archivo supabase-setup.sql que esta en esta carpeta, y apreta Run. Esto crea la tabla donde se van a guardar tus datos.
3. Anda a Project Settings -> API. Ahi vas a ver:
   - Project URL
   - anon public key
4. En la carpeta del proyecto, copia el archivo .env.example y renombralo a .env. Abrilo con el Bloc de notas y completa:
   VITE_SUPABASE_URL=el project url que copiaste
   VITE_SUPABASE_ANON_KEY=la anon key que copiaste
5. Guarda el archivo, y volve a correr npm run dev (si estaba corriendo, parala con Ctrl+C y arrancala de nuevo). Ahora tus datos se guardan en Supabase en vez del navegador.

## 3. Publicarla con una URL (Vercel, gratis) - para abrirla desde el celu

1. Subi esta carpeta a un repositorio de GitHub (gratis). Si no usas Git todavia, la forma mas facil:
   - Crea una cuenta en github.com
   - Instala GitHub Desktop (desktop.github.com), abri esta carpeta como repositorio nuevo, y hace "Publish repository".
2. Anda a vercel.com, crea una cuenta gratis con tu cuenta de GitHub.
3. "Add New" -> "Project" -> elegi el repositorio que acabas de subir.
4. Antes de darle "Deploy", abri Environment Variables y carga las mismas dos variables del paso anterior:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
5. Deploy. En un minuto te da una URL tipo tinsky-app.vercel.app - esa es la que abris desde el celu (podes agregarla a la pantalla de inicio para que quede como icono de app).

Cada vez que quieras actualizar la app (si volves a pedirle cambios a Claude), volves a pegar el codigo nuevo, subis los cambios a GitHub (GitHub Desktop: "Commit" + "Push") y Vercel la actualiza sola.

## Backup

Aunque uses Supabase, el boton de descarga (icono flecha abajo) que ya tiene la app te sigue sirviendo para bajar un .json de respaldo cuando quieras.
