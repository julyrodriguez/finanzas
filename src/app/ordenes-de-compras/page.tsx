"use client";

import { useState, useEffect, useMemo } from "react";
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
  ShoppingBag, 
  Edit3, 
  Loader2, 
  AlertCircle, 
  Check, 
  Send, 
  MessageSquare, 
  User as UserIcon, 
  ChevronDown, 
  Link2, 
  Folder,
  FolderOpen, 
  FileSpreadsheet,
  Eye,
  Database
} from "lucide-react";
import type { Nota, OrdenCompra } from "@/types/ordenes";
export type { Nota, OrdenCompra };
import { OrderFormModal } from "@/components/ordenes/OrderFormModal";
import { OrderDetailModal } from "@/components/ordenes/OrderDetailModal";
import { OrderCmdBar } from "@/components/ordenes/OrderCmdBar";
import { OrderStatusMenu } from "@/components/ordenes/OrderStatusMenu";
import { exportToExcel } from "@/lib/exportToExcel";

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
  
  // Pagination State: Limit initial query reads to 15
  const [queryLimit, setQueryLimit] = useState(15);
  const [hasLoadedAllFromDb, setHasLoadedAllFromDb] = useState(false);
  const [loadingAllDb, setLoadingAllDb] = useState(false);

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

  // Load cmdFolderPath from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPath = localStorage.getItem("cmd_folder_path");
      if (savedPath) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCmdFolderPath(savedPath);
      }
    }
  }, []);

  const handleSavePath = (path: string) => {
    setCmdFolderPath(path);
    if (typeof window !== "undefined") {
      localStorage.setItem("cmd_folder_path", path);
    }
  };

  // Get current clean username without @equipo.local
  const getCleanUsername = () => {
    if (!user) return "Usuario";
    if (user.displayName) return user.displayName;
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "Usuario";
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

  // Load Firestore real-time data with query limits and status filters
  // Note: isSearching does NOT restart this listener to protect free tier quotas & preserve real-time updates!
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      setTimeout(() => {
        setLoading(false);
      }, 0);
      return;
    }

    let unsubscribe: () => void = () => {};

    const startListener = (useFilters: boolean) => {
      try {
        const colRef = collection(db, "ordenes_compra");
        let q;

        if (filterCreadoPor !== "todos") {
          // If a specific creator is filtered, query exactly the latest 100 for them
          // We DO NOT use orderBy to avoid composite index requirements!
          const constraints: QueryConstraint[] = [
            where("creadoPor", "==", filterCreadoPor)
          ];
          
          if (useFilters) {
            if (filterEstado === "Liberadas") {
              constraints.unshift(where("liberada", "==", true));
            } else if (filterEstado === "Mandadas") {
              constraints.unshift(where("mandada", "==", true));
            } else if (filterEstado === "Entregadas") {
              constraints.unshift(where("entregada", "==", true));
            } else if (filterEstado === "Pendientes") {
              constraints.unshift(where("liberada", "==", false));
            }
          }
          
          const fetchLimit = Math.max(100, queryLimit + 1);
          constraints.push(limit(fetchLimit));
          q = query(colRef, ...constraints);
        } else if (useFilters) {
          // Dynamic status filtering in Firestore to only read matching documents
          const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
          
          if (filterEstado === "Liberadas") {
            constraints.unshift(where("liberada", "==", true));
          } else if (filterEstado === "Mandadas") {
            constraints.unshift(where("mandada", "==", true));
          } else if (filterEstado === "Entregadas") {
            constraints.unshift(where("entregada", "==", true));
          } else if (filterEstado === "Pendientes") {
            // Pendientes are !liberada && !mandada, query by liberada === false
            constraints.unshift(where("liberada", "==", false));
          }

          constraints.push(limit(queryLimit + 1));
          q = query(colRef, ...constraints);
        } else {
          // Fallback query (or when state is 'Todas' and Creador is 'Todos')
          q = query(colRef, orderBy("createdAt", "desc"), limit(queryLimit + 1));
        }

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const docs: OrdenCompra[] = snapshot.docs.map((docSnap) => {
              return parseOrdenDoc(docSnap.id, docSnap.data());
            });

            // Sort manually on client to handle missing createdAt fields cleanly
            docs.sort((a, b) => {
              const timeA = (a.createdAt && "seconds" in a.createdAt) ? a.createdAt.seconds : 0;
              const timeB = (b.createdAt && "seconds" in b.createdAt) ? b.createdAt.seconds : 0;
              return timeB - timeA;
            });

            // Slice to first queryLimit + 1 if specific creator is filtered
            const finalDocs = filterCreadoPor !== "todos" ? docs.slice(0, queryLimit + 1) : docs;

            setTimeout(() => {
              setOrdenes(finalDocs);
              setLoading(false);
            }, 0);
          },
          (error: Error) => {
            // Check if error is due to missing index
            if (useFilters && error.message && error.message.includes("index")) {
              console.warn("Firestore index missing. Falling back to client-side filtering query...", error);
              // Retry without Firestore status filters (fall back to client-side filtering)
              startListener(false);
            } else {
              console.warn("Firestore snapshot listener error:", error);
              setTimeout(() => {
                setLoading(false);
              }, 0);
            }
          }
        );
      } catch (err) {
        console.warn("Firestore collection error:", err);
        setTimeout(() => {
          setLoading(false);
        }, 0);
      }
    };

    startListener(true);
    return () => unsubscribe();
  }, [queryLimit, filterEstado, filterCreadoPor]);

  // Targeted background search for older orders (e.g. 3+ digits or text)
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 3) {
      setDbSearchResults([]);
      setIsSearchingDb(false);
      return;
    }

    setIsSearchingDb(true);

    const timer = setTimeout(async () => {
      const db = getFirebaseDb();
      if (!db) {
        setIsSearchingDb(false);
        return;
      }

      try {
        const colRef = collection(db, "ordenes_compra");
        const foundDocsMap = new Map<string, OrdenCompra>();

        // Prefix match on numOC and numSolicitud
        const queries = [
          query(colRef, where("numOC", ">=", term), where("numOC", "<=", term + "\uf8ff"), limit(25)),
          query(colRef, where("numSolicitud", ">=", term), where("numSolicitud", "<=", term + "\uf8ff"), limit(25)),
        ];

        // Also handle numeric search if term is numeric
        const numVal = Number(term);
        if (!isNaN(numVal)) {
          queries.push(query(colRef, where("numOC", "==", numVal), limit(10)));
        }

        const snapshots = await Promise.all(queries.map((q) => getDocs(q).catch(() => null)));
        snapshots.forEach((snap) => {
          if (!snap) return;
          snap.docs.forEach((docSnap) => {
            foundDocsMap.set(docSnap.id, parseOrdenDoc(docSnap.id, docSnap.data()));
          });
        });

        // If prefix found nothing and term is alphanumeric, search recent 80 records for substring match
        if (foundDocsMap.size === 0) {
          const fallbackSnap = await getDocs(query(colRef, orderBy("createdAt", "desc"), limit(80))).catch(() => null);
          if (fallbackSnap) {
            const termLower = term.toLowerCase();
            fallbackSnap.docs.forEach((docSnap) => {
              const item = parseOrdenDoc(docSnap.id, docSnap.data());
              if (
                item.numOC.toLowerCase().includes(termLower) ||
                item.razonSocial.toLowerCase().includes(termLower) ||
                item.numSolicitud.toLowerCase().includes(termLower) ||
                (item.relatedOC && item.relatedOC.toLowerCase().includes(termLower))
              ) {
                foundDocsMap.set(docSnap.id, item);
              }
            });
          }
        }

        setDbSearchResults(Array.from(foundDocsMap.values()));
      } catch (err) {
        console.warn("Error searching Firestore:", err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingOrden(null);
    resetForm();
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

    const dataToSave = {
      empresa,
      numSolicitud: numSolicitud.trim(),
      numOC: numOC.trim(),
      razonSocial: razonSocial.trim(),
      monto: Number(monto) || monto,
      motivo: motivo.trim(),
      formaPago: formaPago.trim() || "30DFF",
      liberada,
      mandada,
      entregada: editingOrden ? Boolean(editingOrden.entregada) : false,
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

      if (db) {
        try {
          const docRef = doc(db, "ordenes_compra", editingOrden.id);
          await updateDoc(docRef, dataToSave);
          // Sync bidirectional relationships in Firestore
          syncBidirectional(numOC.trim(), editingOrden.numOC.trim(), relatedOC.trim(), editingOrden.relatedOC || "");
          showToast("¡Orden de compra actualizada!");
        } catch (err) {
          console.error("Error al actualizar orden:", err);
        }
      }
    } else {
      // Add new order
      const newOrden: Omit<OrdenCompra, "id"> = {
        ...dataToSave,
        notas: [],
        createdAt: serverTimestamp(),
      };

      const tempId = generateUniqueId();
      if (db) {
        try {
          await addDoc(collection(db, "ordenes_compra"), newOrden);
          // Sync bidirectional relationships in Firestore
          syncBidirectional(numOC.trim(), numOC.trim(), relatedOC.trim(), "");
          showToast("¡Orden de compra agregada!");
        } catch (err) {
          console.error("Error al agregar orden:", err);
          setOrdenes((prev) => [{ id: tempId, ...newOrden }, ...prev]);
        }
      } else {
        setOrdenes((prev) => [{ id: tempId, ...newOrden }, ...prev]);
      }
    }

    resetForm();
    setIsModalOpen(false);
    setSubmitting(false);
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

    const db = getFirebaseDb();
    if (db && activeNotesOrden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", activeNotesOrden.id);
        await updateDoc(docRef, { notas: updatedNotas });
        showToast("Nota agregada");
      } catch (err) {
        console.error("Error al agregar nota:", err);
      }
    }

    setNewNotaText("");
    setSavingNota(false);
  };

  // Optimistic handler for status changes from OrderStatusMenu
  const handleStatusChange = (ordenId: string, updatedFields: Partial<OrdenCompra>) => {
    setOrdenes((prev) =>
      prev.map((item) => (item.id === ordenId ? { ...item, ...updatedFields } : item))
    );
  };

  // Toggle Liberada Status
  const handleToggleLiberada = async (orden: OrdenCompra) => {
    if (isOrdenesUser) return;
    const newLiberada = !orden.liberada;
    const msg = orden.liberada
      ? `¿Estás seguro de marcar la OC ${orden.numOC} como NO liberada?`
      : `¿Estás seguro de marcar la OC ${orden.numOC} como LIBERADA?`;
    if (!confirm(msg)) return;

    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, ...(!newLiberada ? { enviado: false, firmado1: false, firmado2: false } : {}), liberada: newLiberada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        const updateData: Partial<OrdenCompra> = { liberada: newLiberada };
        if (!newLiberada) {
          updateData.enviado = false;
          updateData.firmado1 = false;
          updateData.firmado2 = false;
        }
        await updateDoc(docRef, updateData);
      } catch (err) {
        console.error("Error al actualizar liberada:", err);
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

    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, mandada: newMandada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { mandada: newMandada });
      } catch (err) {
        console.error("Error al actualizar mandada:", err);
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

    setOrdenes((prev) =>
      prev.map((item) => (item.id === orden.id ? { ...item, entregada: newEntregada } : item))
    );

    const db = getFirebaseDb();
    if (db && orden.id) {
      try {
        const docRef = doc(db, "ordenes_compra", orden.id);
        await updateDoc(docRef, { entregada: newEntregada });
      } catch (err) {
        console.error("Error al actualizar entregada:", err);
      }
    }
  };

  // Delete Order
  const handleDelete = async (id?: string) => {
    if (isOrdenesUser) return;
    if (!id) return;
    if (!confirm("¿Estás seguro de eliminar esta orden de compra?")) return;

    setOrdenes((prev) => prev.filter((item) => item.id !== id));
    const db = getFirebaseDb();
    if (db) {
      try {
        await deleteDoc(doc(db, "ordenes_compra", id));
        showToast("Orden eliminada");
      } catch (err) {
        console.error("Error al eliminar orden:", err);
      }
    }
  };

  // Helper to generate the text format for a single order
  const getOrderCopyText = (orden: OrdenCompra, estado: string) => {
    if (estado === "Liberadas") {
      return `OC 0${orden.numOC} - ${orden.razonSocial}`;
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
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      const db = getFirebaseDb();
      if (db && orden.id) {
        try {
          const docRef = doc(db, "ordenes_compra", orden.id);
          await updateDoc(docRef, { linkSharepoint: url });
          
          setOrdenes((prev) =>
            prev.map((item) => (item.id === orden.id ? { ...item, linkSharepoint: url } : item))
          );
          
          showToast(`¡Enlace de carpeta guardado para OC ${orden.numOC}!`);
        } catch (err) {
          console.error("Error al guardar enlace:", err);
          showToast("Error al vincular el enlace");
        }
      }
    } else {
      showToast("Por favor suelta un enlace válido");
    }
  };

  // Prompt user to paste SharePoint / OneDrive link
  const handlePromptLink = async (orden: OrdenCompra) => {
    if (isOrdenesUser) return;
    const url = prompt(`Pega el enlace de SharePoint/OneDrive para la OC ${orden.numOC}:`);
    if (url === null) return; // User cancelled
    
    const cleanUrl = url.trim();
    if (cleanUrl && (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://"))) {
      const db = getFirebaseDb();
      if (db && orden.id) {
        try {
          const docRef = doc(db, "ordenes_compra", orden.id);
          await updateDoc(docRef, { linkSharepoint: cleanUrl });
          
          setOrdenes((prev) =>
            prev.map((item) => (item.id === orden.id ? { ...item, linkSharepoint: cleanUrl } : item))
          );
          
          showToast(`¡Enlace guardado para OC ${orden.numOC}!`);
        } catch (err) {
          console.error("Error al guardar enlace:", err);
          showToast("Error al guardar el enlace");
        }
      }
    } else if (cleanUrl) {
      alert("Por favor, ingresa un enlace válido (debe empezar con http:// o https://)");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLoadAllFromDb = async () => {
    const db = getFirebaseDb();
    if (!db) return;
    setLoadingAllDb(true);
    try {
      const colRef = collection(db, "ordenes_compra");
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const allDocs = snap.docs.map((d) => parseOrdenDoc(d.id, d.data()));
      setOrdenes(allDocs);
      setQueryLimit(allDocs.length);
      setHasLoadedAllFromDb(true);
      showToast(`¡Se cargaron ${allDocs.length} órdenes de la base de datos!`);
    } catch (err) {
      console.error("Error al cargar todas las órdenes:", err);
      showToast("Error al cargar toda la base de datos.");
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
      
      if (filterEstado === "Liberadas") return orden.liberada && !orden.entregada;
      if (filterEstado === "Mandadas") return orden.mandada && !orden.liberada;
      if (filterEstado === "Entregadas") return Boolean(orden.entregada);
      if (filterEstado === "Pendientes") return !orden.liberada && !orden.mandada;
      
      return true;
    })();

    const matchesCreadoPor = (() => {
      if (filterCreadoPor === "todos") return true;
      return (orden.creadoPor || "").toLowerCase().trim() === filterCreadoPor.toLowerCase().trim();
    })();

    return matchesSearch && matchesEmpresa && matchesEstado && matchesCreadoPor;
  });

  // Limit visible items to queryLimit (slicing off the extra placeholder item we fetched to check hasMore)
  // Bypass slice when actively searching so they can see all matched items up to 300 documents
  const visibleOrdenes = isSearching ? filteredOrdenes : filteredOrdenes.slice(0, queryLimit);
  const hasMore = isSearching ? false : ordenes.length > queryLimit;

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
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-500 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Top Header Controls: Title, Metrics & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-500/10">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Solicitudes de Órdenes
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
                  <span className="font-medium text-slate-300">
                    Mostrando <strong className="text-white font-bold">{visibleOrdenes.length}</strong> de <strong className="text-white font-bold">{filteredOrdenes.length}</strong> órdenes
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {ordenes.filter(o => o.liberada).length} liberadas
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {ordenes.filter(o => o.mandada && !o.liberada).length} mandadas
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            {/* Cargar toda la base de datos Button */}
            <button
              onClick={handleLoadAllFromDb}
              disabled={loadingAllDb || hasLoadedAllFromDb}
              className={`px-4 py-2.5 rounded-xl border font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                hasLoadedAllFromDb
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                  : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:text-white cursor-pointer"
              }`}
              title={hasLoadedAllFromDb ? "Toda la base de datos ya está cargada" : "Cargar todas las órdenes históricas de la base de datos"}
            >
              {loadingAllDb ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              ) : hasLoadedAllFromDb ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Database className="w-4 h-4 text-indigo-400" />
              )}
              <span>{loadingAllDb ? "Cargando todo..." : hasLoadedAllFromDb ? "Toda la BD cargada" : "Cargar toda la BD"}</span>
            </button>

            {/* Exportar a Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              title="Descargar listado actual de órdenes en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>

            {!isOrdenesUser && (
              <button
                onClick={handleOpenAddModal}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Orden</span>
              </button>
            )}
          </div>
        </div>

        {/* Buscador & Filters Bar */}
        <div className="glass-card border border-white/10 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl bg-[#0e1322]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
            {/* Buscador Search Input Group */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:max-w-md">
              {/* Dropdown de campo */}
              <div className="relative flex-shrink-0">
                <select
                  value={searchField}
                  onChange={(e) => {
                    setSearchField(e.target.value as "todos" | "numSolicitud" | "numOC" | "razonSocial");
                    setQueryLimit(15);
                  }}
                  className="w-full sm:w-auto pl-3 pr-8 py-2 text-xs rounded-xl bg-[#080c16] border border-slate-700/80 text-white font-medium focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none shadow-sm"
                >
                  <option value="todos" className="bg-[#080c16] text-white">Todos los campos</option>
                  <option value="numOC" className="bg-[#080c16] text-white">N° OC</option>
                  <option value="numSolicitud" className="bg-[#080c16] text-white">N° Solicitud</option>
                  <option value="razonSocial" className="bg-[#080c16] text-white">Proveedor</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Input de búsqueda */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setQueryLimit(15);
                  }}
                  placeholder="Buscar orden, proveedor..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[#080c16] border border-slate-700/80 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm"
                />
                {isSearchingDb && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setQueryLimit(15);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills for Empresa */}
            <div className="inline-flex items-center p-1 bg-[#080c16] rounded-xl border border-slate-700/80 text-xs shadow-inner">
              <span className="text-gray-400 text-[11px] px-2.5 font-semibold uppercase tracking-wider">Empresa</span>
              {(["Todas", "Hoyts", "CMK"] as const).map((emp) => {
                const isSelected = filterEmpresa === emp;
                return (
                  <button
                    key={emp}
                    onClick={() => {
                      setFilterEmpresa(emp);
                      setQueryLimit(15);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? emp === "Hoyts"
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : emp === "CMK"
                          ? "bg-teal-600 text-white shadow-md shadow-teal-600/30"
                          : "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {emp}
                  </button>
                );
              })}
            </div>

            {/* Filter Pills for Estado */}
            <div className="inline-flex items-center p-1 bg-[#080c16] rounded-xl border border-slate-700/80 text-xs shadow-inner flex-wrap gap-0.5">
              <span className="text-gray-400 text-[11px] px-2.5 font-semibold uppercase tracking-wider">Estado</span>
              {(
                [
                  { id: "Todas", label: "Todas", dot: null },
                  { id: "Pendientes", label: "Pendientes", dot: "bg-slate-400" },
                  { id: "Mandadas", label: "Mandadas", dot: "bg-amber-400" },
                  { id: "Liberadas", label: "Liberadas", dot: "bg-emerald-400" },
                  { id: "Entregadas", label: "Entregadas", dot: "bg-indigo-400" },
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
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
          <div className="flex flex-wrap items-center gap-2.5 pt-3 text-[11px] text-gray-400 border-t border-white/5">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mr-1">Guía de Estados:</span>
            <span className="inline-flex items-center gap-1.5 bg-slate-500/10 text-slate-300 px-2.5 py-1 rounded-xl border border-slate-500/30 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Pendiente</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-xl border border-amber-500/30 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Mandada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-xl border border-emerald-500/30 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Liberada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 px-2.5 py-1 rounded-xl border border-indigo-500/30 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>Entregada</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-xl border border-red-500/30 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Cancelada</span>
            </span>

            {/* Badge Mejorado de Mismo Solicitante */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-semibold shadow-sm ml-auto">
              <Link2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Vinculadas: Mismo Solicitante</span>
            </div>
          </div>
        </div>

        {/* Table / List View */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs">Cargando órdenes de compra de Firestore...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-xl">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-semibold">
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
                            className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-semibold text-gray-300 focus:outline-none focus:border-emerald-500/50 cursor-pointer appearance-none pr-4.5 lowercase"
                            style={{ 
                              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(156, 163, 175, 0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                              backgroundPosition: 'right 4px center', 
                              backgroundSize: '8px', 
                              backgroundRepeat: 'no-repeat' 
                            }}
                          >
                            <option value="todos" className="bg-[#090d16] text-gray-300 uppercase">Todos</option>
                            {uniqueCreators.map((creator) => (
                              <option key={creator} value={creator} className="bg-[#090d16] text-gray-300">
                                {creator}
                              </option>
                            ))}
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
                        <td className="px-4 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              orden.empresa === "Hoyts"
                                ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                            }`}
                          >
                            {orden.empresa}
                          </span>
                        </td>

                        {/* N° Solicitud (Opcional) */}
                        <td className="px-4 py-4 font-mono text-gray-300">
                          {orden.numSolicitud || "-"}
                        </td>

                        {/* N° OC + Copy Button */}
                        <td 
                          className="px-4 py-4"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropLink(e, orden)}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                              <span className="font-mono font-bold text-emerald-400">
                                {orden.numOC}
                              </span>
                              <button
                                onClick={() => handleCopy(orden)}
                                className={`p-1 rounded transition-colors ${
                                  filterEstado === "Liberadas"
                                    ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white"
                                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white"
                                }`}
                                title="Copiar resumen de OC"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {orden.linkSharepoint ? (
                                <a
                                  href={orden.linkSharepoint}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white transition-colors"
                                  title="Abrir carpeta vinculada"
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <button 
                                  onClick={() => handlePromptLink(orden)}
                                  className="p-1 rounded border border-dashed border-white/20 text-gray-500 hover:text-gray-300 hover:border-gray-400 cursor-pointer transition-all flex items-center justify-center bg-transparent"
                                  title="Haz clic para pegar enlace o arrastra un enlace web aquí"
                                >
                                  <Folder className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            {orden.relatedOC && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 max-w-[200px]">
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
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-medium text-[11px]">
                            <UserIcon className="w-3 h-3 text-emerald-400" />
                            {orden.creadoPor || "Usuario"}
                          </span>
                        </td>

                        {/* Proveedor */}
                        <td className="px-4 py-4 max-w-xs">
                          <div className="font-medium text-white truncate">
                            {orden.razonSocial}
                          </div>
                          {orden.cancelada && (
                            <div className="text-[10px] text-red-400 mt-1 bg-red-950/20 border border-red-500/20 px-2 py-1 rounded-lg">
                              <span className="font-bold">Motivo Cancelación:</span>{" "}
                              {orden.notas && orden.notas.length > 0
                                ? orden.notas[orden.notas.length - 1].texto
                                : "(Sin notas registradas)"}
                            </div>
                          )}
                        </td>

                        {/* Monto */}
                        <td className="px-4 py-4 font-semibold text-emerald-300">
                          {typeof orden.monto === "number"
                            ? `$ ${orden.monto.toLocaleString("es-AR")}`
                            : orden.monto}
                        </td>

                        {/* Forma Pago */}
                        <td className="px-4 py-4 text-gray-300 font-medium">
                          {orden.formaPago || "30DFF"}
                        </td>

                        {/* Botón Ver Descripción / Card Detalle */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setActiveNotesOrden(orden)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-600 hover:text-white text-indigo-300 border border-indigo-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            title="Ver descripción completa, firmas y notas de la orden"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Ver Descripción</span>
                            {orden.notas && orden.notas.length > 0 && (
                              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                {orden.notas.length}
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Action: Open Edit Form (Icon-only) */}
                        {!isOrdenesUser && (
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => handleOpenEditModal(orden)}
                              className="p-1.5 rounded-lg bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 ml-auto transition-colors inline-flex items-center justify-center"
                              title="Editar orden"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
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
                          {orden.linkSharepoint && (
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
                            <span className="font-bold text-emerald-300 text-xs">
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
                        <div className="text-[10px] text-gray-500 flex items-center gap-1 pt-1">
                          <UserIcon className="w-3 h-3 text-emerald-400" />
                          <span>Creado por: {orden.creadoPor || "Usuario"}</span>
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
            <div className="py-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              {hasMore && !hasLoadedAllFromDb && (
                <button
                  onClick={() => setQueryLimit((prev) => prev + 15)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold transition-all shadow-lg inline-flex items-center gap-2 group cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                  <span>Cargar más órdenes (+15)</span>
                </button>
              )}
              {!hasLoadedAllFromDb && (
                <button
                  onClick={handleLoadAllFromDb}
                  disabled={loadingAllDb}
                  className="px-6 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  {loadingAllDb ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <Database className="w-4 h-4 text-indigo-400" />
                  )}
                  <span>{loadingAllDb ? "Cargando toda la base de datos..." : "Cargar todas las de la base de datos"}</span>
                </button>
              )}
              {hasLoadedAllFromDb && (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl inline-flex items-center gap-2">
                  <Check className="w-4 h-4" />
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
