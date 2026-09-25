"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/AppLayout";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  where,
  QueryConstraint,
  getDocs
} from "firebase/firestore";
import { 
  Plus, 
  Search, 
  Copy, 
  CheckCircle2, 
  X, 
  Edit3, 
  Loader2, 
  AlertCircle, 
  Check, 
  MessageSquare, 
  User as UserIcon, 
  ChevronDown, 
  Link2, 
  Folder, 
  FolderOpen, 
  FileSpreadsheet, 
  Eye, 
  Database,
  Clock,
  Send,
  PackageCheck,
  RefreshCw,
  CalendarDays,
  ArrowRight
} from "lucide-react";
import { getCreadorBadgeStyle, type Nota, type OrdenCompra } from "@/types/ordenes";
export type { Nota, OrdenCompra };
import { OrderFormModal } from "@/components/ordenes/OrderFormModal";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { OrderCmdBar } from "@/components/ordenes/OrderCmdBar";
import { OrderStatusMenu } from "@/components/ordenes/OrderStatusMenu";
import { DolarVentaBadge } from "@/components/ordenes/DolarVentaBadge";
import { exportToExcel } from "@/lib/exportToExcel";
import { syncOrderToMongo, deleteOrderFromMongo, fetchOrdersFromMongo, fetchOrdersStatsFromMongo, parseMongoDocToOrdenCompra } from "@/lib/serverSync";
import { registerNewProvider, getProvidersRegistry, cleanLegalSuffixDots } from "@/lib/providersRegistry";
import { 
  OrdenesStats, 
  OrderStatusKey,
  getOrderStatus, 
  trackOrderStatusChange, 
  trackOrderCreated, 
  trackOrderDeleted, 
  recalculateAndSyncStats 
} from "@/lib/ordenesStats";

const generateUniqueId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

export default function OrdenesDeComprasPage() {
  const { user } = useAuth();
  const isOrdenesUser = user?.email?.startsWith("ordenes");
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [dbSearchResults, setDbSearchResults] = useState<OrdenCompra[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"todos" | "numSolicitud" | "numOC" | "razonSocial">("todos");
  const [filterEmpresa, setFilterEmpresa] = useState<"Todas" | "Hoyts" | "CMK">("Todas");
  const [filterEstado, setFilterEstado] = useState<
    "Todas" | "Liberadas" | "Mandadas" | "Entregadas" | "Pendientes"
  >("Todas");

  // Server-side live counters from 'metadata/ordenes_stats'
  const [serverStats, setServerStats] = useState<OrdenesStats | null>(null);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  
  // Pagination State: Limit initial query reads to 15
  const [queryLimit, setQueryLimit] = useState(15);
  const [hasLoadedAllFromDb, setHasLoadedAllFromDb] = useState(false);
  const [loadingAllDb, setLoadingAllDb] = useState(false);
  const [isServerOffline, setIsServerOffline] = useState(false);
  const [isFallbackSearchingFirebase, setIsFallbackSearchingFirebase] = useState(false);

  // Filter creator state
  const [filterCreadoPor, setFilterCreadoPor] = useState<string>("todos");

  // Modal state for Add/Edit Order
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrden, setEditingOrden] = useState<OrdenCompra | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal state for Notes
  const [activeNotesOrden, setActiveNotesOrden] = useState<OrdenCompra | null>(null);
  const [newNotaText, setNewNotaText] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  // Form State
  const [empresa, setEmpresa] = useState<"Hoyts" | "CMK">("Hoyts");
  const [numSolicitud, setNumSolicitud] = useState("");
  const [numOC, setNumOC] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [formaPago, setFormaPago] = useState("30DFF");
  const [liberada, setLiberada] = useState(false);
  const [mandada, setMandada] = useState(false);
  const [cancelada, setCancelada] = useState(false);
  const [relatedOC, setRelatedOC] = useState("");
  const [linkSharepoint, setLinkSharepoint] = useState("");

  // Notification Toast State for Clipboard Copy & Actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Selection state for copying CMD folder creation commands (Julian only)
  const [selectedOCIds, setSelectedOCIds] = useState<string[]>([]);
  const [cmdFolderPath, setCmdFolderPath] = useState("");
  const savePathTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current clean username without @equipo.local
  const getCleanUsername = () => {
    if (!user) return "julian";
    if (user.displayName) return user.displayName;
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "julian";
  };

  // Load cmdFolderPath from Firestore database (with fallback to localStorage / default)
  useEffect(() => {
    let isMounted = true;
    const username = getCleanUsername();
    const defaultPath = `C:\\Users\\${username}\\`;

    // 1. Instant local display
    if (typeof window !== "undefined") {
      const localSaved = localStorage.getItem("cmd_folder_path");
      if (localSaved) {
        setCmdFolderPath(localSaved);
      } else {
        setCmdFolderPath(defaultPath);
      }
    }

    // Pre-cargar registro de proveedores desde MongoDB / localStorage para autocompletado instantáneo
    getProvidersRegistry().catch(() => {});

    // 2. Fetch official saved path from Firestore database
    const fetchPathFromDb = async () => {
      const db = getFirebaseDb();
      if (!db || !username) return;
      try {
        const docRef = doc(db, "user_preferences", username.toLowerCase());
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (data?.cmdFolderPath) {
            setCmdFolderPath(data.cmdFolderPath);
            if (typeof window !== "undefined") {
              localStorage.setItem("cmd_folder_path", data.cmdFolderPath);
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch user cmd path from Firestore:", err);
      }
    };

    fetchPathFromDb();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSavePath = (path: string) => {
    setCmdFolderPath(path);

    // Save locally for instant offline cache
    if (typeof window !== "undefined") {
      localStorage.setItem("cmd_folder_path", path);
    }

    // Debounced sync to Firestore database (protects free tier writes)
    if (savePathTimeoutRef.current) {
      clearTimeout(savePathTimeoutRef.current);
    }

    savePathTimeoutRef.current = setTimeout(async () => {
      const db = getFirebaseDb();
      const username = getCleanUsername();
      if (!db || !username) return;
      try {
        const docRef = doc(db, "user_preferences", username.toLowerCase());
        await setDoc(docRef, { 
          cmdFolderPath: path,
          updatedAt: serverTimestamp() 
        }, { merge: true });
      } catch (err) {
        console.warn("Could not save cmd path to Firestore:", err);
      }
    }, 600);
  };

  // Función para refrescar estadísticas desde MongoDB
  const refreshStatsFromMongo = useCallback(async () => {
    try {
      const ms = await fetchOrdersStatsFromMongo();
      if (ms) {
        setServerStats({
          ...ms,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("Aviso stats Mongo:", err);
    }
  }, []);

  // Actualización optimista inmediata (0ms) en la tarjeta de pendientes y contadores de estado
  const updateStatsOptimistic = useCallback(
    (oldStatus?: OrderStatusKey | null, newStatus?: OrderStatusKey | null) => {
      setServerStats((prev) => {
        if (!prev) {
          return {
            total: newStatus ? 1 : 0,
            pendiente: newStatus === "pendiente" ? 1 : 0,
            mandada: newStatus === "mandada" ? 1 : 0,
            liberada: newStatus === "liberada" ? 1 : 0,
            entregada: newStatus === "entregada" ? 1 : 0,
            cancelada: newStatus === "cancelada" ? 1 : 0,
            updatedAt: new Date().toISOString(),
          };
        }
        const next = { ...prev, updatedAt: new Date().toISOString() };
        if (!oldStatus && newStatus) {
          // Creación de nueva orden
          next.total = (next.total || 0) + 1;
          next[newStatus] = (next[newStatus] || 0) + 1;
        } else if (oldStatus && !newStatus) {
          // Eliminación de orden
          next.total = Math.max(0, (next.total || 0) - 1);
          next[oldStatus] = Math.max(0, (next[oldStatus] || 0) - 1);
        } else if (oldStatus && newStatus && oldStatus !== newStatus) {
          // Cambio de estado
          next[oldStatus] = Math.max(0, (next[oldStatus] || 0) - 1);
          next[newStatus] = (next[newStatus] || 0) + 1;
        }
        return next;
      });
    },
    []
  );

  // Cargar estadísticas iniciales, sincronizar periódicamente y al volver a enfocar la pestaña
  useEffect(() => {
    refreshStatsFromMongo();

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refreshStatsFromMongo();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const interval = setInterval(refreshStatsFromMongo, 30000);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [refreshStatsFromMongo]);

  const handleManualSyncStats = async () => {
    if (isSyncingStats) return;
    setIsSyncingStats(true);
    try {
      const fresh = await fetchOrdersStatsFromMongo();
      if (fresh) {
        setServerStats({
          ...fresh,
          updatedAt: new Date().toISOString(),
        });
        showToast("Contadores sincronizados con el servidor local");
      }
    } catch (err) {
      console.error("Error sincronizando contadores:", err);
      showToast("Error al sincronizar contadores");
    } finally {
      setIsSyncingStats(false);
    }
  };

  const getFormattedCreatedAt = (orden: OrdenCompra | null) => {
    if (!orden || !orden.createdAt) return "";
    let date: Date | null = null;
    const ca = orden.createdAt;
    
    if (ca && typeof ca === "object") {
      if ("toDate" in ca && typeof (ca as { toDate: () => unknown }).toDate === "function") {
        date = (ca as { toDate: () => Date }).toDate();
      } else if ("seconds" in ca && typeof (ca as { seconds: number }).seconds === "number") {
        date = new Date((ca as { seconds: number }).seconds * 1000);
      } else if ((ca as unknown) instanceof Date) {
        date = ca as unknown as Date;
      }
    }
    
    if (!date) return "";
    return `${date.toLocaleDateString("es-AR")} ${date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const isSearching = searchQuery.trim() !== "";
  const isJulian = user ? getCleanUsername().toLowerCase() === "julian" : false;
  const showCMDSection = filterEstado === "Pendientes" && isJulian;

  // Unique list of creators
  const uniqueCreators = useMemo(() => {
    const set = new Set<string>();
    // Pre-populate with standard requested users
    set.add("julian");
    set.add("oalvarez");
    set.add("talbrecht");
    
    // Scan loaded orders to add any others
    ordenes.forEach(o => {
      if (o.creadoPor) {
        set.add(o.creadoPor.trim());
      }
    });
    
    return Array.from(set);
  }, [ordenes]);

  // Helper to map Firestore doc to OrdenCompra
  const parseOrdenDoc = (id: string, data: Record<string, any>): OrdenCompra => ({
    id,
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

  // Debounce search query to search directly in MongoDB without lagging
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cargar órdenes directamente desde el servidor local (MongoDB) usando los índices optimizados
  const loadOrdersFromServer = useCallback(async () => {
    setLoading(true);
    setIsFallbackSearchingFirebase(false);
    try {
      const res = await fetchOrdersFromMongo({
        estado: filterEstado === "Todas" ? undefined : filterEstado.toLowerCase(),
        empresa: filterEmpresa === "Todas" ? undefined : filterEmpresa,
        creadoPor: filterCreadoPor === "todos" ? undefined : filterCreadoPor,
        search: debouncedSearchQuery.trim() || undefined,
        limit: hasLoadedAllFromDb ? 0 : queryLimit + 1,
      });
      setIsServerOffline(false);
      if (res && res.success && Array.isArray(res.ordenes)) {
        const docs: OrdenCompra[] = res.ordenes.map(parseMongoDocToOrdenCompra);
        docs.sort((a, b) => {
          const timeA = (a.createdAt && "seconds" in a.createdAt) ? (a.createdAt.seconds || 0) : 0;
          const timeB = (b.createdAt && "seconds" in b.createdAt) ? (b.createdAt.seconds || 0) : 0;
          if (timeB !== timeA) return timeB - timeA;
          const numA = parseInt(a.numOC, 10) || 0;
          const numB = parseInt(b.numOC, 10) || 0;
          return numB - numA;
        });
        setOrdenes(docs);
      }
    } catch (err) {
      console.error("Error al cargar órdenes desde el servidor local:", err);
      setIsServerOffline(true);

      // Si el servidor local está caído y el usuario está buscando algo, recurrir a Firebase como respaldo
      if (debouncedSearchQuery.trim()) {
        setIsFallbackSearchingFirebase(true);
        const db = getFirebaseDb();
        if (db) {
          try {
            const colRef = collection(db, "ordenes_compra");
            const q = query(
              colRef,
              where("numOC", ">=", debouncedSearchQuery.trim()),
              where("numOC", "<=", debouncedSearchQuery.trim() + "\uf8ff"),
              limit(25)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const fbDocs = snap.docs.map((d) => parseOrdenDoc(d.id, d.data()));
              setOrdenes(fbDocs);
            } else {
              setOrdenes([]);
            }
          } catch (fbErr) {
            console.warn("Aviso Firebase backup:", fbErr);
          }
        }
      } else {
        showToast("⚠️ Servidor local no disponible. Verificá la conexión.");
      }
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterEmpresa, filterCreadoPor, debouncedSearchQuery, queryLimit, hasLoadedAllFromDb]);

  useEffect(() => {
    loadOrdersFromServer();
  }, [loadOrdersFromServer]);

  // Búsqueda en memoria instantánea (todas las órdenes están cargadas desde el servidor)
  useEffect(() => {
    setIsSearchingDb(false);
    setDbSearchResults([]);
  }, [searchQuery]);

  // Helper to suggest next OC number based on the latest orders
  const getNextSuggestedOC = (ordersList: OrdenCompra[]): string => {
    if (!ordersList || ordersList.length === 0) return "";

    // Sort by createdAt descending to find the most recent
    const sorted = [...ordersList].sort((a, b) => {
      const timeA = (a.createdAt && "seconds" in a.createdAt) ? a.createdAt.seconds : 0;
      const timeB = (b.createdAt && "seconds" in b.createdAt) ? b.createdAt.seconds : 0;
      return timeB - timeA;
    });

    // Find the latest order that has a non-empty numOC
    const latestWithOC = sorted.find((o) => (o.numOC || "").trim() !== "");
    if (!latestWithOC) return "";

    const raw = latestWithOC.numOC.trim();
    const match = raw.match(/^(.*?)(\d+)(\D*)$/);
    if (!match) return "";

    const prefix = match[1];
    const numStr = match[2];
    const suffix = match[3];

    let baseNum = parseInt(numStr, 10);
    let baseNumLen = numStr.length;

    // Check if there is a higher number among the recent orders (e.g. top 25)
    for (const o of sorted.slice(0, 25)) {
      const oRaw = (o.numOC || "").trim();
      const oMatch = oRaw.match(/^(.*?)(\d+)(\D*)$/);
      if (oMatch && oMatch[1] === prefix && oMatch[3] === suffix) {
        const val = parseInt(oMatch[2], 10);
        if (val > baseNum && val - baseNum <= 100) {
          baseNum = val;
          baseNumLen = oMatch[2].length;
        }
      }
    }

    const nextNum = (baseNum + 1).toString();
    const padded = nextNum.padStart(baseNumLen, "0");
    return `${prefix}${padded}${suffix}`;
  };

  // Open Modal for Add
  const handleOpenAddModal = async () => {
    setEditingOrden(null);
    resetForm();

    const immediateNext = getNextSuggestedOC(ordenes);
    if (immediateNext) {
      setNumOC(immediateNext);
    }

    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (orden: OrdenCompra) => {
    setEditingOrden(orden);
    setEmpresa(orden.empresa || "Hoyts");
    setNumSolicitud(orden.numSolicitud || "");
    setNumOC(orden.numOC || "");
    setRazonSocial(orden.razonSocial || "");
    setMonto(orden.monto?.toString() || "");
    setMotivo(orden.motivo || "");
    setFormaPago(orden.formaPago || "30DFF");
    setLiberada(Boolean(orden.liberada));
    setMandada(Boolean(orden.mandada));
    setCancelada(Boolean(orden.cancelada));
    setRelatedOC(orden.relatedOC || "");
    setLinkSharepoint(orden.linkSharepoint || "");
    setIsModalOpen(true);
  };

  // Export filtered orders to Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredOrdenes.length === 0) {
      showToast("⚠️ No hay órdenes para exportar con los filtros actuales");
      return;
    }
    const dataToExport = filteredOrdenes.map((o) => {
      let estadoStr = "Pendiente";
      if (o.cancelada) estadoStr = "Cancelada";
      else if (o.entregada) estadoStr = "Entregada";
      else if (o.liberada) estadoStr = "Liberada";
      else if (o.mandada) estadoStr = "Mandada";

      let fechaStr = "";
      if (o.createdAt && typeof o.createdAt === "object" && "seconds" in o.createdAt) {
        fechaStr = new Date(o.createdAt.seconds * 1000).toLocaleDateString("es-AR");
      }

      return {
        "Empresa": o.empresa,
        "N° Solicitud": o.numSolicitud || "-",
        "N° OC": o.numOC,
        "Proveedor / Razón Social": o.razonSocial,
        "Monto ($)": typeof o.monto === "number" ? o.monto : Number(o.monto) || 0,
        "Forma de Pago": o.formaPago || "30DFF",
        "Estado": estadoStr,
        "Firmado 1": o.firmado1 ? "Sí" : "No",
        "Firmado 2": o.firmado2 ? "Sí" : "No",
        "Entregada": o.entregada ? "Sí" : "No",
        "Detalle / Motivo": o.motivo || "",
        "OC Relacionada": o.relatedOC || "",
        "Creado Por": o.creadoPor || "Usuario",
        "Link SharePoint": o.linkSharepoint || "",
        "Fecha Creación": fechaStr
      };
    });

    exportToExcel(dataToExport, `Ordenes_Compra_${new Date().toISOString().split("T")[0]}`);
    showToast("📊 Planilla de Órdenes exportada a Excel");
  };

  // Sync Bidirectional relationships for OCs in Firestore (Full Clique/Transitive Sync)
  const syncBidirectional = async (
    currentOC: string,
    oldOC: string,
    newRelatedStr: string,
    oldRelatedStr: string
  ) => {
    const db = getFirebaseDb();
    if (!db) return;

    const newOcs = newRelatedStr.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean);
    const oldOcs = oldRelatedStr.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean);

    const hasNameChanged = oldOC && oldOC !== currentOC;

    const colRef = collection(db, "ordenes_compra");

    // Helper to get search values for any format (string/number/leading zeros)
    const getSearchValues = (val: string) => {
      const searchValues: (string | number)[] = [val];
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        searchValues.push(numVal);
        searchValues.push(numVal.toString());
      }
      return Array.from(new Set(searchValues));
    };

    // Calculate cliques
    const newClique = Array.from(new Set([currentOC, ...newOcs]));
    const oldClique = oldOC ? Array.from(new Set([oldOC, ...oldOcs])) : [];

    // OCs that were removed from the relationship
    const removedOcs = oldClique.filter(x => !newClique.includes(x));

    // 1. Sync all active members of the new clique so they all list each other
    for (const member of newClique) {
      try {
        const uniqueSearchValues = getSearchValues(member);
        const q = query(colRef, where("numOC", "in", uniqueSearchValues));
        const querySnapshot = await getDocs(q);

        const linksToAdd = newClique.filter(x => x !== member);

        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          let relList = (data.relatedOC || "").split(/[\s,/\-]+/).map((s: string) => s.trim()).filter(Boolean);

          // Clean old reference if name changed
          if (hasNameChanged && oldOC) {
            relList = relList.filter((x: string) => x !== oldOC && Number(x) !== Number(oldOC));
          }

          // Clean any removed member references
          for (const rem of removedOcs) {
            relList = relList.filter((x: string) => x !== rem && Number(x) !== Number(rem));
          }

          // Add links from new clique
          for (const link of linksToAdd) {
            const hasLink = relList.some((x: string) => x === link || Number(x) === Number(link));
            if (!hasLink) {
              relList.push(link);
            }
          }

          await updateDoc(doc(db, "ordenes_compra", docSnap.id), {
            relatedOC: relList.join(", ")
          });
        }
      } catch (err) {
        console.error("Error syncing clique member:", err);
      }
    }

    // 2. Remove references from the removed OCs
    for (const rem of removedOcs) {
      try {
        const uniqueSearchValues = getSearchValues(rem);
        const q = query(colRef, where("numOC", "in", uniqueSearchValues));
        const querySnapshot = await getDocs(q);

        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          let relList = (data.relatedOC || "").split(/[\s,/\-]+/).map((s: string) => s.trim()).filter(Boolean);

          // Remove all members of the new clique from the removed OC
          for (const member of newClique) {
            relList = relList.filter((x: string) => x !== member && Number(x) !== Number(member));
          }

          // Also remove oldOC if name changed
          if (oldOC) {
            relList = relList.filter((x: string) => x !== oldOC && Number(x) !== Number(oldOC));
          }

          await updateDoc(doc(db, "ordenes_compra", docSnap.id), {
            relatedOC: relList.join(", ")
          });
        }
      } catch (err) {
        console.error("Error cleaning removed clique member:", err);
      }
    }
  };

  // Handle Save (Add or Edit)
  const handleSaveOrden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOrdenesUser) return;
    setSubmitting(true);

    const authorName = getCleanUsername();

    let finalLiberada = liberada;
    let finalMandada = mandada;
    let finalEntregada = editingOrden ? Boolean(editingOrden.entregada) : false;

    if (cancelada) {
      finalLiberada = false;
      finalMandada = false;
      finalEntregada = false;
    } else if (finalEntregada) {
      finalLiberada = false;
      finalMandada = false;
    } else if (finalLiberada) {
      finalMandada = false;
      finalEntregada = false;
    } else if (finalMandada) {
      finalLiberada = false;
      finalEntregada = false;
    }

    const dataToSave = {
      empresa,
      numSolicitud: numSolicitud.trim(),
      numOC: numOC.trim(),
      razonSocial: razonSocial.trim(),
      monto: Number(monto) || monto,
      motivo: motivo.trim(),
      formaPago: formaPago.trim() || "30DFF",
      liberada: finalLiberada,
      mandada: finalMandada,
      entregada: finalEntregada,
      cancelada,
      creadoPor: editingOrden?.creadoPor || authorName,
      relatedOC: relatedOC.trim(),
      enviado: editingOrden ? Boolean(editingOrden.enviado) : false,
      firmado1: editingOrden ? Boolean(editingOrden.firmado1) : false,
      firmado2: editingOrden ? Boolean(editingOrden.firmado2) : false,
      firmante1: editingOrden?.firmante1 || "",
      firmante2: editingOrden?.firmante2 || "",
      fechaFirma1: editingOrden?.fechaFirma1 || "",
      fechaFirma2: editingOrden?.fechaFirma2 || "",
      linkSharepoint: linkSharepoint.trim(),
    };

    const db = getFirebaseDb();

    if (editingOrden && editingOrden.id) {
      // Update existing order
      setOrdenes((prev) =>
        prev.map((item) => (item.id === editingOrden.id ? { ...item, ...dataToSave } : item))
      );
      syncOrderToMongo({ id: editingOrden.id, ...editingOrden, ...dataToSave });
      showToast("¡Orden de compra actualizada!");

      const oldStatus = getOrderStatus(editingOrden);
      const newStatus = getOrderStatus(dataToSave);
      if (oldStatus !== newStatus) {
        updateStatsOptimistic(oldStatus, newStatus);
        setTimeout(refreshStatsFromMongo, 800);
      }

      if (db) {
        try {
          const docRef = doc(db, "ordenes_compra", editingOrden.id);
          await updateDoc(docRef, dataToSave);
          if (oldStatus !== newStatus) {
            trackOrderStatusChange(db, oldStatus, newStatus);
          }
          // Sync bidirectional relationships in Firestore
          syncBidirectional(numOC.trim(), editingOrden.numOC.trim(), relatedOC.trim(), editingOrden.relatedOC || "");
        } catch (err) {
          console.warn("Aviso Firebase al actualizar orden:", err);
        }
      }
    } else {
      // Add new order
      const now = new Date();
      const localTimestamp = {
        seconds: Math.floor(now.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => now,
      };

      const newOrden: Omit<OrdenCompra, "id"> = {
        ...dataToSave,
        notas: [],
        createdAt: localTimestamp as any,
        fechaOC: now.toISOString(),
      };

      const tempId = generateUniqueId();
      setOrdenes((prev) => [{ id: tempId, ...newOrden }, ...prev]);
      
      const newStatus = getOrderStatus(newOrden);
      updateStatsOptimistic(null, newStatus);
      showToast("¡Orden de compra agregada!");

      if (db) {
        try {
          const docRef = await addDoc(collection(db, "ordenes_compra"), {
            ...newOrden,
            createdAt: serverTimestamp(),
          });
          trackOrderCreated(db, newOrden);
          // Sync bidirectional relationships in Firestore
          syncBidirectional(numOC.trim(), numOC.trim(), relatedOC.trim(), "");
          // Reemplazar tempId por docRef.id real en el estado de React
          setOrdenes((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, id: docRef.id } : item))
          );
          // Sincronizar hacia MongoDB una sola vez con el ID definitivo de Firebase y fecha válida
          syncOrderToMongo({ id: docRef.id, ...newOrden, fechaOC: now.toISOString() }).then(() => {
            setTimeout(refreshStatsFromMongo, 800);
          });
        } catch (err) {
          console.warn("Aviso Firebase al agregar orden:", err);
          syncOrderToMongo({ id: tempId, ...newOrden, fechaOC: now.toISOString() }).then(() => {
            setTimeout(refreshStatsFromMongo, 800);
          });
        }
      } else {
        syncOrderToMongo({ id: tempId, ...newOrden, fechaOC: now.toISOString() }).then(() => {
          setTimeout(refreshStatsFromMongo, 800);
        });
      }
    }

    resetForm();
    setIsModalOpen(false);
    setSubmitting(false);

    // Registrar proveedor automáticamente en el registro local para autocompletado inmediato
    if (dataToSave.razonSocial) {
      try {
        registerNewProvider(dataToSave.razonSocial);
      } catch (e) {
        console.warn("No se pudo registrar proveedor:", e);
      }
    }
  };

  const resetForm = () => {
    setEmpresa("Hoyts");
    setNumSolicitud("");
    setNumOC("");
    setRazonSocial("");
    setMonto("");
    setMotivo("");
    setFormaPago("30DFF");
    setLiberada(false);
    setMandada(false);
    setCancelada(false);
    setRelatedOC("");
    setLinkSharepoint("");
  };

  // Add Note to Order
  const handleAddNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotaText.trim() || !activeNotesOrden || !activeNotesOrden.id) return;

    setSavingNota(true);

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}`;

    const nuevaNota: Nota = {
      id: generateUniqueId(),
      texto: newNotaText.trim(),
      autor: getCleanUsername(),
      fecha: formattedDate,
    };

    const updatedNotas = [...(activeNotesOrden.notas || []), nuevaNota];

    // Optimistic UI update
    setOrdenes((prev) =>
      prev.map((item) => (item.id === activeNotesOrden.id ? { ...item, notas: updatedNotas } : item))
    );
    setActiveNotesOrden((prev) => (prev ? { ...prev, notas: updatedNotas } : null));

    if (activeNotesOrden.id) {
      syncOrderToMongo({ id: activeNotesOrden.id, ...activeNotesOrden, notas: updatedNotas });
      showToast("Nota agregada");
    }

    const db = getFirebaseDb();
    if (db && activeNotesOrden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", activeNotesOrden.id);
        await updateDoc(docRef, { notas: updatedNotas });
      } catch (err) {
        console.warn("Aviso Firebase al agregar nota:", err);
      }
    }

    setNewNotaText("");
    setSavingNota(false);
  };

  // Optimistic handler for status changes from OrderStatusMenu
  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    const target = ordenes.find((item) => item.id === ordenId);
    if (target) {
      const oldStatus = getOrderStatus(target);
      const newStatus = getOrderStatus({ ...target, ...updatedFields });
      if (oldStatus !== newStatus) {
        updateStatsOptimistic(oldStatus, newStatus);
        setTimeout(refreshStatsFromMongo, 800);
      }
    }
    setOrdenes((prev) =>
      prev.map((item) => (item.id === ordenId ? { ...item, ...updatedFields } : item))
    );
    syncOrderToMongo({ id: ordenId, ...updatedFields });
  };

  // Toggle Liberada Status
  const handleToggleLiberada = async (orden: OrdenCompra) => {
    if (isOrdenesUser) return;
    const newLiberada = !orden.liberada;
    const msg = orden.liberada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO liberada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como LIBERADA?`;
    if (!confirm(msg)) return;

    const updateData: Partial<OrdenCompra> = newLiberada
      ? { liberada: true, mandada: false, entregada: false }
      : { liberada: false, mandada: false, entregada: false, enviado: false, firmado1: false, firmado2: false };

    const oldStatus = getOrderStatus(orden);
    const newStatus = getOrderStatus({ ...orden, ...updateData });
    if (oldStatus !== newStatus) {
      updateStatsOptimistic(oldStatus, newStatus);
      setTimeout(refreshStatsFromMongo, 800);
    }

    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, ...updateData } : item))
    );

    if (orden.id) {
      syncOrderToMongo({ id: orden.id, ...orden, ...updateData });
    }

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, updateData);
        trackOrderStatusChange(db, oldStatus, newStatus);
      } catch (err) {
        console.warn("Aviso Firebase al actualizar liberada:", err);
      }
    }
  };

  // Toggle Mandada Status
  const handleToggleMandada = async (orden: OrdenCompra) => {
    if (isOrdenesUser) return;
    const newMandada = !orden.mandada;
    const msg = orden.mandada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO mandada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como MANDADA?`;
    if (!confirm(msg)) return;

    const updateData: Partial<OrdenCompra> = newMandada
      ? { mandada: true, liberada: false, entregada: false }
      : { mandada: false, liberada: false, entregada: false };

    const oldStatus = getOrderStatus(orden);
    const newStatus = getOrderStatus({ ...orden, ...updateData });
    if (oldStatus !== newStatus) {
      updateStatsOptimistic(oldStatus, newStatus);
      setTimeout(refreshStatsFromMongo, 800);
    }

    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, ...updateData } : item))
    );

    if (orden.id) {
      syncOrderToMongo({ id: orden.id, ...orden, ...updateData });
    }

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, updateData);
        trackOrderStatusChange(db, oldStatus, newStatus);
      } catch (err) {
        console.warn("Aviso Firebase al actualizar mandada:", err);
      }
    }
  };

  // Toggle Entregada Status
  const handleToggleEntregada = async (orden: OrdenCompra) => {
    if (isOrdenesUser) return;
    const newEntregada = !orden.entregada;
    const msg = orden.entregada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO entregada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como ENTREGADA?`;
    if (!confirm(msg)) return;

    const updateData: Partial<OrdenCompra> = newEntregada
      ? { entregada: true, liberada: false, mandada: false }
      : { entregada: false, liberada: true, mandada: false };

    const oldStatus = getOrderStatus(orden);
    const newStatus = getOrderStatus({ ...orden, ...updateData });
    if (oldStatus !== newStatus) {
      updateStatsOptimistic(oldStatus, newStatus);
      setTimeout(refreshStatsFromMongo, 800);
    }

    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, ...updateData } : item))
    );

    if (orden.id) {
      syncOrderToMongo({ id: orden.id, ...orden, ...updateData });
    }

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, updateData);
        trackOrderStatusChange(db, oldStatus, newStatus);
      } catch (err) {
        console.warn("Aviso Firebase al actualizar entregada:", err);
      }
    }
  };

  // Delete Order
  const handleDelete = async (id?: string) => {
    if (isOrdenesUser) return;
    if (!id) return;
    if (!confirm("¿Estás seguro de eliminar esta orden de compra?")) return;

    const targetOrden = ordenes.find((item) => item.id === id);
    if (targetOrden) {
      const delStatus = getOrderStatus(targetOrden);
      updateStatsOptimistic(delStatus, null);
      setTimeout(refreshStatsFromMongo, 800);
    }

    setOrdenes((prev) => prev.filter((item) => item.id !== id));
    deleteOrderFromMongo(id);
    showToast("Orden eliminada");

    const db = getFirebaseDb();
    if (db) {
      try {
        await deleteDoc(doc(db, "ordenes_compra", id));
        if (targetOrden) {
          trackOrderDeleted(db, targetOrden);
        }
      } catch (err) {
        console.warn("Aviso Firebase al eliminar orden:", err);
      }
    }
  };

  // Helper to generate the text format for a single order
  const getOrderCopyText = (orden: OrdenCompra, estado: string) => {
    if (estado === "Liberadas") {
      const cleanRazon = cleanLegalSuffixDots(orden.razonSocial);
      return `OC 0${orden.numOC} - ${cleanRazon}`;
    }

    const formattedMonto = typeof orden.monto === "number"
      ? `$ ${orden.monto.toLocaleString("es-AR")}`
      : orden.monto;

    const notasPart = orden.notas && orden.notas.length > 0
      ? "\nNotas:\n" + orden.notas.map(n => `- ${n.texto}`).join("\n")
      : "";

    const linkPart = orden.linkSharepoint ? `\nLink: ${orden.linkSharepoint}` : "";

    return `\n\n\nOC ${orden.numOC} ${orden.empresa}
Proveedor: ${orden.razonSocial}
Monto: ${formattedMonto}
Detalle: ${orden.motivo}
Forma de Pago: ${orden.formaPago}${notasPart}${linkPart}`;
  };

  // Copy Order Format to Clipboard
  const handleCopy = (orden: OrdenCompra) => {
    const copyText = getOrderCopyText(orden, filterEstado);
    navigator.clipboard.writeText(copyText);
    showToast(`¡Copiado OC ${orden.numOC}!`);
  };

  // Copy All Filtered Orders to Clipboard
  const handleCopyAll = () => {
    if (filteredOrdenes.length === 0) return;
    const joinSeparator = filterEstado === "Liberadas" ? "\n\n\n" : "\n";
    const joinedText = filteredOrdenes
      .map((orden) => getOrderCopyText(orden, filterEstado))
      .join(joinSeparator);
    navigator.clipboard.writeText(joinedText);
    showToast(`¡Copiadas ${filteredOrdenes.length} órdenes al portapapeles!`);
  };

  // Handle Drop Link for SharePoint / OneDrive folder
  const handleDropLink = async (e: React.DragEvent, orden: OrdenCompra) => {
    e.preventDefault();
    if (isOrdenesUser) return;
    const rawUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (!rawUrl) return;

    let finalUrl = rawUrl.trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    if (finalUrl && (finalUrl.startsWith("http://") || finalUrl.startsWith("https://"))) {
      // 1. Actualización optimista inmediata en React
      setOrdenes((prev) =>
        prev.map((item) => (item.id === orden.id ? { ...item, linkSharepoint: finalUrl } : item))
      );

      // 2. Sincronización en MongoDB (backend central)
      if (orden.id) {
        syncOrderToMongo({ id: orden.id, ...orden, linkSharepoint: finalUrl });
      }

      // 3. Respaldo en Firestore de forma no bloqueante con setDoc merge
      const db = getFirebaseDb();
      if (db && orden.id) {
        try {
          const docRef = doc(db, "ordenes_compra", orden.id);
          await setDoc(docRef, { linkSharepoint: finalUrl }, { merge: true });
        } catch (err) {
          console.warn("Aviso Firebase al sincronizar enlace:", err);
        }
      }

      showToast(`¡Enlace de carpeta guardado para OC ${orden.numOC}!`);
    } else {
      showToast("Por favor suelta un enlace válido");
    }
  };

  // Prompt user to paste SharePoint / OneDrive link
  const handlePromptLink = async (orden: OrdenCompra) => {
    if (isOrdenesUser) return;
    const currentLink = orden.linkSharepoint || "";
    const promptMessage = currentLink 
      ? `Modificar enlace de SharePoint/OneDrive para la OC ${orden.numOC} (deja vacío para eliminar):`
      : `Pega el enlace de SharePoint/OneDrive para la OC ${orden.numOC}:`;
    
    const url = prompt(promptMessage, currentLink);
    if (url === null) return; // User cancelled
    
    let cleanUrl = url.trim();
    
    // Si el usuario vació el campo, eliminamos el enlace
    if (cleanUrl === "") {
      setOrdenes((prev) =>
        prev.map((item) => (item.id === orden.id ? { ...item, linkSharepoint: "" } : item))
      );
      if (orden.id) {
        syncOrderToMongo({ id: orden.id, ...orden, linkSharepoint: "" });
      }
      const db = getFirebaseDb();
      if (db && orden.id) {
        try {
          const docRef = doc(db, "ordenes_compra", orden.id);
          await setDoc(docRef, { linkSharepoint: "" }, { merge: true });
        } catch (err) {
          console.warn("Aviso Firebase al limpiar enlace:", err);
        }
      }
      showToast(`Enlace de carpeta eliminado para OC ${orden.numOC}`);
      return;
    }

    // Normalizar URL agregando https:// si el usuario pegó el dominio directo (ej. cinehoyts.sharepoint.com/...)
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    try {
      new URL(cleanUrl);
    } catch {
      alert("Por favor, ingresa un enlace web válido (ejemplo: https://tuempresa.sharepoint.com/...)");
      return;
    }

    // 1. Actualización optimista inmediata en React
    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, linkSharepoint: cleanUrl } : item))
    );

    // 2. Sincronización en MongoDB (backend central)
    if (orden.id) {
      syncOrderToMongo({ id: orden.id, ...orden, linkSharepoint: cleanUrl });
    }

    // 3. Respaldo en Firestore con setDoc merge para no fallar si el doc no existe todavía
    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await setDoc(docRef, { linkSharepoint: cleanUrl }, { merge: true });
      } catch (err) {
        console.warn("Aviso Firebase al guardar enlace:", err);
      }
    }

    showToast(`¡Enlace guardado para OC ${orden.numOC}!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLoadAllFromDb = async () => {
    setLoadingAllDb(true);
    try {
      // Consulta directamente a nuestro servidor local (MongoDB) sin consumir lecturas de Firebase
      const res = await fetchOrdersFromMongo({ limit: 0 });
      if (!res || !res.success || !Array.isArray(res.ordenes)) {
        throw new Error("Respuesta inválida del servidor");
      }

      const allDocs: OrdenCompra[] = res.ordenes.map((docItem: any) => {
        let createdAtObj: any = null;
        if (docItem.fechaOC) {
          const d = new Date(docItem.fechaOC);
          createdAtObj = {
            seconds: Math.floor(d.getTime() / 1000),
            nanoseconds: 0,
          };
        } else if (docItem.createdAtFirebase) {
          const d = new Date(docItem.createdAtFirebase);
          createdAtObj = {
            seconds: Math.floor(d.getTime() / 1000),
            nanoseconds: 0,
          };
        } else if (docItem.createdAt) {
          const d = new Date(docItem.createdAt);
          createdAtObj = {
            seconds: Math.floor(d.getTime() / 1000),
            nanoseconds: 0,
          };
        }

        return parseOrdenDoc(docItem.firebaseId || docItem._id, {
          ...docItem,
          createdAt: createdAtObj,
        });
      });

      setOrdenes(allDocs);
      setHasLoadedAllFromDb(true);
      showToast(`¡Se cargaron ${allDocs.length} órdenes desde el servidor local!`);
    } catch (err) {
      console.error("Error al cargar todas las órdenes desde el servidor:", err);
      showToast("Error al cargar las órdenes desde el servidor.");
    } finally {
      setLoadingAllDb(false);
    }
  };

  // Combine live real-time orders with any deep search results from Firestore
  const combinedOrdenes = useMemo(() => {
    if (dbSearchResults.length === 0) return ordenes;
    const map = new Map<string, OrdenCompra>();
    ordenes.forEach((o) => {
      const key = o.id || o.numOC;
      if (key) map.set(key, o);
    });
    dbSearchResults.forEach((o) => {
      const key = o.id || o.numOC;
      if (key && !map.has(key)) {
        map.set(key, o);
      }
    });
    return Array.from(map.values());
  }, [ordenes, dbSearchResults]);

  // Filtered list
  const filteredOrdenes = combinedOrdenes.filter((orden) => {
    const matchesSearch = (() => {
      if (!searchQuery.trim()) return true;
      const queryText = searchQuery.toLowerCase();
      switch (searchField) {
        case "numSolicitud":
          return orden.numSolicitud.toLowerCase().includes(queryText);
        case "numOC":
          return (
            orden.numOC.toLowerCase().includes(queryText) ||
            (orden.relatedOC && orden.relatedOC.toLowerCase().includes(queryText))
          );
        case "razonSocial":
          return orden.razonSocial.toLowerCase().includes(queryText);
        case "todos":
        default:
          return (
            orden.numOC.toLowerCase().includes(queryText) ||
            (orden.relatedOC && orden.relatedOC.toLowerCase().includes(queryText)) ||
            orden.numSolicitud.toLowerCase().includes(queryText) ||
            orden.razonSocial.toLowerCase().includes(queryText) ||
            orden.motivo.toLowerCase().includes(queryText) ||
            (orden.creadoPor && orden.creadoPor.toLowerCase().includes(queryText))
          );
      }
    })();

    const matchesEmpresa =
      filterEmpresa === "Todas" || orden.empresa === filterEmpresa;

    const matchesEstado = (() => {
      if (filterEstado === "Todas") return true;
      
      // If filtering for other active states, exclude cancelled orders
      if (orden.cancelada) return false;
      
      if (filterEstado === "Liberadas") return Boolean(orden.liberada) && !orden.entregada;
      if (filterEstado === "Mandadas") return Boolean(orden.mandada) && !orden.liberada && !orden.entregada;
      if (filterEstado === "Entregadas") return Boolean(orden.entregada);
      if (filterEstado === "Pendientes") return !orden.liberada && !orden.mandada && !orden.entregada;
      
      return true;
    })();

    const matchesCreadoPor = (() => {
      if (filterCreadoPor === "todos") return true;
      return (orden.creadoPor || "").toLowerCase().trim() === filterCreadoPor.toLowerCase().trim();
    })();

    return matchesSearch && matchesEmpresa && matchesEstado && matchesCreadoPor;
  });

  // Limit visible items to queryLimit (slicing off the extra placeholder item we fetched to check hasMore)
  // Bypass slice when actively searching or when all DB is loaded
  const visibleOrdenes = (isSearching || hasLoadedAllFromDb)
    ? filteredOrdenes
    : filteredOrdenes.slice(0, queryLimit);
  const hasMore = (isSearching || hasLoadedAllFromDb)
    ? false
    : (ordenes.length > queryLimit || filteredOrdenes.length > queryLimit);

  // Helper to sanitize Windows folder names
  const sanitizeFolderName = (name: string) => {
    return name.replace(/[\\/:*?"<>|]/g, "").trim();
  };

  const getCMDCommand = () => {
    const selectedOrders = filteredOrdenes.filter(o => o.id && selectedOCIds.includes(o.id));
    if (selectedOrders.length === 0) return "";
    
    const folderNames = selectedOrders.map(orden => {
      const name = `OC ${orden.numOC} ${orden.empresa} ${orden.razonSocial}`;
      return `"${sanitizeFolderName(name)}"`;
    });

    const mkdirCmd = `mkdir ${folderNames.join(" ")}`;
    
    if (cmdFolderPath.trim()) {
      return `cd /d "${cmdFolderPath.trim()}"\r\n${mkdirCmd}`;
    }
    
    return mkdirCmd;
  };

  const handleCopyCMD = () => {
    const cmd = getCMDCommand();
    if (!cmd) {
      alert("Por favor selecciona al menos una orden de compra.");
      return;
    }
    navigator.clipboard.writeText(cmd);
    showToast("¡Comando CMD de carpetas copiado al portapapeles!");
  };

  return (
    <AppLayout 
      title="Órdenes de Compra" 
      subtitle="Gestión, edición, notas internas y copia rápida de solicitudes"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-xs shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Executive Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-white tracking-tight">
                Órdenes de Compra
              </h2>
              <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold uppercase tracking-wider">
                Control Corporativo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Gestión, autorización, notas internas y seguimiento presupuestario de Cinemark & Hoyts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <DolarVentaBadge />

            <button
              onClick={handleManualSyncStats}
              disabled={isSyncingStats}
              className={`px-3 py-2 rounded-xl border border-white/10 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm bg-[#0e1424] hover:bg-white/5 text-slate-200 hover:text-white cursor-pointer ${
                isSyncingStats ? "opacity-75 cursor-not-allowed" : ""
              }`}
              title="Sincronizar y recalcular contadores con la base de datos del servidor"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncingStats ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isSyncingStats ? "Sincronizando..." : "Sincronizar"}</span>
            </button>

            <button
              onClick={handleLoadAllFromDb}
              disabled={loadingAllDb || hasLoadedAllFromDb}
              className={`px-3.5 py-2 rounded-xl border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                hasLoadedAllFromDb
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-[#0e1424] hover:bg-white/5 border-white/10 text-slate-200 hover:text-white cursor-pointer"
              }`}
              title={hasLoadedAllFromDb ? "Toda la base de datos ya está cargada" : "Cargar todas las órdenes históricas de la base de datos"}
            >
              {loadingAllDb ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              ) : hasLoadedAllFromDb ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Database className="w-3.5 h-3.5 text-blue-400" />
              )}
              <span>{loadingAllDb ? "Cargando..." : hasLoadedAllFromDb ? "Toda la BD cargada" : "Cargar toda la BD"}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-[#0e1424] hover:bg-white/5 border border-white/10 text-slate-200 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              title="Descargar listado actual de órdenes en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>

            {!isOrdenesUser && (
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Orden</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Live Server Metrics Bar: Pendientes y En Autorización */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Pendientes */}
          <button
            type="button"
            onClick={() => {
              setFilterEstado("Pendientes");
              setQueryLimit(15);
            }}
            className={`glass-card p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              filterEstado === "Pendientes"
                ? "border-slate-400/60 bg-slate-500/10 shadow-lg shadow-slate-500/10 ring-1 ring-slate-400/30"
                : "border-white/10 hover:border-slate-400/40 hover:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="uppercase tracking-wider text-[10px] text-slate-300 font-bold">Órdenes Pendientes</span>
              <div className="p-2 rounded-xl bg-slate-500/15 text-slate-300 group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono text-slate-100 tracking-tight">
                {serverStats ? serverStats.pendiente.toLocaleString("es-AR") : (
                  <span className="inline-block w-8 h-7 bg-slate-700/50 animate-pulse rounded-lg" />
                )}
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/20 font-semibold">
                Sin enviar a autorizar
              </span>
            </div>
          </button>

          {/* Card 2: En Autorización */}
          <button
            type="button"
            onClick={() => {
              setFilterEstado("Mandadas");
              setQueryLimit(15);
            }}
            className={`glass-card p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              filterEstado === "Mandadas"
                ? "border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                : "border-white/10 hover:border-amber-500/40 hover:bg-white/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span className="uppercase tracking-wider text-[10px] text-amber-300 font-bold">En Autorización</span>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono text-amber-400 tracking-tight">
                {serverStats ? serverStats.mandada.toLocaleString("es-AR") : (
                  <span className="inline-block w-8 h-7 bg-slate-700/50 animate-pulse rounded-lg" />
                )}
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                Mandadas a firma
              </span>
            </div>
          </button>
        </div>

        {/* Botón de ancho completo hacia Estadísticas Mensuales */}
        <Link
          href="/estadisticas-mensuales"
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-blue-900/30 via-slate-900/40 to-indigo-950/30 hover:from-blue-900/50 hover:via-slate-900/60 hover:to-indigo-950/50 border border-blue-500/30 hover:border-blue-500/50 text-white transition-all shadow-sm group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:text-blue-300 transition-all">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">Ver estadísticas mensuales</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Nuevo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Comparativa trimestral de órdenes, análisis de días pico y desglose OPEX vs CAPEX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
            <span className="hidden sm:inline">Explorar métricas</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Buscador & Filters Bar */}
        <div className="glass-card border border-white/10 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl bg-[#0d1322]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
            {/* Buscador Search Input Group */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:max-w-md">
              {/* Dropdown de campo */}
              <div className="relative flex-shrink-0">
                <select
                  value={searchField}
                  onChange={(e) => {
                    setSearchField(e.target.value as "todos" | "numSolicitud" | "numOC" | "razonSocial");
                    setQueryLimit(15);
                  }}
                  className="w-full sm:w-auto pl-3.5 pr-8 py-2 text-xs rounded-xl bg-[#080d18] border border-white/10 text-white font-semibold focus:outline-none focus:border-blue-500 cursor-pointer appearance-none shadow-inner"
                >
                  <option value="todos" className="bg-[#0b0f19] text-white">Todos los campos</option>
                  <option value="numOC" className="bg-[#0b0f19] text-white">N° OC</option>
                  <option value="numSolicitud" className="bg-[#0b0f19] text-white">N° Solicitud</option>
                  <option value="razonSocial" className="bg-[#0b0f19] text-white">Proveedor</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Input de búsqueda */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setQueryLimit(15);
                  }}
                  placeholder="Buscar orden, proveedor..."
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-xl bg-[#080d18] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
                />
                {isSearchingDb && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setQueryLimit(15);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Aviso especial cuando el servidor local está offline */}
            {isServerOffline && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  {debouncedSearchQuery.trim()
                    ? "⚠️ Servidor local no disponible. Buscando en Firebase (modo de respaldo)."
                    : "⚠️ Servidor local no disponible. Verificá la conexión con tu servidor."}
                </span>
              </div>
            )}

            {/* Filter Pills for Empresa */}
            <div className="inline-flex items-center p-1 bg-[#080d18] rounded-xl border border-white/10 text-xs shadow-inner">
              <span className="text-slate-400 text-[10px] px-2 font-bold uppercase tracking-wider">Empresa</span>
              {(["Todas", "Hoyts", "CMK"] as const).map((emp) => {
                const isSelected = filterEmpresa === emp;
                return (
                  <button
                    key={emp}
                    onClick={() => {
                      setFilterEmpresa(emp);
                      setQueryLimit(15);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? emp === "Hoyts"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : emp === "CMK"
                          ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
                          : "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {emp}
                  </button>
                );
              })}
            </div>

            {/* Filter Pills for Estado */}
            <div className="inline-flex items-center p-1 bg-[#080d18] rounded-xl border border-white/10 text-xs flex-wrap gap-1 shadow-inner">
              <span className="text-slate-400 text-[10px] px-2 font-bold uppercase tracking-wider">Estado</span>
              {(
                [
                  { id: "Todas", label: "Todas", dot: null },
                  { id: "Pendientes", label: "Pendientes", dot: "bg-slate-400" },
                  { id: "Mandadas", label: "Mandadas", dot: "bg-amber-400" },
                  { id: "Liberadas", label: "Liberadas", dot: "bg-emerald-400" },
                  { id: "Entregadas", label: "Entregadas", dot: "bg-blue-400" },
                ] as const
              ).map((est) => {
                const isSelected = filterEstado === est.id;
                return (
                  <button
                    key={est.id}
                    onClick={() => {
                      setFilterEstado(est.id);
                      setQueryLimit(15);
                      setSelectedOCIds([]);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {est.dot && <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />}
                    <span>{est.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seccion CMD de Creacion de Carpetas (solo Julian, en Pendientes, si hay seleccionadas) */}
          <OrderCmdBar
            showCMDSection={showCMDSection}
            selectedOCIds={selectedOCIds}
            setSelectedOCIds={setSelectedOCIds}
            cmdFolderPath={cmdFolderPath}
            onSavePath={handleSavePath}
            cmdCommand={getCMDCommand()}
            onCopyCMD={handleCopyCMD}
          />

          {/* Leyenda de Estados & Referencia de Mismo Solicitante */}
          <div className="flex flex-wrap items-center gap-2 pt-2.5 text-[11px] text-slate-400 border-t border-white/5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mr-1">Guía de Estados:</span>
            <span className="inline-flex items-center gap-1.5 bg-slate-500/10 text-slate-300 px-2 py-0.5 rounded-md border border-slate-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Pendiente</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Mandada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Liberada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Entregada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2 py-0.5 rounded-md border border-red-500/20 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Cancelada</span>
            </span>

            {/* Badge de Mismo Solicitante */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px] font-medium ml-auto">
              <Link2 className="w-3 h-3 text-purple-400" />
              <span>Vinculadas: Mismo Solicitante</span>
            </div>
          </div>
        </div>

        {/* Table / List View */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
            <p className="text-xs">Cargando órdenes de compra de Firestore...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl bg-[#0d1322]">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#101726]/90 border-b border-white/10 text-gray-400 uppercase font-bold tracking-wider">
                    <tr>
                      {showCMDSection && (
                        <th className="px-4 py-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={visibleOrdenes.length > 0 && visibleOrdenes.every(o => o.id && selectedOCIds.includes(o.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newIds = [...new Set([...selectedOCIds, ...visibleOrdenes.map(o => o.id || "").filter(Boolean)])];
                                setSelectedOCIds(newIds);
                              } else {
                                const visibleIds = visibleOrdenes.map(o => o.id || "");
                                setSelectedOCIds(prev => prev.filter(id => !visibleIds.includes(id)));
                              }
                            }}
                            className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3.5">Estado</th>
                      <th className="px-4 py-3.5">Empresa</th>
                      <th className="px-4 py-3.5">N° Solicitud</th>
                      <th className="px-4 py-3.5">N° OC & Copiar</th>
                      <th className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <span>Creado Por</span>
                          <select
                            value={filterCreadoPor}
                            onChange={(e) => {
                              setFilterCreadoPor(e.target.value);
                              setQueryLimit(15);
                            }}
                            className={`border rounded px-1.5 py-0.5 text-[10px] font-semibold focus:outline-none cursor-pointer appearance-none pr-4.5 lowercase transition-colors ${
                              filterCreadoPor.toLowerCase().includes("oalvarez")
                                ? "bg-pink-500/15 border-pink-500/40 text-pink-300"
                                : filterCreadoPor.toLowerCase().includes("julian")
                                ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                                : filterCreadoPor.toLowerCase().includes("talbrecht")
                                ? "bg-red-500/15 border-red-500/40 text-red-300"
                                : "bg-white/5 border-white/10 text-gray-300 focus:border-emerald-500/50"
                            }`}
                            style={{ 
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(156, 163, 175, 0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                              backgroundPosition: 'right 4px center', 
                              backgroundSize: '8px', 
                              backgroundRepeat: 'no-repeat' 
                            }}
                          >
                            <option value="todos" className="bg-[#090d16] text-gray-300 uppercase">Todos</option>
                            {uniqueCreators.map((creator) => {
                              const cLower = creator.toLowerCase();
                              let optClass = "bg-[#090d16] text-gray-300";
                              if (cLower.includes("oalvarez")) optClass = "bg-[#180d15] text-pink-300";
                              else if (cLower.includes("julian")) optClass = "bg-[#0c1626] text-blue-300";
                              else if (cLower.includes("talbrecht")) optClass = "bg-[#1f0d0e] text-red-300";
                              return (
                                <option key={creator} value={creator} className={optClass}>
                                  {creator}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </th>
                      <th className="px-4 py-3.5">Proveedor</th>
                      <th className="px-4 py-3.5">Monto</th>
                      <th className="px-4 py-3.5">Forma Pago</th>
                      <th className="px-4 py-3.5">Descripción y Notas</th>
                      {!isOrdenesUser && <th className="px-4 py-3.5 text-right">Editar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {isSearchingDb && visibleOrdenes.length === 0 ? (
                      <tr>
                        <td colSpan={showCMDSection ? 11 : isOrdenesUser ? 9 : 10} className="px-4 py-14 text-center text-gray-400">
                          <div className="space-y-3 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                            <p className="font-semibold text-xs text-indigo-200">Buscando en la base de datos...</p>
                            <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                              Consultando órdenes coincidentes con &quot;{searchQuery}&quot;...
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : visibleOrdenes.length === 0 ? (
                      <tr>
                        <td colSpan={showCMDSection ? 11 : isOrdenesUser ? 9 : 10} className="px-4 py-12 text-center text-gray-500">
                          <div className="space-y-2 flex flex-col items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-gray-600 mx-auto" />
                            <p className="font-semibold text-xs text-gray-300">No se encontraron órdenes de compra</p>
                            <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                              {searchQuery || filterEmpresa !== "Todas" || filterEstado !== "Todas" || filterCreadoPor !== "todos"
                                ? "Intenta modificar los filtros o la búsqueda."
                                : "Aún no hay órdenes de compra registradas. ¡Agrega la primera!"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      visibleOrdenes.map((orden) => {
                      const isPendingSend = orden.liberada && !orden.mandada;
                      let rowClass = "hover:bg-white/[0.02] transition-all duration-200";
                      
                      if (orden.cancelada) {
                        rowClass = "bg-red-950/10 opacity-60 hover:opacity-80 border-l-4 border-l-red-600 transition-all duration-200";
                      } else if (isPendingSend) {
                        rowClass = "bg-red-500/5 hover:bg-red-500/10 border-l-2 border-l-red-500 transition-all duration-200";
                      }
                      return (
                        <tr key={orden.id} className={rowClass}>
                          {showCMDSection && (
                            <td className="px-4 py-4 w-10">
                              <input
                                type="checkbox"
                                checked={orden.id ? selectedOCIds.includes(orden.id) : false}
                                onChange={() => {
                                  if (!orden.id) return;
                                  setSelectedOCIds(prev =>
                                    prev.includes(orden.id!)
                                      ? prev.filter(id => id !== orden.id)
                                      : [...prev, orden.id!]
                                  );
                                }}
                                className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                              />
                            </td>
                          )}
                          {/* Selector Desplegable de Estado */}
                          <td className="px-4 py-4">
                            <OrderStatusMenu
                              orden={orden}
                              isOrdenesUser={isOrdenesUser}
                              onStatusChange={handleStatusChange}
                              showToast={showToast}
                            />
                          </td>

                        {/* Empresa Pill */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              orden.empresa === "Hoyts"
                                ? "bg-purple-900/30 text-purple-300 border-purple-700/40"
                                : "bg-teal-900/30 text-teal-300 border-teal-700/40"
                            }`}
                          >
                            {orden.empresa}
                          </span>
                        </td>

                        {/* N° Solicitud (Opcional) */}
                        <td className="px-4 py-3.5 font-mono text-slate-300">
                          {orden.numSolicitud || "-"}
                        </td>

                        {/* N° OC + Copy Button */}
                        <td 
                          className="px-4 py-3.5"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropLink(e, orden)}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <div className="inline-flex items-center gap-1.5 bg-black/40 border border-white/10 px-2 py-1 rounded-md">
                              <span className="font-mono font-bold text-blue-400 text-xs">
                                #{orden.numOC}
                              </span>
                              <button
                                onClick={() => handleCopy(orden)}
                                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                title="Copiar resumen de OC"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {orden.linkSharepoint ? (
                                <div className="inline-flex items-center gap-0.5">
                                  <a
                                    href={orden.linkSharepoint}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Abrir carpeta vinculada"
                                  >
                                    <FolderOpen className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => handlePromptLink(orden)}
                                    className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-blue-300 transition-colors"
                                    title="Modificar enlace de carpeta"
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handlePromptLink(orden)}
                                  className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                                  title="Pegar enlace de carpeta"
                                >
                                  <Folder className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {orden.relatedOC && (
                              <div className="flex flex-wrap items-center gap-1 mt-0.5 max-w-[200px]">
                                {orden.relatedOC.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean).map((ocNum, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setSearchQuery(ocNum)}
                                    className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 transition-all"
                                    title={`Click para buscar la OC ${ocNum}`}
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                    <span>Ref: OC {ocNum}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Creado Por */}
                        <td className="px-4 py-3.5">
                          {(() => {
                            const creatorStyle = getCreadorBadgeStyle(orden.creadoPor);
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] transition-colors ${creatorStyle.badge}`}>
                                <UserIcon className={`w-3 h-3 ${creatorStyle.icon}`} />
                                <span>{orden.creadoPor || "Usuario"}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* Proveedor */}
                        <td className="px-4 py-3.5 max-w-xs">
                          <div className="font-medium text-white truncate text-xs">
                            {orden.razonSocial}
                          </div>
                          {orden.cancelada && (
                            <div className="text-[10px] text-red-400 mt-0.5 bg-red-950/20 border border-red-500/20 px-2 py-0.5 rounded">
                              <span className="font-bold">Motivo Cancelación:</span>{" "}
                              {orden.notas && orden.notas.length > 0
                                ? orden.notas[orden.notas.length - 1].texto
                                : "(Sin notas)"}
                            </div>
                          )}
                        </td>

                        {/* Monto */}
                        <td className="px-4 py-3.5 font-mono font-bold text-emerald-400 text-xs">
                          {typeof orden.monto === "number"
                            ? `$ ${orden.monto.toLocaleString("es-AR")}`
                            : orden.monto}
                        </td>

                        {/* Forma Pago */}
                        <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                          {orden.formaPago || "30DFF"}
                        </td>

                        {/* Botón Ver Descripción / Card Detalle */}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setActiveNotesOrden(orden)}
                            className="px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-300 border border-blue-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Ver descripción completa, firmas y notas de la orden"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>Ver Descripción</span>
                            {orden.notas && orden.notas.length > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                {orden.notas.length}
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Action: Open Edit Form (Icon-only) */}
                        {!isOrdenesUser && (
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => handleOpenEditModal(orden)}
                              className="p-1.5 rounded-md bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 ml-auto transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Editar orden"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          </td>
                        )}
                      </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Cards View */}
              <div className="lg:hidden space-y-4">
                {isSearchingDb && visibleOrdenes.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 px-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="space-y-2 flex flex-col items-center justify-center">
                      <Loader2 className="w-7 h-7 text-indigo-400 animate-spin mx-auto" />
                      <p className="font-semibold text-xs text-indigo-200">Buscando en la base de datos...</p>
                      <p className="text-[10px] text-gray-400 max-w-xs mx-auto">
                        Consultando órdenes con &quot;{searchQuery}&quot;...
                      </p>
                    </div>
                  </div>
                ) : visibleOrdenes.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 px-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="space-y-1.5 flex flex-col items-center justify-center">
                      <AlertCircle className="w-7 h-7 text-gray-600 mx-auto" />
                      <p className="font-semibold text-xs text-gray-300">No se encontraron órdenes</p>
                      <p className="text-[10px] text-gray-500 max-w-xs mx-auto">
                        Prueba ajustando la búsqueda o seleccionando otro creador.
                      </p>
                    </div>
                  </div>
                ) : (
                  visibleOrdenes.map((orden) => {
                  const isPendingSend = orden.liberada && !orden.mandada;
                  let cardClass = "p-4 space-y-3 border border-white/10 rounded-2xl glass-card transition-all duration-200 shadow-md";
                  if (orden.cancelada) {
                    cardClass = "p-4 space-y-3 bg-red-950/10 opacity-60 border-l-4 border-l-red-600 border border-white/10 rounded-2xl glass-card transition-all duration-200 shadow-md";
                  } else if (isPendingSend) {
                    cardClass = "p-4 space-y-3 bg-red-500/5 border-l-4 border-l-red-500 border border-white/10 rounded-2xl glass-card transition-all duration-200 shadow-md";
                  }
                  return (
                    <div key={orden.id} className={cardClass}>
                      {/* Top Row: Empresa, OC number and Actions (Copiar/Editar) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {showCMDSection && (
                            <input
                              type="checkbox"
                              checked={orden.id ? selectedOCIds.includes(orden.id) : false}
                              onChange={() => {
                                if (!orden.id) return;
                                setSelectedOCIds(prev =>
                                  prev.includes(orden.id!)
                                    ? prev.filter(id => id !== orden.id)
                                    : [...prev, orden.id!]
                                );
                              }}
                              className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer mr-1.5"
                            />
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              orden.empresa === "Hoyts"
                                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                            }`}
                          >
                            {orden.empresa}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold text-xs">
                            #{orden.numOC}
                          </span>
                          {orden.relatedOC && (
                            <div className="flex flex-wrap items-center gap-1 ml-1.5">
                              {orden.relatedOC.split(/[\s,/\-]+/).map(s => s.trim()).filter(Boolean).map((ocNum, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSearchQuery(ocNum)}
                                  className="flex items-center gap-1 text-[8px] text-purple-300 font-bold bg-purple-500/15 px-1 rounded border border-purple-500/20 active:bg-purple-500/30 transition-all"
                                  title={`Click para buscar la OC ${ocNum}`}
                                >
                                  <Link2 className="w-2 h-2" />
                                  <span>Ref: {ocNum}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions (Copiar & Editar) */}
                        <div className="flex items-center gap-1.5">
                          {orden.linkSharepoint ? (
                            <div className="inline-flex items-center gap-1">
                              <a
                                href={orden.linkSharepoint}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded-lg border border-blue-500/30 bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                title="Abrir carpeta vinculada"
                              >
                                <FolderOpen className="w-3 h-3" />
                                <span>Carpeta</span>
                              </a>
                              <button
                                onClick={() => handlePromptLink(orden)}
                                className="p-1 rounded-lg border border-white/10 hover:bg-white/10 text-slate-400 hover:text-blue-300 transition-colors"
                                title="Modificar enlace de carpeta"
                              >
                                <Link2 className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePromptLink(orden)}
                              className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Pegar enlace de carpeta"
                            >
                              <Folder className="w-3 h-3" />
                              <span>Carpeta</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(orden)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-colors ${
                              filterEstado === "Liberadas"
                                ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                                : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                            }`}
                            title="Copiar resumen"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </button>
                          {!isOrdenesUser && (
                            <button
                              onClick={() => handleOpenEditModal(orden)}
                              className="p-1.5 rounded-lg bg-white/5 text-gray-300 border border-white/10 transition-colors inline-flex items-center justify-center"
                              title="Editar orden"
                            >
                              <Edit3 className="w-3 h-3 text-emerald-400" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Middle Details (Proveedor, Monto, Forma Pago) */}
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-semibold text-white truncate">
                          <span className="text-gray-400 font-normal">Proveedor: </span>
                          {orden.razonSocial}
                        </p>
                        
                        {orden.cancelada && (
                          <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 text-xs mt-1.5">
                            <span className="font-bold block text-[10px] uppercase tracking-wider">Motivo de Cancelación:</span>
                            <span className="block mt-0.5 text-gray-300">
                              {orden.notas && orden.notas.length > 0
                                ? orden.notas[orden.notas.length - 1].texto
                                : "(Sin notas registradas)"}
                            </span>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-white/5">
                          <div>
                            <span className="text-gray-400 block text-[10px]">Monto</span>
                            <span className="font-mono font-bold text-emerald-400 text-xs">
                              {typeof orden.monto === "number"
                                ? `$ ${orden.monto.toLocaleString("es-AR")}`
                                : orden.monto}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px]">Forma de Pago</span>
                            <span className="text-gray-200 font-medium">{orden.formaPago || "30DFF"}</span>
                          </div>
                        </div>

                        {orden.motivo && (
                          <div className="pt-1 text-[11px] text-gray-400 truncate">
                            <span className="text-gray-500">Detalle: </span>
                            {orden.motivo}
                          </div>
                        )}
                        <div className="text-[10px] flex items-center gap-1.5 pt-1">
                          <span className="text-gray-400">Creado por:</span>
                          {(() => {
                            const creatorStyle = getCreadorBadgeStyle(orden.creadoPor);
                            return (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${creatorStyle.badge}`}>
                                <UserIcon className={`w-2.5 h-2.5 ${creatorStyle.icon}`} />
                                <span>{orden.creadoPor || "Usuario"}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Bottom Row: Status Checkboxes & Notes Button */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                        {/* Status Checkbox Toggles */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <OrderStatusMenu
                            orden={orden}
                            isOrdenesUser={isOrdenesUser}
                            onStatusChange={handleStatusChange}
                            showToast={showToast}
                          />
                        </div>

                        {/* Botón Ver Descripción */}
                        <button
                          onClick={() => setActiveNotesOrden(orden)}
                          className="px-2.5 py-1 rounded-xl bg-indigo-500/15 hover:bg-indigo-600 hover:text-white text-indigo-300 border border-indigo-500/30 text-[10.5px] font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ver Descripción</span>
                          {orden.notas && orden.notas.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                              {orden.notas.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </div>

            {/* Botón Cargar Más y Cargar Todo */}
            <div className="py-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              {hasMore && !hasLoadedAllFromDb && (
                <button
                  onClick={() => setQueryLimit((prev) => prev + 15)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Cargar más órdenes (+15)</span>
                </button>
              )}
              {!hasLoadedAllFromDb && (
                <button
                  onClick={handleLoadAllFromDb}
                  disabled={loadingAllDb}
                  className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {loadingAllDb ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>{loadingAllDb ? "Cargando toda la base de datos..." : "Cargar todas las de la base de datos"}</span>
                </button>
              )}
              {hasLoadedAllFromDb && (
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Todas las órdenes de la base de datos están cargadas ({ordenes.length})</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalle, Descripción, Firmas y Notas de la Orden */}
      <OrderDetailModal
        orden={activeNotesOrden ? (ordenes.find((o) => o.id === activeNotesOrden.id) || activeNotesOrden) : null}
        onClose={() => setActiveNotesOrden(null)}
        isOrdenesUser={isOrdenesUser}
        onEdit={handleOpenEditModal}
        onStatusChange={handleStatusChange}
        newNotaText={newNotaText}
        setNewNotaText={setNewNotaText}
        savingNota={savingNota}
        onAddNota={handleAddNota}
        showToast={showToast}
        getFormattedCreatedAt={getFormattedCreatedAt}
      />

      {/* Modal para Agregar o Editar Solicitud de OC */}
      <OrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingOrden={editingOrden}
        ordenes={ordenes}
        empresa={empresa}
        setEmpresa={setEmpresa}
        numSolicitud={numSolicitud}
        setNumSolicitud={setNumSolicitud}
        numOC={numOC}
        setNumOC={setNumOC}
        razonSocial={razonSocial}
        setRazonSocial={setRazonSocial}
        monto={monto}
        setMonto={setMonto}
        motivo={motivo}
        setMotivo={setMotivo}
        formaPago={formaPago}
        setFormaPago={setFormaPago}
        cancelada={cancelada}
        setCancelada={setCancelada}
        relatedOC={relatedOC}
        setRelatedOC={setRelatedOC}
        linkSharepoint={linkSharepoint}
        setLinkSharepoint={setLinkSharepoint}
        submitting={submitting}
        onSave={handleSaveOrden}
        onDelete={handleDelete}
        getFormattedCreatedAt={getFormattedCreatedAt}
      />

    </AppLayout>
  );
}
