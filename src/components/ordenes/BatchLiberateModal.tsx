"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  X, 
  ClipboardPaste, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Check, 
  FileText,
  Sparkles,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  Clock
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
  isNameInList,
  parseMontoToNumber
} from "@/lib/approvalConfig";

interface BatchLiberateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ordenes: OrdenCompra[];
  onBatchSuccess: (updatedEntries: { id: string; updates: Partial<OrdenCompra> }[]) => void;
  showToast: (msg: string) => void;
}

export type OrderBatchResolution = 
  | "ready_to_liberate"     // 🟢 Full 2 signatures complete -> will be marked liberada: true
  | "partial_signed"        // 🟡 1 signature registered -> pending 2nd signature
  | "over_limit_warning"    // ⚠️ Signer does not have authority for this amount tier
  | "already_liberated"     // ⚪ Already liberated
  | "not_found";            // 🔴 Token not in database

interface ParsedMatch {
  rawToken: string;
  normalizedOC: string;
  order?: OrdenCompra;
  status: OrderBatchResolution;
  statusDetail?: string;
  updatesToApply?: Partial<OrdenCompra>;
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
  const [config, setConfig] = useState<ApprovalConfig>(DEFAULT_APPROVAL_CONFIG);
  const [selectedAuthorizer, setSelectedAuthorizer] = useState<string>("Victoria");
  const [customAuthorizer, setCustomAuthorizer] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const cfg = getStoredApprovalConfig();
      setConfig(cfg);
      if (cfg.firmantes2Nivel1.length > 0) {
        setSelectedAuthorizer(cfg.firmantes2Nivel1[0]);
      } else {
        setSelectedAuthorizer("Victoria");
      }
    }
  }, [isOpen]);

  const activeAuthorizer = selectedAuthorizer === "Otro" ? (customAuthorizer.trim() || "Autorizador") : selectedAuthorizer;

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

      // 2. Standalone number lines (ignore metadata lines like Monto, Proveedor, Detalle, etc.)
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

  // Calculate matching items and evaluate double signature rules across all 4 tiers
  const parsedMatches = useMemo(() => {
    if (extractedTokens.length === 0) return [];

    const results: ParsedMatch[] = [];
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

          if (matchedOrder.liberada) {
            results.push({
              rawToken: token,
              normalizedOC: normToken,
              order: matchedOrder,
              status: "already_liberated",
              statusDetail: "Ya se encuentra 100% liberada",
            });
            continue;
          }

          const numMonto = parseMontoToNumber(matchedOrder.monto);

          // ==========================================
          // TIER 1: Hasta $5M (Tomás + Área)
          // ==========================================
          if (numMonto <= config.limiteNivel1) {
            const isFirma1 = isNameInList(activeAuthorizer, config.firmantes1Nivel1);
            const isFirma2 = isNameInList(activeAuthorizer, config.firmantes2Nivel1);

            if (isFirma2) {
              // Signer is Area (Victoria, Tristan, Jorgelina, Pablo G., etc.)
              // Auto-pairs with Tomas -> Complete liberation!
              results.push({
                rawToken: token,
                normalizedOC: normToken,
                order: matchedOrder,
                status: "ready_to_liberate",
                statusDetail: `Liberada: ${matchedOrder.firmante1 || config.firmantes1Nivel1[0] || "Tomás"} (F1) + ${activeAuthorizer} (F2)`,
                updatesToApply: {
                  liberada: true,
                  mandada: true,
                  cancelada: false,
                  firmado1: true,
                  firmante1: matchedOrder.firmante1 || config.firmantes1Nivel1[0] || "Tomas",
                  fechaFirma1: matchedOrder.fechaFirma1 || nowIso,
                  firmado2: true,
                  firmante2: activeAuthorizer,
                  fechaFirma2: nowIso,
                },
              });
            } else if (isFirma1) {
              // Signer is Firma 1 (e.g. Tomas)
              const hasArea = Boolean(matchedOrder.firmado2 && matchedOrder.firmante2 && isNameInList(matchedOrder.firmante2, config.firmantes2Nivel1));
              if (hasArea) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${activeAuthorizer} (F1) + ${matchedOrder.firmante2} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 1 registrada por ${activeAuthorizer}. Falta firma 2 de área para liberar`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              }
            } else {
              results.push({
                rawToken: token,
                normalizedOC: normToken,
                order: matchedOrder,
                status: "over_limit_warning",
                statusDetail: `Hasta $${config.limiteNivel1.toLocaleString("es-AR")}: Requiere firmantes habilitados de Nivel 1`,
              });
            }
          }
          // ==========================================
          // TIER 2: De 5M a 18M (Pablo Mondelo + Darío)
          // ==========================================
          else if (numMonto > config.limiteNivel1 && numMonto <= config.limiteNivel2) {
            const isFirma1 = isNameInList(activeAuthorizer, config.firmantes1Nivel2);
            const isFirma2 = isNameInList(activeAuthorizer, config.firmantes2Nivel2);

            if (isFirma1) {
              const hasF2 = Boolean(matchedOrder.firmado2 && matchedOrder.firmante2 && isNameInList(matchedOrder.firmante2, config.firmantes2Nivel2));
              if (hasF2) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${activeAuthorizer} (F1) + ${matchedOrder.firmante2} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 1 registrada por ${activeAuthorizer}. Falta firma 2 (${config.firmantes2Nivel2.join("/")})`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              }
            } else if (isFirma2) {
              const hasF1 = Boolean(matchedOrder.firmado1 && matchedOrder.firmante1 && isNameInList(matchedOrder.firmante1, config.firmantes1Nivel2));
              if (hasF1) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${matchedOrder.firmante1} (F1) + ${activeAuthorizer} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado2: true,
                    firmante2: activeAuthorizer,
                    fechaFirma2: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 2 registrada por ${activeAuthorizer}. Falta firma 1 (${config.firmantes1Nivel2.join("/")})`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado2: true,
                    firmante2: activeAuthorizer,
                    fechaFirma2: nowIso,
                  },
                });
              }
            } else {
              results.push({
                rawToken: token,
                normalizedOC: normToken,
                order: matchedOrder,
                status: "over_limit_warning",
                statusDetail: `De $${config.limiteNivel1.toLocaleString("es-AR")} a $${config.limiteNivel2.toLocaleString("es-AR")}: Requiere firmas de ${config.firmantes1Nivel2.join("/")} y ${config.firmantes2Nivel2.join("/")}`,
              });
            }
          }
          // ==========================================
          // TIER 3: De 18M a 150M (Matías / Hernán + Darío)
          // ==========================================
          else if (numMonto > config.limiteNivel2 && numMonto <= config.limiteNivel3) {
            const isFirma1 = isNameInList(activeAuthorizer, config.firmantes1Nivel3);
            const isFirma2 = isNameInList(activeAuthorizer, config.firmantes2Nivel3);

            if (isFirma1) {
              const hasF2 = Boolean(matchedOrder.firmado2 && matchedOrder.firmante2 && isNameInList(matchedOrder.firmante2, config.firmantes2Nivel3));
              if (hasF2) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${activeAuthorizer} (F1) + ${matchedOrder.firmante2} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 1 registrada por ${activeAuthorizer}. Falta firma 2 (${config.firmantes2Nivel3.join("/")})`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              }
            } else if (isFirma2) {
              const hasF1 = Boolean(matchedOrder.firmado1 && matchedOrder.firmante1 && isNameInList(matchedOrder.firmante1, config.firmantes1Nivel3));
              if (hasF1) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${matchedOrder.firmante1} (F1) + ${activeAuthorizer} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado2: true,
                    firmante2: activeAuthorizer,
                    fechaFirma2: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 2 registrada por ${activeAuthorizer}. Falta firma 1 (${config.firmantes1Nivel3.join("/")})`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado2: true,
                    firmante2: activeAuthorizer,
                    fechaFirma2: nowIso,
                  },
                });
              }
            } else {
              results.push({
                rawToken: token,
                normalizedOC: normToken,
                order: matchedOrder,
                status: "over_limit_warning",
                statusDetail: `De $${config.limiteNivel2.toLocaleString("es-AR")} a $${config.limiteNivel3.toLocaleString("es-AR")}: Requiere firmas de ${config.firmantes1Nivel3.join("/")} y ${config.firmantes2Nivel3.join("/")}`,
              });
            }
          }
          // ==========================================
          // TIER 4: Más de 150M (Darío / Hernán + Martín)
          // ==========================================
          else if (numMonto > config.limiteNivel3) {
            const isFirma1 = isNameInList(activeAuthorizer, config.firmantes1Nivel4);
            const isFirma2 = isNameInList(activeAuthorizer, config.firmantes2Nivel4);

            if (isFirma1) {
              const hasF2 = Boolean(matchedOrder.firmado2 && matchedOrder.firmante2 && isNameInList(matchedOrder.firmante2, config.firmantes2Nivel4));
              if (hasF2) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${activeAuthorizer} (F1) + ${matchedOrder.firmante2} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 1 registrada por ${activeAuthorizer}. Falta firma 2 (${config.firmantes2Nivel4.join("/")})`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado1: true,
                    firmante1: activeAuthorizer,
                    fechaFirma1: nowIso,
                  },
                });
              }
            } else if (isFirma2) {
              const hasF1 = Boolean(matchedOrder.firmado1 && matchedOrder.firmante1 && isNameInList(matchedOrder.firmante1, config.firmantes1Nivel4));
              if (hasF1) {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "ready_to_liberate",
                  statusDetail: `Liberada: ${matchedOrder.firmante1} (F1) + ${activeAuthorizer} (F2)`,
                  updatesToApply: {
                    liberada: true,
                    mandada: true,
                    cancelada: false,
                    firmado2: true,
                    firmante2: activeAuthorizer,
                    fechaFirma2: nowIso,
                  },
                });
              } else {
                results.push({
                  rawToken: token,
                  normalizedOC: normToken,
                  order: matchedOrder,
                  status: "partial_signed",
                  statusDetail: `Firma 2 registrada por ${activeAuthorizer}. Falta firma 1 (${config.firmantes1Nivel4.join("/")})`,
                  updatesToApply: {
                    liberada: false,
                    mandada: true,
                    firmado2: true,
                    firmante2: activeAuthorizer,
                    fechaFirma2: nowIso,
                  },
                });
              }
            } else {
              results.push({
                rawToken: token,
                normalizedOC: normToken,
                order: matchedOrder,
                status: "over_limit_warning",
                statusDetail: `Más de $${config.limiteNivel3.toLocaleString("es-AR")}: Requiere firmas de ${config.firmantes1Nivel4.join("/")} y ${config.firmantes2Nivel4.join("/")}`,
              });
            }
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
  }, [extractedTokens, allKnownOrders, activeAuthorizer, config]);

  const toLiberateList = parsedMatches.filter((m) => m.status === "ready_to_liberate" && m.order);
  const toPartialSignList = parsedMatches.filter((m) => m.status === "partial_signed" && m.order);
  const overLimitList = parsedMatches.filter((m) => m.status === "over_limit_warning" && m.order);
  const alreadyLiberatedList = parsedMatches.filter((m) => m.status === "already_liberated" && m.order);
  const notFoundList = parsedMatches.filter((m) => m.status === "not_found");

  const totalExecutableCount = toLiberateList.length + toPartialSignList.length;

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

  // Perform Batch Liberate and Signatures in Firestore
  const handleExecuteBatch = async () => {
    if (totalExecutableCount === 0) return;

    setIsProcessing(true);
    const db = getFirebaseDb();
    const itemsToUpdate = [...toLiberateList, ...toPartialSignList];
    const updatedEntries: { id: string; updates: Partial<OrdenCompra> }[] = [];

    if (db) {
      try {
        const batch = writeBatch(db);
        for (const item of itemsToUpdate) {
          if (item.order?.id && item.updatesToApply) {
            const docRef = doc(db, "ordenes_compra", item.order.id);
            batch.update(docRef, item.updatesToApply);
            updatedEntries.push({ id: item.order.id, updates: item.updatesToApply });
          }
        }
        await batch.commit();

        if (toLiberateList.length > 0 && toPartialSignList.length > 0) {
          showToast(`🎉 ${toLiberateList.length} liberadas y ${toPartialSignList.length} firmadas correctamente`);
        } else if (toLiberateList.length > 0) {
          showToast(`🎉 ¡${toLiberateList.length} órdenes marcadas como LIBERADAS con éxito!`);
        } else {
          showToast(`✍️ ¡${toPartialSignList.length} órdenes firmadas (pendientes de 2da firma)!`);
        }

        onBatchSuccess(updatedEntries);
        handleClose();
      } catch (err) {
        console.error("Error al ejecutar batch update en Firestore:", err);
        showToast("Error al actualizar las órdenes en el servidor");
      }
    } else {
      const localUpdates = itemsToUpdate
        .filter(i => i.order?.id && i.updatesToApply)
        .map(i => ({ id: i.order!.id!, updates: i.updatesToApply! }));
      onBatchSuccess(localUpdates);
      showToast(`🎉 ¡${itemsToUpdate.length} órdenes actualizadas localmente!`);
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

  const uniqueSignerNames = Array.from(
    new Set([
      ...config.firmantes2Nivel1,
      ...config.firmantes1Nivel1,
      ...config.firmantes1Nivel2,
      ...config.firmantes2Nivel2,
      ...config.firmantes1Nivel3,
      ...config.firmantes2Nivel3,
      ...config.firmantes1Nivel4,
      ...config.firmantes2Nivel4,
    ].map(s => s.trim()).filter(Boolean))
  );

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
                Pegar y Marcar Órdenes Liberadas
              </h3>
              <p className="text-xs text-slate-400">
                Pega las órdenes y el sistema evaluará las firmas por escala ($5M / $18M / $150M / &gt;$150M)
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Selector de Autorizador del Lote */}
          <div className="p-4 rounded-xl bg-[#080c16] border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>¿Quién autorizó este lote de órdenes?</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Firmante / Autorizador Responsable:
                </label>
                <select
                  value={selectedAuthorizer}
                  onChange={(e) => setSelectedAuthorizer(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  {uniqueSignerNames.map((name) => (
                    <option key={name} value={name} className="bg-[#0b0f19]">
                      {name}
                    </option>
                  ))}
                  <option value="Otro" className="bg-[#0b0f19]">
                    Otro (Especificar nombre)
                  </option>
                </select>
              </div>

              {selectedAuthorizer === "Otro" && (
                <div className="space-y-1 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-semibold text-slate-400">
                    Nombre del Firmante:
                  </label>
                  <input
                    type="text"
                    value={customAuthorizer}
                    onChange={(e) => setCustomAuthorizer(e.target.value)}
                    placeholder="Escribe el nombre del autorizador..."
                    className="w-full px-3 py-2 rounded-lg bg-[#111726] border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="sm:col-span-2 text-[10.5px] text-slate-400 leading-relaxed bg-[#111726]/60 p-2.5 rounded-lg border border-slate-800">
                💡 <strong className="text-slate-300">Escalas Vigentes:</strong> Hasta <strong>$5M</strong> (Tomás + Área) | <strong>$5M a $18M</strong> (P. Mondelo + Darío) | <strong>$18M a $150M</strong> (Matías/Hernán + Darío) | <strong>&gt; $150M</strong> (Darío/Hernán + Martín).
              </div>
            </div>
          </div>

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
                  className="text-slate-400 hover:text-red-400 text-[11px] underline cursor-pointer"
                >
                  Limpiar texto
                </button>
              )}
            </div>

            <textarea
              id="batch-textarea"
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Pega el texto copiado de tus órdenes de compra, por ejemplo:\n\nOC 45892 Hoyts\nProveedor: Juan Perez\nMonto: $ 50.000\nDetalle: Insumos`}
              className="w-full p-3.5 rounded-xl bg-[#080c16] border border-slate-700/80 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y shadow-inner"
            />
          </div>

          {/* Results Analysis */}
          {extractedTokens.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              {/* Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider">
                    A Liberar (100%)
                  </div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">
                    {toLiberateList.length} <span className="text-xs font-normal text-slate-400">órdenes</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                  <div className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">
                    Falta 1 Firma
                  </div>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">
                    {toPartialSignList.length} <span className="text-xs font-normal text-slate-400">órdenes</span>
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

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25">
                  <div className="text-[11px] text-rose-300 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>No Halladas</span>
                    {notFoundList.length > 0 && (
                      <button
                        onClick={handleDeepSearch}
                        disabled={searchingDb}
                        className="text-[10px] text-rose-300 hover:text-rose-200 underline lowercase cursor-pointer"
                      >
                        {searchingDb ? "..." : "buscar"}
                      </button>
                    )}
                  </div>
                  <div className="text-xl font-bold text-rose-400 mt-0.5">
                    {notFoundList.length} <span className="text-xs font-normal text-slate-400">tokens</span>
                  </div>
                </div>
              </div>

              {/* 1. Fully Liberated Orders Preview List */}
              {toLiberateList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Órdenes listas para Liberación Completa ({toLiberateList.length}):</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-[#080c16] divide-y divide-slate-800/60 text-xs">
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

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 hidden sm:inline">
                            {match.statusDetail}
                          </span>
                          <div className="text-right font-mono text-slate-200 font-semibold text-xs">
                            {typeof match.order?.monto === "number"
                              ? `$ ${match.order.monto.toLocaleString("es-AR")}`
                              : match.order?.monto}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Partial Signature Orders Preview List */}
              {toPartialSignList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Órdenes con 1 firma registrada (pendientes de 2da firma) ({toPartialSignList.length}):</span>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 bg-[#080c16] divide-y divide-slate-800/60 text-xs">
                    {toPartialSignList.map((match, idx) => (
                      <div
                        key={match.order?.id || idx}
                        className="p-2.5 flex items-center justify-between hover:bg-white/[0.02] gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-bold text-white font-mono">
                            {match.order?.numOC}
                          </span>
                          <span className="text-slate-300 truncate">
                            {match.order?.razonSocial}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10.5px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {match.statusDetail}
                          </span>
                          <span className="font-mono text-slate-200 font-semibold text-xs">
                            {typeof match.order?.monto === "number"
                              ? `$ ${match.order.monto.toLocaleString("es-AR")}`
                              : match.order?.monto}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Over limit warning list */}
              {overLimitList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Órdenes que exceden la jerarquía de este firmante ({overLimitList.length}):</span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5 text-xs">
                    {overLimitList.map((match, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] text-rose-300">
                        <span><strong>{match.order?.numOC}</strong> - {match.order?.razonSocial} (${Number(match.order?.monto).toLocaleString("es-AR")})</span>
                        <span className="font-semibold">{match.statusDetail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Not Found Tokens Preview */}
              {notFoundList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-rose-400 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Tokens / OCs no encontradas ({notFoundList.length}):</span>
                    </div>
                    <button
                      onClick={handleDeepSearch}
                      disabled={searchingDb}
                      className="text-[11px] text-rose-300 hover:text-rose-200 underline font-normal cursor-pointer"
                    >
                      {searchingDb ? "Buscando en base de datos..." : "Buscar en base de datos"}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {notFoundList.map((m, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold"
                        >
                          <span>{m.rawToken}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-[10.5px] text-rose-300/80 leading-relaxed">
                      Estos valores no coincidieron con ninguna orden registrada en el sistema.
                    </p>
                  </div>
                </div>
              )}

              {/* 5. Already liberated preview */}
              {alreadyLiberatedList.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Órdenes ya liberadas anteriormente ({alreadyLiberatedList.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
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
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecuteBatch}
            disabled={totalExecutableCount === 0 || isProcessing}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 shadow-lg ${
              totalExecutableCount > 0 && !isProcessing
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Actualizando firmas y liberaciones...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  {toLiberateList.length > 0 && toPartialSignList.length > 0
                    ? `Liberar ${toLiberateList.length} y Firmar ${toPartialSignList.length}`
                    : toLiberateList.length > 0
                    ? `Marcar ${toLiberateList.length} como Liberadas`
                    : toPartialSignList.length > 0
                    ? `Registrar ${toPartialSignList.length} firmas pendientes`
                    : "No hay órdenes ejecutables"}
                </span>
                {totalExecutableCount > 0 && <ArrowRight className="w-3.5 h-3.5 ml-0.5" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
