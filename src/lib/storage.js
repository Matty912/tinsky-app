import { supabase } from "./supabaseClient";

const hasSupabase = !!supabase;

export const storage = {
  // IMPORTANTE: si falla la consulta a Supabase (red caída, DNS, etc.),
  // esto TIENE que lanzar el error en vez de devolver null — devolver null
  // acá se interpretaba como "todavía no hay datos guardados", lo cual
  // hacía que la app siguiera de largo con un estado vacío y, al guardar
  // cualquier cambio, pisara los datos reales que sí estaban en la base.
  async getItem(key) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from("kv_store")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) {
        throw new Error(`No se pudo leer "${key}" de Supabase: ${error.message || error.code || "error desconocido"}`);
      }
      return data ? data.value : null;
    }
    return localStorage.getItem(key);
  },

  async setItem(key, value) {
    if (hasSupabase) {
      const { error } = await supabase.from("kv_store").upsert({ key, value }, { onConflict: "key" });
      if (error) {
        throw new Error(`No se pudo guardar "${key}" en Supabase: ${error.message || error.code || "error desconocido"}`);
      }
      return true;
    }
    localStorage.setItem(key, value);
    return true;
  },

  usingSupabase: hasSupabase,
};
