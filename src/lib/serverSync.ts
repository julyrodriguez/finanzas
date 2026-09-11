/**
 * serverSync.ts
 * Integración con el backend local (MongoDB) en https://apivacas.jariel.com.ar/api/ordenes
 * 
 * Permite doble escritura (dual-write) asíncrona no bloqueante:
 * Si el servidor está apagado o hay un problema de red, nunca interrumpe
 * la operación del usuario en el navegador ni en Firebase.
 */

import { OrdenCompra } from "@/types/ordenes";

const API_BASE_URL = "https://apivacas.jariel.com.ar/api/ordenes";

export interface MongoQueryParams {
  empresa?: "Hoyts" | "CMK";
  anio?: number | string;
  year?: number | string;
  search?: string;
  estado?: "liberada" | "entregada" | "mandada" | "cancelada" | "pendiente";
  limit?: number;
  page?: number;
  sort?: string;
}

/**
 * Guarda o actualiza una orden de compra en MongoDB de manera asíncrona.
 */
export async function syncOrderToMongo(orderData: Partial<OrdenCompra> & { id?: string; firebaseId?: string }): Promise<void> {
  try {
    const firebaseId = orderData.id || orderData.firebaseId;
    if (!firebaseId) return;

    const payload = {
      ...orderData,
      firebaseId,
    };

    // Petición no bloqueante en segundo plano
    fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn("⚠️ [Mongo Sync] Aviso en segundo plano:", err.message || err);
    });
  } catch (err) {
    console.warn("⚠️ [Mongo Sync] Error iniciando sincronización:", err);
  }
}

/**
 * Elimina una orden de compra en MongoDB cuando se borra en Firebase.
 */
export async function deleteOrderFromMongo(orderId?: string): Promise<void> {
  try {
    if (!orderId) return;

    fetch(`${API_BASE_URL}/${orderId}`, {
      method: "DELETE",
    }).catch((err) => {
      console.warn("⚠️ [Mongo Delete] Aviso en segundo plano:", err.message || err);
    });
  } catch (err) {
    console.warn("⚠️ [Mongo Delete] Error iniciando eliminación:", err);
  }
}

/**
 * Sincronización masiva (bulk) de múltiples órdenes hacia MongoDB.
 */
export async function bulkSyncOrdersToMongo(orders: (Partial<OrdenCompra> & { id?: string; firebaseId?: string })[]): Promise<void> {
  try {
    if (!orders || orders.length === 0) return;

    const formatted = orders.map((o) => ({
      ...o,
      firebaseId: o.id || o.firebaseId,
    }));

    fetch(`${API_BASE_URL}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenes: formatted }),
    }).catch((err) => {
      console.warn("⚠️ [Mongo Bulk Sync] Error:", err.message || err);
    });
  } catch (err) {
    console.warn("⚠️ [Mongo Bulk Sync] Error:", err);
  }
}

/**
 * Endpoint preparado para consultar órdenes directamente desde MongoDB en el servidor.
 * (Disponible para su uso cuando se decida consultar desde MongoDB en vez de Firebase).
 */
export async function fetchOrdersFromMongo(params: MongoQueryParams = {}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.empresa) searchParams.set("empresa", params.empresa);
    if (params.anio || params.year) searchParams.set("anio", String(params.anio || params.year));
    if (params.search) searchParams.set("search", params.search);
    if (params.estado) searchParams.set("estado", params.estado);
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.sort) searchParams.set("sort", params.sort);

    const queryString = searchParams.toString();
    const url = queryString ? `${API_BASE_URL}?${queryString}` : API_BASE_URL;

    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ Error al consultar órdenes desde MongoDB:", err);
    throw err;
  }
}

export interface CapexBudget {
  _id?: string;
  anio: number;
  hoytsBudget: number;
  cmkBudget: number;
  observaciones?: string;
  updatedAt?: string;
}

export interface CapexGastoDirecto {
  _id: string;
  anio: number;
  fecha: string;
  empresa: "Hoyts" | "CMK";
  monto: number;
  concepto: string;
  proveedor?: string;
  comprobante?: string;
  observaciones?: string;
  creadoPor?: string;
  createdAt?: string;
}

/**
 * Consulta los presupuestos CAPEX anuales por compañía.
 */
export async function fetchCapexBudgets(anio?: number | string): Promise<CapexBudget[]> {
  try {
    const q = anio && anio !== "Todos" ? `?anio=${anio}` : "";
    const res = await fetch(`${API_BASE_URL}/capex-budget${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.success && Array.isArray(data.budgets) ? data.budgets : [];
  } catch (err) {
    console.warn("Error consultando presupuestos CAPEX:", err);
    return [];
  }
}

/**
 * Guarda o actualiza el presupuesto anual CAPEX de Hoyts y CMK para un año específico.
 */
export async function saveCapexBudget(payload: {
  anio: number;
  hoytsBudget: number;
  cmkBudget: number;
  observaciones?: string;
}): Promise<CapexBudget | null> {
  const res = await fetch(`${API_BASE_URL}/capex-budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.budget || null;
}

/**
 * Consulta los gastos directos CAPEX sin orden de compra.
 */
export async function fetchCapexGastosDirectos(params: { anio?: number | string; empresa?: string } = {}): Promise<CapexGastoDirecto[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params.anio && params.anio !== "Todos") searchParams.set("anio", String(params.anio));
    if (params.empresa && params.empresa !== "Todas") searchParams.set("empresa", params.empresa);
    const q = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/capex-gastos-directos${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.success && Array.isArray(data.gastos) ? data.gastos : [];
  } catch (err) {
    console.warn("Error consultando gastos CAPEX directos:", err);
    return [];
  }
}

/**
 * Registra un nuevo gasto CAPEX sin orden de compra.
 */
export async function createCapexGastoDirecto(payload: {
  anio: number;
  fecha?: string | Date;
  empresa: "Hoyts" | "CMK";
  monto: number;
  concepto: string;
  proveedor?: string;
  comprobante?: string;
  observaciones?: string;
  creadoPor?: string;
}): Promise<CapexGastoDirecto> {
  const res = await fetch(`${API_BASE_URL}/capex-gastos-directos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.gasto;
}

/**
 * Elimina un gasto CAPEX sin orden de compra por su ID.
 */
export async function deleteCapexGastoDirecto(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/capex-gastos-directos/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return true;
}
