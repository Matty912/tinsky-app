import { supabase } from "./supabaseClient";

const hasSupabase = !!supabase;

export const storage = {
  async getItem(key) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from("kv_store")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) {
        console.error("Error leyendo de Supabase:", error);
        return null;
      }
      return data ? data.value : null;
    }
    return localStorage.getItem(key);
  },

  async setItem(key, value) {
    if (hasSupabase) {
      const { error } = await supabase.from("kv_store").upsert({ key, value });
      if (error) {
        console.error("Error guardando en Supabase:", error);
        return false;
      }
      return true;
    }
    localStorage.setItem(key, value);
    return true;
  },

  usingSupabase: hasSupabase,
};
