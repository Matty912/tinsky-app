import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no cargaste las variables de entorno, la app sigue funcionando
// guardando todo en el navegador (localStorage) en vez de Supabase.
export const supabase = url && key ? createClient(url, key) : null;
