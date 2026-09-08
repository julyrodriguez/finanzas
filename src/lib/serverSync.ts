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
