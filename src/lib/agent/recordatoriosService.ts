/**
 * recordatoriosService.ts
 * Servicio para la gestión de la mini-lista de recordatorios del asistente.
 * Persistencia en Firebase Firestore (colección 'recordatorios') + sincronización
 * con el Calendario ('calendar_events') y almacenamiento local (localStorage).
 */

import { getFirebaseDb, isFirestoreDisabled, handleFirestoreError } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { syncCalendarEventToMongo } from "@/lib/serverSync";

export interface Recordatorio {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha?: string; // Formato YYYY-MM-DD
  hora?: string; // Formato HH:MM (opcional)
  completado: boolean;
  prioridad?: "alta" | "media" | "baja";
  categoria?: "finanzas" | "reunion" | "operaciones" | "personal";
  origen?: "chat" | "email" | "manual";
  emailContext?: {
    asunto?: string;
    remitente?: string;
  };
  createdAt: string;
  completedAt?: string | null;
}

const LOCAL_STORAGE_KEY = "finanzas_recordatorios_list";

/**
 * Carga todos los recordatorios desde Firestore o fallback LocalStorage
 */
export async function fetchRecordatorios(): Promise<Recordatorio[]> {
  let list: Recordatorio[] = [];

  // 1. Intentar Firestore si no está desactivado por cuota
  if (!isFirestoreDisabled()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        const colRef = collection(db, "recordatorios");
        const q = query(colRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Recordatorio, "id">),
        }));
      }
    } catch (err: any) {
      handleFirestoreError(err);
      console.warn("⚠️ [Recordatorios] Error Firestore, recurriendo a localStorage:", err?.message || err);
    }
  }

  // 2. Si Firestore devolvió datos, actualizamos el localStorage de respaldo
  if (list.length > 0) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {}
    return list;
  }

  // 3. Fallback a LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
  }

  return [];
}

/**
 * Guarda o actualiza un recordatorio
 */
export async function saveRecordatorio(
  rec: Partial<Recordatorio> & { titulo: string }
): Promise<Recordatorio> {
  const id = rec.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  const fullRecordatorio: Recordatorio = {
    id,
    titulo: rec.titulo.trim(),
    descripcion: rec.descripcion?.trim() || "",
    fecha: rec.fecha || new Date().toISOString().split("T")[0],
    hora: rec.hora || "09:00",
    completado: Boolean(rec.completado),
    prioridad: rec.prioridad || "media",
    categoria: rec.categoria || "finanzas",
    origen: rec.origen || "chat",
    emailContext: rec.emailContext,
    createdAt: rec.createdAt || nowIso,
    completedAt: rec.completedAt || null,
  };

  // 1. Actualizar LocalStorage de inmediato
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existing: Recordatorio[] = raw ? JSON.parse(raw) : [];
      const updated = existing.some((item) => item.id === id)
        ? existing.map((item) => (item.id === id ? fullRecordatorio : item))
        : [fullRecordatorio, ...existing];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  // 2. Dual Write: Firestore
  if (!isFirestoreDisabled()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        await setDoc(doc(db, "recordatorios", id), fullRecordatorio);
      }
    } catch (err: any) {
      handleFirestoreError(err);
      console.warn("⚠️ [Recordatorios] Aviso al guardar en Firestore:", err?.message || err);
    }
  }

  // 3. Si tiene fecha definida, sincronizar también con el Calendario de la app
  if (fullRecordatorio.fecha) {
    try {
      const calendarEventId = `cal-rec-${id}`;
      const calEvent = {
        id: calendarEventId,
        firebaseId: calendarEventId,
        title: `⏰ ${fullRecordatorio.titulo}`,
        description: fullRecordatorio.descripcion || "Recordatorio generado por el Asistente Finanzas",
        date: fullRecordatorio.fecha,
        startTime: fullRecordatorio.hora || "09:00",
        endTime: fullRecordatorio.hora ? `${fullRecordatorio.hora.slice(0, 2)}:30` : "09:30",
        category: fullRecordatorio.categoria || "finanzas",
      };

      // Sincronizar con Mongo Calendario
      syncCalendarEventToMongo(calEvent);

      // Guardar también en Firestore collection 'calendar_events'
      if (!isFirestoreDisabled()) {
        const db = getFirebaseDb();
        if (db) {
          setDoc(doc(db, "calendar_events", calendarEventId), calEvent).catch(handleFirestoreError);
        }
      }
    } catch (calErr) {
      console.warn("⚠️ [Recordatorios] Aviso al sincronizar evento en calendario:", calErr);
    }
  }

  return fullRecordatorio;
}

/**
 * Alterna el estado de completado de un recordatorio
 */
export async function toggleRecordatorioStatus(
  id: string,
  completado: boolean
): Promise<boolean> {
  const completedAt = completado ? new Date().toISOString() : null;

  // 1. LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const list: Recordatorio[] = JSON.parse(raw);
        const updated = list.map((item) =>
          item.id === id ? { ...item, completado, completedAt } : item
        );
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {}
  }

  // 2. Firestore
  if (!isFirestoreDisabled()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        await updateDoc(doc(db, "recordatorios", id), {
          completado,
          completedAt,
        });
      }
    } catch (err: any) {
      handleFirestoreError(err);
      console.warn("⚠️ [Recordatorios] Aviso al alternar estado en Firestore:", err?.message || err);
    }
  }

  return true;
}

/**
 * Elimina un recordatorio
 */
export async function deleteRecordatorio(id: string): Promise<boolean> {
  // 1. LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const list: Recordatorio[] = JSON.parse(raw);
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify(list.filter((item) => item.id !== id))
        );
      }
    } catch {}
  }

  // 2. Firestore
  if (!isFirestoreDisabled()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        await deleteDoc(doc(db, "recordatorios", id));
      }
    } catch (err: any) {
      handleFirestoreError(err);
      console.warn("⚠️ [Recordatorios] Aviso al eliminar en Firestore:", err?.message || err);
    }
  }

  // 3. Eliminar de calendar_events si existía
  try {
    const calendarEventId = `cal-rec-${id}`;
    if (!isFirestoreDisabled()) {
      const db = getFirebaseDb();
      if (db) {
        deleteDoc(doc(db, "calendar_events", calendarEventId)).catch(() => {});
      }
    }
  } catch {}

  return true;
}
