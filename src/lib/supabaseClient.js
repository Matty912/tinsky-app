import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sin configurar Supabase, la app bloquea el acceso y no guarda datos en el navegador.
export const supabase = url && key ? createClient(url, key) : null;
