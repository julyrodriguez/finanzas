"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Check, 
  FileText,
  Sparkles,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  Clock,
  Search
} from "lucide-react";
import type { OrdenCompra } from "@/types/ordenes";
import { getFirebaseDb } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc 
} from "firebase/firestore";
import { 
  ApprovalConfig, 
  DEFAULT_APPROVAL_CONFIG, 
  getStoredApprovalConfig,
  parseMontoToNumber
} from "@/lib/approvalConfig";

interface BatchSendToSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordenes: OrdenCompra[];
  onBatchSuccess?: (updatedEntries: { id: string; updates: Partial<OrdenCompra> }[]) => void;
  showToast: (msg: string) => void;
}

export type SendBatchResolution = 
  | "send_1ra"          // 1️⃣ Send for 1st signature
  | "send_2da"          // 2️⃣ Send for 2nd signature
  | "already_liberated" // ⚪ Already fully signed / liberated
  | "not_found";        // 🔴 Token not in database

interface ParsedSendMatch {
  rawToken: string;
  normalizedOC: string;
  order?: OrdenCompra;
  status: SendBatchResolution;
  statusDetail?: string;
  updatesToApply?: Partial<OrdenCompra>;
}

export function BatchSendToSignModal({
  isOpen,
  onClose,
  ordenes,
  onBatchSuccess,
  showToast,
}: BatchSendToSignModalProps) {
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchingDb, setSearchingDb] = useState(false);
  const [dbExtraOrders, setDbExtraOrders] = useState<OrdenCompra[]>([]);
  const [config, setConfig] = useState<ApprovalConfig>(DEFAULT_APPROVAL_CONFIG);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("Victoria");
  const [customRecipient, setCustomRecipient] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const cfg = getStoredApprovalConfig();
      setConfig(cfg);
      if (cfg.firmantes2Nivel1.length > 0) {
        setSelectedRecipient(cfg.firmantes2Nivel1[0]);
      } else {
        setSelectedRecipient("Victoria");
      }
    }
  }, [isOpen]);

  // Build a distinct list of all possible signers across all tiers
  const signerOptions = useMemo(() => {
    const set = new Set<string>();
    (config.firmantes1Nivel1 || []).forEach((n) => n && set.add(n));
    (config.firmantes2Nivel1 || []).forEach((n) => n && set.add(n));
    (config.firmantes1Nivel2 || []).forEach((n) => n && set.add(n));
    (config.firmantes2Nivel2 || []).forEach((n) => n && set.add(n));
    (config.firmantes1Nivel3 || []).forEach((n) => n && set.add(n));
    (config.firmantes2Nivel3 || []).forEach((n) => n && set.add(n));
    (config.firmantes1Nivel4 || []).forEach((n) => n && set.add(n));
    (config.firmantes2Nivel4 || []).forEach((n) => n && set.add(n));
    return Array.from(set);
  }, [config]);

  const activeRecipient = selectedRecipient === "Otro" 
    ? (customRecipient.trim() || "Destinatario") 
    : selectedRecipient;

  // Helper to normalize OC strings for loose matching
  const normalizeOC = (str: string): string => {
    if (!str) return "";
    const cleaned = str.replace(/^(?:OC|SOL)[-_\s:#]*/i, "").trim();
    const withoutLeadingZeros = cleaned.replace(/^0+/, "");
    return withoutLeadingZeros || cleaned;
  };

  // Extract candidate OC tokens from pasted text intelligently
  const extractedTokens = useMemo(() => {
    if (!inputText.trim()) return [];

    const lines = inputText.split("\n");
    const normalizedMap = new Map<string, string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. Explicit OC/SOL patterns: "OC 45892", "OC 045892", "OC-45892", "SOL 1234"
      const ocMatches = trimmed.match(/(?:OC|SOL)[-_\s:#]*([0-9A-Za-z]+)/gi);
      if (ocMatches) {
        for (const m of ocMatches) {
          const norm = normalizeOC(m);
          if (norm && !normalizedMap.has(norm)) {
            normalizedMap.set(norm, m.trim());
          }
        }
      }

      // 2. Standalone number lines
      const isMetadataLine = /^(?:Monto|Proveedor|Detalle|Forma de Pago|Link|Notas|Total|Prov|Fecha):/i.test(trimmed) || trimmed.includes("$");
      
      if (!isMetadataLine) {
        const standaloneMatches = trimmed.match(/\b\d{4,10}\b/g);
        if (standaloneMatches) {
          for (const num of standaloneMatches) {
            const norm = normalizeOC(num);
            if (norm && !normalizedMap.has(norm)) {
              normalizedMap.set(norm, num.trim());
            }
          }
        }
      }
    }

    return Array.from(normalizedMap.values());
  }, [inputText]);

  // Combine memory orders with any extra orders fetched from DB
  const allKnownOrders = useMemo(() => {
    const map = new Map<string, OrdenCompra>();
    for (const ord of ordenes) {
      if (ord.id) map.set(ord.id, ord);
    }
    for (const ord of dbExtraOrders) {
      if (ord.id) map.set(ord.id, ord);
    }
    return Array.from(map.values());
  }, [ordenes, dbExtraOrders]);

  // Calculate matching items and auto-detect 1st vs 2nd signature stage
  const parsedMatches = useMemo(() => {
    if (extractedTokens.length === 0) return [];

    const results: ParsedSendMatch[] = [];
    const matchedOrderIds = new Set<string>();
    const nowIso = new Date().toISOString();

    for (const token of extractedTokens) {
      const normToken = normalizeOC(token);
      if (!normToken) continue;

      const matchedOrder = allKnownOrders.find((ord) => {
        const normOC = normalizeOC(ord.numOC);
        const normSol = normalizeOC(ord.numSolicitud);
        return normOC === normToken || normSol === normToken || ord.numOC === token || ord.numSolicitud === token;
      });

      if (matchedOrder && matchedOrder.id) {
        if (!matchedOrderIds.has(matchedOrder.id)) {
          matchedOrderIds.add(matchedOrder.id);

          if (matchedOrder.liberada || (matchedOrder.firmado1 && matchedOrder.firmado2)) {
            results.push({
              rawToken: token,
              normalizedOC: normToken,
              order: matchedOrder,
              status: "already_liberated",
              statusDetail: "Ya se encuentra 100% liberada / ambas firmas listas",
            });
            continue;
          }

          const numMonto = parseMontoToNumber(matchedOrder.monto);
          const isTier1 = numMonto <= config.limiteNivel1;

          // Check if it already has 1st signature
          // (In Tier 1, <= $5M, Tomás is always auto-signed for 1st signature)
          const has1raFirma = Boolean(
            isTier1 ||
            matchedOrder.firmado1 || 
            Boolean(matchedOrder.firmante1?.trim()) ||
            Boolean(matchedOrder.fechaFirma1?.trim())
          );

          if (!has1raFirma) {
            // Stage: 1st signature (Tier 2, 3, 4 without 1st signature)
            results.push({
              rawToken: token,
              normalizedOC: normToken,
              order: matchedOrder,
              status: "send_1ra",
              statusDetail: `Enviando a ${activeRecipient} para 1ra Firma`,
              updatesToApply: {
                mandada: true,
                enviado: true,
                enviadoA1: activeRecipient,
                fechaEnvio1: nowIso,
              },
            });
          } else {
            // Stage: 2nd signature (Tier 1 auto-signed by Tomás, or Tiers 2/3/4 with 1st signature ready)
            const f1Name = matchedOrder.firmante1?.trim() || (isTier1 ? (config.firmantes1Nivel1[0] || "Tomás") : "1ra Firma");
            results.push({
              rawToken: token,
              normalizedOC: normToken,
              order: matchedOrder,
              status: "send_2da",
              statusDetail: `1ra Firma lista (${f1Name}). Enviando a ${activeRecipient} para 2da Firma`,
              updatesToApply: {
                mandada: true,
                enviado: true,
                enviadoA2: activeRecipient,
                fechaEnvio2: nowIso,
                ...(isTier1 ? {
                  firmado1: true,
                  firmante1: matchedOrder.firmante1?.trim() || config.firmantes1Nivel1[0] || "Tomas",
                  fechaFirma1: matchedOrder.fechaFirma1 || nowIso,
                } : {}),
              },
            });
          }
        }
      } else {
        results.push({
          rawToken: token,
          normalizedOC: normToken,
          status: "not_found",
          statusDetail: "No se encontró la orden en el sistema",
        });
      }
    }

    return results;
  }, [extractedTokens, allKnownOrders, activeRecipient, config]);

  const send1raList = parsedMatches.filter((m) => m.status === "send_1ra" && m.order);
  const send2daList = parsedMatches.filter((m) => m.status === "send_2da" && m.order);
  const alreadyLiberatedList = parsedMatches.filter((m) => m.status === "already_liberated" && m.order);
  const notFoundList = parsedMatches.filter((m) => m.status === "not_found");

  const totalExecutableCount = send1raList.length + send2daList.length;

  // Deep search in Firestore for any tokens not found in local memory state
  const handleDeepSearch = async () => {
    if (notFoundList.length === 0) return;
    const db = getFirebaseDb();
    if (!db) return;

    setSearchingDb(true);
    const tokensToSearch = notFoundList.map((m) => m.normalizedOC);
    const fetched: OrdenCompra[] = [];

    const chunkSize = 30;
    for (let i = 0; i < tokensToSearch.length; i += chunkSize) {
      const chunk = tokensToSearch.slice(i, i + chunkSize);
      try {
        const colRef = collection(db, "ordenes_compra");
        const q = query(colRef, where("numOC", "in", chunk));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            empresa: data.empresa || "Hoyts",
            numSolicitud: data.numSolicitud || "",
            numOC: data.numOC || "",
            razonSocial: data.razonSocial || "",
            monto: data.monto ?? "",
            motivo: data.motivo || "",
            formaPago: data.formaPago || "30DFF",
            liberada: Boolean(data.liberada),
            mandada: Boolean(data.mandada),
            entregada: Boolean(data.entregada),
            cancelada: Boolean(data.cancelada),
            creadoPor: data.creadoPor || "Usuario",
            notas: data.notas || [],
            createdAt: data.createdAt || null,
            relatedOC: data.relatedOC || "",
            enviado: Boolean(data.enviado),
            enviadoA1: data.enviadoA1 || "",
            enviadoA2: data.enviadoA2 || "",
            fechaEnvio1: data.fechaEnvio1 || "",
            fechaEnvio2: data.fechaEnvio2 || "",
            firmado1: Boolean(data.firmado1),
            firmado2: Boolean(data.firmado2),
            firmante1: data.firmante1 || "",
            firmante2: data.firmante2 || "",
            fechaFirma1: data.fechaFirma1 || "",
            fechaFirma2: data.fechaFirma2 || "",
            linkSharepoint: data.linkSharepoint || "",
          });
        }
      } catch (err) {
        console.error("Error in deep search chunk:", err);
      }
    }

    if (fetched.length > 0) {
      setDbExtraOrders((prev) => [...prev, ...fetched]);
      showToast(`🔍 Se encontraron ${fetched.length} órdenes adicionales en la base de datos`);
    } else {
      showToast("No se encontraron coincidencias adicionales en la base de datos");
    }

    setSearchingDb(false);
  };

  // Execute Batch Send Updates in Firestore
  const handleExecuteBatch = async () => {
    if (totalExecutableCount === 0) return;

    setIsProcessing(true);
    const db = getFirebaseDb();
    if (!db) {
      showToast("Error de conexión con la base de datos");
      setIsProcessing(false);
      return;
    }

    try {
      const itemsToUpdate = parsedMatches.filter(
        (m) => (m.status === "send_1ra" || m.status === "send_2da") && m.order && m.order.id && m.updatesToApply
      );

      // Batch in chunks of 450 (Firestore limit is 500)
      const chunkSize = 450;
      const updatedEntries: { id: string; updates: Partial<OrdenCompra> }[] = [];

      for (let i = 0; i < itemsToUpdate.length; i += chunkSize) {
        const chunk = itemsToUpdate.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docRef = doc(db, "ordenes_compra", item.order!.id!);
          batch.update(docRef, item.updatesToApply!);
          updatedEntries.push({
            id: item.order!.id!,
            updates: item.updatesToApply!,
          });
        }

        await batch.commit();
      }

      if (onBatchSuccess) {
        onBatchSuccess(updatedEntries);
      }

      showToast(
        `🚀 ${itemsToUpdate.length} órdenes marcadas como enviadas a firmar (${send1raList.length} para 1ra firma, ${send2daList.length} para 2da firma)`
      );

      setInputText("");
      onClose();
    } catch (err) {
      console.error("Error al procesar lote de envío a firmar:", err);
      showToast("Error al guardar los cambios en la base de datos");
    }

    setIsProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0b0f19] border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Pegar y Marcar Enviado a Firmar</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Detección Automática 1ra/2da Firma
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Pega el listado de órdenes y selecciona a quién se le enviaron para firma
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Signer / Recipient Selector */}
          <div className="p-4 rounded-2xl bg-[#111726] border border-slate-700/80 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-400" />
                ¿A quién se le envió a firmar?
              </label>
              <span className="text-[11px] text-slate-400">
                Se registrará este destinatario en las órdenes detectadas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <select
                  value={selectedRecipient}
                  onChange={(e) => setSelectedRecipient(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#080c16] border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                >
                  {signerOptions.map((name) => (
                    <option key={name} value={name} className="bg-[#080c16] text-white">
                      {name}
                    </option>
                  ))}
                  <option value="Otro" className="bg-[#080c16] text-amber-300">
                    ➕ Otro (escribir nombre personalizado)
                  </option>
                </select>
              </div>

              {selectedRecipient === "Otro" && (
                <div>
                  <input
                    type="text"
                    value={customRecipient}
                    onChange={(e) => setCustomRecipient(e.target.value)}
                    placeholder="Nombre del destinatario..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#080c16] border border-amber-500/60 text-white text-xs font-semibold focus:outline-none focus:border-amber-400 placeholder-slate-500"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>

          {/* Paste Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" />
                Pegar texto con Órdenes de Compra
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                Detecta números de OC o Solicitud automáticamente
              </span>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"Pegá acá el texto o listado...\nEjemplos:\nOC 45892\nOC 45893\n45894"}
              rows={5}
              className="w-full p-3.5 rounded-2xl bg-[#111726] border border-slate-700/80 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all resize-none shadow-inner"
            />
          </div>

          {/* Summary KPIs / Detection Badges */}
          {extractedTokens.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                <span className="text-[10px] uppercase font-bold text-blue-300 block">
                  1️⃣ Para 1ra Firma
                </span>
                <span className="text-lg font-black text-blue-400 font-mono">
                  {send1raList.length}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">
                  2️⃣ Para 2da Firma
                </span>
                <span className="text-lg font-black text-indigo-400 font-mono">
                  {send2daList.length}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  ⚪ Ya Liberadas
                </span>
                <span className="text-lg font-black text-slate-300 font-mono">
                  {alreadyLiberatedList.length}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                <span className="text-[10px] uppercase font-bold text-red-300 block">
                  ⚠️ No Encontradas
                </span>
                <span className="text-lg font-black text-red-400 font-mono">
                  {notFoundList.length}
                </span>
              </div>
            </div>
          )}

          {/* Deep Search Button if there are missing orders */}
          {notFoundList.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Hay <strong>{notFoundList.length}</strong> órdenes no cargadas en memoria. Podés buscarlas en la base de datos.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDeepSearch}
                disabled={searchingDb}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
              >
                {searchingDb ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar en Base de Datos</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Matches Preview Table / List */}
          {parsedMatches.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Detalle de Órdenes Detectadas ({parsedMatches.length})
              </span>

              <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-800 divide-y divide-slate-800/80 bg-[#080c16]">
                {parsedMatches.map((match, idx) => {
                  let badge = null;

                  if (match.status === "send_1ra") {
                    badge = (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                        1️⃣ Para 1ra Firma
                      </span>
                    );
                  } else if (match.status === "send_2da") {
                    badge = (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                        2️⃣ Para 2da Firma
                      </span>
                    );
                  } else if (match.status === "already_liberated") {
                    badge = (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        ⚪ Ya Liberada
                      </span>
                    );
                  } else {
                    badge = (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        ❌ No encontrada
                      </span>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono font-bold text-white shrink-0">
                          {match.rawToken}
                        </span>
                        {match.order && (
                          <span className="text-slate-400 truncate text-[11px]">
                            {match.order.razonSocial}
                          </span>
                        )}
                        <span className="text-slate-500 text-[10.5px] truncate hidden sm:inline">
                          {match.statusDetail}
                        </span>
                      </div>

                      <div className="shrink-0 ml-3">{badge}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-[#080c16]">
          <span className="text-xs text-slate-400 font-medium">
            {totalExecutableCount > 0
              ? `Se actualizarán ${totalExecutableCount} órdenes como enviadas a firmar`
              : "Ingresá órdenes para procesar"}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleExecuteBatch}
              disabled={totalExecutableCount === 0 || isProcessing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/30"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirmar y Marcar Enviadas ({totalExecutableCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
