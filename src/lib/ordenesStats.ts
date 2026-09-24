import { 
  Firestore, 
  doc, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  getCountFromServer, 
  getDocs 
} from "firebase/firestore";
import type { OrdenCompra } from "@/types/ordenes";

export type OrderStatusKey = "pendiente" | "mandada" | "liberada" | "entregada" | "cancelada";

export interface OrdenesStats {
  total: number;
  pendiente: number;
  mandada: number;
  liberada: number;
  entregada: number;
  cancelada: number;
  updatedAt?: any;
}

/**
 * Determina el estado único de una orden de acuerdo al flujo de trabajo corporativo.
 */
export function getOrderStatus(orden?: Partial<OrdenCompra> | null): OrderStatusKey {
  if (!orden) return "pendiente";
  if (orden.cancelada) return "cancelada";
  if (orden.entregada) return "entregada";
  if (orden.liberada) return "liberada";
  if (orden.mandada) return "mandada";
  return "pendiente";
}

export const getStatsDocRef = (db: Firestore) => doc(db, "metadata", "ordenes_stats");

/**
 * Incrementa/decrementa de manera atómica el documento contador en la base de datos
 * cuando una orden cambia de estado (ej: de 'pendiente' a 'mandada', o de 'liberada' a 'entregada').
 */
export async function trackOrderStatusChange(
  db: Firestore,
  oldStatus: OrderStatusKey,
  newStatus: OrderStatusKey
): Promise<void> {
  if (!db || oldStatus === newStatus) return;

  const statsRef = getStatsDocRef(db);
  try {
    await updateDoc(statsRef, {
      [oldStatus]: increment(-1),
      [newStatus]: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err: any) {
    console.warn("⚠️ [ordenesStats] Error incrementando contador de estado:", err?.message || err);
    // Si el documento no existe todavía en el servidor, lo inicializamos
    if (err?.code === "not-found" || err?.message?.includes("No document to update")) {
      try {
        await recalculateAndSyncStats(db);
      } catch (recErr) {
        console.warn("⚠️ [ordenesStats] No se pudo inicializar documento contador:", recErr);
      }
    }
  }
}

/**
 * Suma al contador de 'total' y al estado correspondiente cuando se crea una orden nueva.
 */
export async function trackOrderCreated(
  db: Firestore,
  orden: Partial<OrdenCompra>
): Promise<void> {
  if (!db) return;
  const status = getOrderStatus(orden);
  const statsRef = getStatsDocRef(db);

  try {
    await setDoc(
      statsRef,
      {
        total: increment(1),
        [status]: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("⚠️ [ordenesStats] Error al registrar creación de orden en contador:", err);
  }
}

/**
 * Resta del 'total' y del estado correspondiente cuando se elimina una orden de la base de datos.
 */
export async function trackOrderDeleted(
  db: Firestore,
  orden: Partial<OrdenCompra>
): Promise<void> {
  if (!db) return;
  const status = getOrderStatus(orden);
  const statsRef = getStatsDocRef(db);

  try {
    await setDoc(
      statsRef,
      {
        total: increment(-1),
        [status]: increment(-1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("⚠️ [ordenesStats] Error al registrar eliminación en contador:", err);
  }
}

/**
 * Registra cambios de estado en lote (por ejemplo en liberaciones o envíos masivos).
 */
export async function trackBatchStatusChanges(
  db: Firestore,
  changes: { oldStatus: OrderStatusKey; newStatus: OrderStatusKey }[]
): Promise<void> {
  if (!db || !changes || changes.length === 0) return;

  const deltas: Record<string, number> = {};
  for (const { oldStatus, newStatus } of changes) {
    if (oldStatus === newStatus) continue;
    deltas[oldStatus] = (deltas[oldStatus] || 0) - 1;
    deltas[newStatus] = (deltas[newStatus] || 0) + 1;
  }

  const updatePayload: Record<string, any> = { updatedAt: serverTimestamp() };
  for (const [key, delta] of Object.entries(deltas)) {
    if (delta !== 0) {
      updatePayload[key] = increment(delta);
    }
  }

  if (Object.keys(updatePayload).length <= 1) return;

  const statsRef = getStatsDocRef(db);
  try {
    await updateDoc(statsRef, updatePayload);
  } catch (err: any) {
    console.warn("⚠️ [ordenesStats] Error en actualización masiva de contadores:", err?.message || err);
    if (err?.code === "not-found" || err?.message?.includes("No document to update")) {
      await recalculateAndSyncStats(db);
    }
  }
}

/**
 * Recalcula los contadores directamente desde el servidor y los persiste en el documento 'metadata/ordenes_stats'.
 * Utiliza getCountFromServer (eficiente y sin descargar payloads de documentos) con fallback a escaneo único.
 */
export async function recalculateAndSyncStats(db: Firestore): Promise<OrdenesStats> {
  const colRef = collection(db, "ordenes_compra");
  const statsRef = getStatsDocRef(db);

  try {
    const [totalSnap, canceladaSnap, entregadaSnap, liberadaSnap, mandadaSnap] = await Promise.all([
      getCountFromServer(colRef),
      getCountFromServer(query(colRef, where("cancelada", "==", true))),
      getCountFromServer(query(colRef, where("entregada", "==", true))),
      getCountFromServer(query(colRef, where("liberada", "==", true))),
      getCountFromServer(query(colRef, where("mandada", "==", true))),
    ]);

    const total = totalSnap.data().count;
    const cancelada = canceladaSnap.data().count;
    const entregada = entregadaSnap.data().count;
    const liberada = liberadaSnap.data().count;
    const mandadaRaw = mandadaSnap.data().count;
    // Mandadas que no estén aún liberadas
    const mandada = Math.max(0, mandadaRaw > liberada ? mandadaRaw - liberada : mandadaRaw);
    const pendiente = Math.max(0, total - (liberada + mandada + entregada + cancelada));

    const stats: OrdenesStats = {
      total,
      pendiente,
      mandada,
      liberada,
      entregada,
      cancelada,
      updatedAt: serverTimestamp(),
    };

    await setDoc(statsRef, stats, { merge: true });
    return stats;
  } catch (err) {
    console.warn("⚠️ [ordenesStats] Error ejecutando getCountFromServer, aplicando fallback completo:", err);
    
    // Fallback: escaneo de colección completa una sola vez
    const snap = await getDocs(colRef);
    let total = 0;
    let pendiente = 0;
    let mandada = 0;
    let liberada = 0;
    let entregada = 0;
    let cancelada = 0;

    snap.docs.forEach((docSnap) => {
      total++;
      const data = docSnap.data() as Partial<OrdenCompra>;
      const st = getOrderStatus(data);
      if (st === "pendiente") pendiente++;
      else if (st === "mandada") mandada++;
      else if (st === "liberada") liberada++;
      else if (st === "entregada") entregada++;
      else if (st === "cancelada") cancelada++;
    });

    const stats: OrdenesStats = {
      total,
      pendiente,
      mandada,
      liberada,
      entregada,
      cancelada,
      updatedAt: serverTimestamp(),
    };

    await setDoc(statsRef, stats, { merge: true });
    return stats;
  }
}
