"use client";

import { useState, useMemo } from "react";
import { 
  X, 
  ClipboardPaste, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Check, 
  FileText,
  Sparkles,
  ArrowRight
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

interface BatchLiberateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordenes: OrdenCompra[];
  onBatchSuccess: (updatedIds: string[]) => void;
  showToast: (msg: string) => void;
}

interface ParsedMatch {
  rawToken: string;
  normalizedOC: string;
  order?: OrdenCompra;
  status: "pending_to_liberate" | "already_liberated" | "not_found";
}

export function BatchLiberateModal({
  isOpen,
  onClose,
  ordenes,
  onBatchSuccess,
  showToast,
}: BatchLiberateModalProps) {
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchingDb, setSearchingDb] = useState(false);
  const [dbExtraOrders, setDbExtraOrders] = useState<OrdenCompra[]>([]);

  // Helper to normalize OC strings for loose matching (e.g. "045892" -> "45892", "OC-45892" -> "45892")
  const normalizeOC = (str: string): string => {
    if (!str) return "";
    // Remove "OC", "SOL", spaces, hyphens, and leading zeros
    const cleaned = str.replace(/^(?:OC|SOL)[-_\s:#]*/i, "").trim();
    const withoutLeadingZeros = cleaned.replace(/^0+/, "");
    return withoutLeadingZeros || cleaned;
  };

  // Extract candidate OC tokens from pasted text intelligently
  const extractedTokens = useMemo(() => {
    if (!inputText.trim()) return [];

    const lines = inputText.split("\n");
    const normalizedMap = new Map<string, string>(); // normToken -> rawToken

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

      // 2. Standalone number lines (e.g. column pasted from Excel like "45892" or "045892")
      // Ignore lines that are clearly descriptions, amounts, or other metadata fields
      const isMetadataLine = /^(?:Monto|Proveedor|Detalle|Forma de Pago|Link|Notas|Total|Prov|Fecha):/i.test(trimmed) || trimmed.includes("$");
      
      if (!isMetadataLine) {
        // Match numbers if the line starts with a number or is a column cell
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

  // Calculate matching items
  const parsedMatches = useMemo(() => {
    if (extractedTokens.length === 0) return [];

    const results: ParsedMatch[] = [];
    const matchedOrderIds = new Set<string>();

    for (const token of extractedTokens) {
      const normToken = normalizeOC(token);
      if (!normToken) continue;

      // Find matching order
      const matchedOrder = allKnownOrders.find((ord) => {
        const normOC = normalizeOC(ord.numOC);
        const normSol = normalizeOC(ord.numSolicitud);
        return normOC === normToken || normSol === normToken || ord.numOC === token || ord.numSolicitud === token;
      });

      if (matchedOrder && matchedOrder.id) {
        if (!matchedOrderIds.has(matchedOrder.id)) {
          matchedOrderIds.add(matchedOrder.id);
          results.push({
            rawToken: token,
            normalizedOC: normToken,
            order: matchedOrder,
            status: matchedOrder.liberada ? "already_liberated" : "pending_to_liberate",
          });
        }
      } else {
        results.push({
          rawToken: token,
          normalizedOC: normToken,
          status: "not_found",
        });
      }
    }

    return results;
  }, [extractedTokens, allKnownOrders]);

  const toLiberateList = parsedMatches.filter((m) => m.status === "pending_to_liberate" && m.order);
  const alreadyLiberatedList = parsedMatches.filter((m) => m.status === "already_liberated" && m.order);
  const notFoundList = parsedMatches.filter((m) => m.status === "not_found");

  // Deep search in Firestore for any tokens not found in local memory state
  const handleDeepSearch = async () => {
    if (notFoundList.length === 0) return;
    const db = getFirebaseDb();
    if (!db) return;

    setSearchingDb(true);
    const tokensToSearch = notFoundList.map((m) => m.normalizedOC);
    const fetched: OrdenCompra[] = [];

    // Chunk search by 30 (Firestore 'in' constraint maximum)
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
            firmado1: Boolean(data.firmado1),
            firmado2: Boolean(data.firmado2),
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

  // Perform Batch Liberate in Firestore
  const handleExecuteBatch = async () => {
    if (toLiberateList.length === 0) return;

    setIsProcessing(true);
    const db = getFirebaseDb();
    const targetIds = toLiberateList.map((m) => m.order!.id!).filter(Boolean);

    if (db) {
      try {
        // Firestore batch allows up to 500 writes
        const batch = writeBatch(db);
        for (const ordId of targetIds) {
          const docRef = doc(db, "ordenes_compra", ordId);
          batch.update(docRef, {
            liberada: true,
            mandada: true, // Marking as liberated also flags mandada
            cancelada: false,
          });
        }
        await batch.commit();

        showToast(`🎉 ¡${targetIds.length} órdenes marcadas como LIBERADAS con éxito!`);
        onBatchSuccess(targetIds);
        handleClose();
      } catch (err) {
        console.error("Error al ejecutar batch update en Firestore:", err);
        showToast("Error al actualizar las órdenes en el servidor");
      }
    } else {
      onBatchSuccess(targetIds);
      showToast(`🎉 ¡${targetIds.length} órdenes actualizadas localmente!`);
      handleClose();
    }

    setIsProcessing(false);
  };

  const handleClose = () => {
    setInputText("");
    setDbExtraOrders([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0e1322] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#0b0f19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Pegar y Marcar Órdenes como Liberadas
              </h3>
              <p className="text-xs text-slate-400">
                Pega el texto copiado de tus órdenes y el sistema las liberará en lote automáticamente
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <label htmlFor="batch-textarea" className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pega aquí el texto con las órdenes de compra:</span>
              </label>
              {inputText && (
                <button
                  onClick={() => setInputText("")}
                  className="text-slate-400 hover:text-red-400 text-[11px] underline"
                >
                  Limpiar texto
                </button>
              )}
            </div>

            <textarea
              id="batch-textarea"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ejemplo:
OC 45892 Hoyts Proveedor: Coca-Cola...
OC 45899 CMK Proveedor: Golosinas...
o simplemente pega una lista de números de OC..."
              className="w-full p-3.5 rounded-xl bg-[#080c16] border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono resize-y"
            />
          </div>

          {/* Analysis / Summary Stats */}
          {extractedTokens.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">
                    Para Liberar
                  </div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">
                    {toLiberateList.length} <span className="text-xs font-normal text-slate-400">órdenes</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                  <div className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider">
                    Ya Liberadas
                  </div>
                  <div className="text-xl font-bold text-slate-200 mt-0.5">
                    {alreadyLiberatedList.length} <span className="text-xs font-normal text-slate-400">órdenes</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <div className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>No Encontradas</span>
                    {notFoundList.length > 0 && (
                      <button
                        onClick={handleDeepSearch}
                        disabled={searchingDb}
                        className="text-[10px] text-amber-300 hover:text-amber-200 underline lowercase"
                      >
                        {searchingDb ? "buscando..." : "buscar en BD"}
                      </button>
                    )}
                  </div>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">
                    {notFoundList.length} <span className="text-xs font-normal text-slate-400">tokens</span>
                  </div>
                </div>
              </div>

              {/* Matching Orders Preview List */}
              {toLiberateList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Órdenes detectadas para liberar ({toLiberateList.length}):</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-[#080c16] divide-y divide-slate-800/60 text-xs">
                    {toLiberateList.map((match, idx) => (
                      <div
                        key={match.order?.id || idx}
                        className="p-2.5 flex items-center justify-between hover:bg-white/[0.02] gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              match.order?.empresa === "Hoyts"
                                ? "bg-purple-950 text-purple-300 border border-purple-800/50"
                                : "bg-teal-950 text-teal-300 border border-teal-800/50"
                            }`}
                          >
                            {match.order?.empresa}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-white font-mono mr-2">
                              {match.order?.numOC}
                            </span>
                            <span className="text-slate-300 font-medium truncate">
                              {match.order?.razonSocial}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 font-mono text-slate-200 font-semibold text-[11px]">
                          {typeof match.order?.monto === "number"
                            ? `$ ${match.order.monto.toLocaleString("es-AR")}`
                            : match.order?.monto}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not Found Tokens Preview */}
              {notFoundList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Tokens / OCs no encontradas ({notFoundList.length}):</span>
                    </div>
                    <button
                      onClick={handleDeepSearch}
                      disabled={searchingDb}
                      className="text-[11px] text-amber-300 hover:text-amber-200 underline font-normal cursor-pointer"
                    >
                      {searchingDb ? "Buscando en base de datos..." : "Buscar en base de datos"}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {notFoundList.map((m, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold"
                        >
                          <span>{m.rawToken}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-amber-300/80 leading-relaxed">
                      Estos valores no coincidieron con ninguna orden registrada en el sistema (pueden ser montos o números que no pertenecen a una OC).
                    </p>
                  </div>
                </div>
              )}

              {/* Already liberated preview */}
              {alreadyLiberatedList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Órdenes ya liberadas anteriormente ({alreadyLiberatedList.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {alreadyLiberatedList.map((m, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[11px]"
                      >
                        {m.order?.numOC || m.rawToken}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0b0f19] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecuteBatch}
            disabled={toLiberateList.length === 0 || isProcessing}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 shadow-lg ${
              toLiberateList.length > 0 && !isProcessing
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Liberando órdenes...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  {toLiberateList.length > 0
                    ? `Marcar ${toLiberateList.length} ${toLiberateList.length === 1 ? "orden" : "órdenes"} como Liberada`
                    : "No hay órdenes pendientes para liberar"}
                </span>
                {toLiberateList.length > 0 && <ArrowRight className="w-3.5 h-3.5 ml-0.5" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
