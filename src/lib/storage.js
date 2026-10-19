import { supabase } from "./supabaseClient";

const DB_NAME = "tinsky-offline";
const DB_VERSION = 1;
const STORE_NAME = "items";
const OFFLINE_USER_KEY = "tinsky-offline-user";
const hasSupabase = !!supabase;
let activeUserId = null;
let syncStatus = { state: "synced", message: "" };
const listeners = new Set();

function publish(state, message = "") {
  syncStatus = { state, message };
  listeners.forEach((listener) => listener(syncStatus));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite guardar datos sin conexión."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function withStore(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("No se pudo guardar en este dispositivo."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("No se pudo guardar en este dispositivo."));
    };
  });
}

function itemId(userId, key) {
  return `${userId}::${key}`;
}

async function getRecord(userId, key) {
  return withStore("readonly", (store) => store.get(itemId(userId, key)));
}

async function putRecord(record) {
  return withStore("readwrite", (store) => store.put(record));
}

async function listRecords(userId) {
  const all = await withStore("readonly", (store) => store.getAll());
  return (all || []).filter((record) => record.userId === userId);
}

function offlineUserId() {
  try {
    return localStorage.getItem(OFFLINE_USER_KEY);
  } catch {
    return null;
  }
}

async function getIdentity() {
  if (!hasSupabase) throw new Error("La conexión segura con Supabase no está configurada.");
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session || null;
  if (session?.user?.id) {
    activeUserId = session.user.id;
    try { localStorage.setItem(OFFLINE_USER_KEY, activeUserId); } catch {}
    return { userId: activeUserId, session };
  }
  const cachedUserId = !navigator.onLine ? offlineUserId() : null;
  if (cachedUserId) {
    activeUserId = cachedUserId;
    return { userId: cachedUserId, session: null };
  }
  if (error) throw new Error("No se pudo validar la sesión. Conectate a internet e iniciá sesión.");
  throw new Error("Iniciá sesión para acceder a los datos del taller.");
}

async function fetchCloud(key, userId) {
  const { data, error } = await supabase
    .from("kv_store")
    .select("value, updated_at")
    .eq("key", key)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || error.code || "No se pudo consultar la copia en la nube.");
  return data || null;
}

async function uploadRecord(record, session, cloudRecord) {
  if (!session) {
    publish("offline", "Los cambios están guardados en este dispositivo.");
    return false;
  }
  const cloudVersion = cloudRecord?.updated_at || null;
  if (record.baseCloudAt !== cloudVersion) {
    record.conflict = true;
    await putRecord(record);
    publish("conflict", "Hay cambios en otro dispositivo. Elegí qué copia conservar.");
    return false;
  }
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("kv_store")
    .upsert(
      { key: record.key, value: record.value, user_id: record.userId, updated_at: updatedAt },
      { onConflict: "key" }
    )
    .select("updated_at")
    .single();
  if (error) throw new Error(error.message || error.code || "No se pudo sincronizar con Supabase.");
  const saved = { ...record, dirty: false, conflict: false, baseCloudAt: data?.updated_at || updatedAt };
  await putRecord(saved);
  return true;
}

export const storage = {
  async getItem(key) {
    const { userId, session } = await getIdentity();
    let local = await getRecord(userId, key);

    if (!navigator.onLine || !session) {
      if (local) {
        publish(local.dirty ? "pending" : "offline", local.dirty ? "Hay cambios pendientes de sincronizar." : "Usando los datos guardados en este dispositivo.");
        return local.value;
      }
      throw new Error("Todavía no hay una copia guardada en este dispositivo. Conectate a internet para cargar tus datos.");
    }

    try {
      const cloud = await fetchCloud(key, userId);
      if (local?.dirty) {
        if (local.conflict) {
          publish("conflict", "Hay cambios en otro dispositivo. Elegí qué copia conservar.");
          return local.value;
        }
        if (local.baseCloudAt !== (cloud?.updated_at || null)) {
          local.conflict = true;
          await putRecord(local);
          publish("conflict", "Hay cambios en otro dispositivo. Elegí qué copia conservar.");
          return local.value;
        }
        await uploadRecord(local, session, cloud);
        return local.value;
      }

      local = {
        id: itemId(userId, key),
        userId,
        key,
        value: cloud?.value ?? null,
        dirty: false,
        conflict: false,
        baseCloudAt: cloud?.updated_at || null,
      };
      await putRecord(local);
      publish("synced", "Todos los cambios están sincronizados.");
      return local.value;
    } catch (error) {
      if (local) {
        publish(local.dirty ? "pending" : "offline", "No hay conexión con la nube; se usan los datos guardados en este dispositivo.");
        return local.value;
      }
      throw new Error(`No se pudo cargar "${key}" y todavía no hay una copia local. ${error.message}`);
    }
  },

  async setItem(key, value) {
    const { userId, session } = await getIdentity();
    let local = await getRecord(userId, key);
    if (!local && session && navigator.onLine) {
      try {
        const cloud = await fetchCloud(key, userId);
        local = {
          id: itemId(userId, key), userId, key, value: cloud?.value ?? null,
          dirty: false, conflict: false, baseCloudAt: cloud?.updated_at || null,
        };
      } catch {
        local = { id: itemId(userId, key), userId, key, value: null, dirty: false, conflict: false, baseCloudAt: null };
      }
    }
    const record = {
      ...(local || { id: itemId(userId, key), userId, key, baseCloudAt: null }),
      value,
      dirty: true,
      conflict: false,
      localUpdatedAt: new Date().toISOString(),
    };
    await putRecord(record);
    if (!navigator.onLine || !session) {
      publish("pending", "Los cambios están guardados en este dispositivo y se sincronizarán al reconectarte.");
      return true;
    }
    try {
      const cloud = await fetchCloud(key, userId);
      await uploadRecord(record, session, cloud);
      if (!record.conflict) publish("synced", "Todos los cambios están sincronizados.");
    } catch (error) {
      publish("pending", "Los cambios están guardados en este dispositivo y esperan conexión para sincronizarse.");
      console.warn("No se pudo sincronizar ahora; el cambio quedó guardado localmente.", error);
    }
    return true;
  },

  async syncPending() {
    if (!navigator.onLine || !hasSupabase) return;
    let identity;
    try {
      identity = await getIdentity();
    } catch {
      return;
    }
    if (!identity.session) return;
    const records = await listRecords(identity.userId);
    const pending = records.filter((record) => record.dirty);
    if (!pending.length) {
      publish("synced", "Todos los cambios están sincronizados.");
      return;
    }
    publish("syncing", "Sincronizando cambios guardados en este dispositivo…");
    for (const record of pending) {
      if (record.conflict) {
        publish("conflict", "Hay cambios en otro dispositivo. Elegí qué copia conservar.");
        return;
      }
      try {
        const cloud = await fetchCloud(record.key, identity.userId);
        await uploadRecord(record, identity.session, cloud);
        if (record.conflict) return;
      } catch (error) {
        publish("pending", "Los cambios siguen guardados en este dispositivo; se reintentará la sincronización.");
        console.warn("La sincronización sigue pendiente.", error);
        return;
      }
    }
    publish("synced", "Todos los cambios están sincronizados.");
  },

  async resolveConflict(key, choice) {
    const { userId, session } = await getIdentity();
    if (!session || !navigator.onLine) throw new Error("Conectate a internet para resolver la sincronización.");
    const local = await getRecord(userId, key);
    if (!local?.conflict) return;
    const cloud = await fetchCloud(key, userId);
    if (choice === "cloud") {
      await putRecord({
        ...local,
        value: cloud?.value ?? null,
        dirty: false,
        conflict: false,
        baseCloudAt: cloud?.updated_at || null,
      });
      publish("synced", "Se conservaron los datos de la nube.");
      return;
    }
    local.baseCloudAt = cloud?.updated_at || null;
    local.conflict = false;
    local.dirty = true;
    await putRecord(local);
    await uploadRecord(local, session, cloud);
    publish("synced", "Se conservaron los cambios de este dispositivo.");
  },

  rememberOfflineUser(userId) {
    activeUserId = userId || null;
    try {
      if (userId) localStorage.setItem(OFFLINE_USER_KEY, userId);
      else localStorage.removeItem(OFFLINE_USER_KEY);
    } catch {}
  },

  getOfflineUserId: offlineUserId,

  clearOfflineUser() {
    activeUserId = null;
    try { localStorage.removeItem(OFFLINE_USER_KEY); } catch {}
  },

  getSyncStatus() {
    return syncStatus;
  },

  subscribeSyncStatus(listener) {
    listeners.add(listener);
    listener(syncStatus);
    return () => listeners.delete(listener);
  },

  usingSupabase: hasSupabase,
};
