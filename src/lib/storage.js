import { supabase } from "./supabaseClient";

const hasSupabase = !!supabase;

export const storage = {
  // Un fallo de red o de permisos no debe interpretarse como una base vacía:
  // así evitamos que la app pueda sobrescribir accidentalmente los datos reales.
  async getItem(key) {
    if (!hasSupabase) throw new Error("La conexión segura con Supabase no está configurada.");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Iniciá sesión para acceder a los datos del taller.");

    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      throw new Error(`No se pudo leer "${key}" de Supabase: ${error.message || error.code || "error desconocido"}`);
    }
    return data ? data.value : null;
  },

  async setItem(key, value) {
    if (!hasSupabase) throw new Error("La conexión segura con Supabase no está configurada.");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) throw new Error("Iniciá sesión para guardar los datos del taller.");

    const { error } = await supabase
      .from("kv_store")
      .upsert({ key, value, user_id: sessionData.session.user.id }, { onConflict: "key" });
    if (error) {
      throw new Error(`No se pudo guardar "${key}" en Supabase: ${error.message || error.code || "error desconocido"}`);
    }
    return true;
  },

  usingSupabase: hasSupabase,
};
