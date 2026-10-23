"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Sparkles,
  Send,
  Paperclip,
  Mail,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  Trash2,
  ExternalLink,
  X,
  ChevronDown,
  FileText,
  Plus,
  AlertCircle,
  Scale,
  RefreshCw,
  Loader2,
  CheckSquare,
  Square,
  ArrowRight,
  Maximize2,
  Minimize2,
  GripVertical,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { toast } from "@/context/ToastContext";
import { parseEmailContent, ParsedEmail } from "@/lib/agent/emailParser";
import {
  Recordatorio,
  fetchRecordatorios,
  saveRecordatorio,
  toggleRecordatorioStatus,
  deleteRecordatorio,
} from "@/lib/agent/recordatoriosService";
import {
  fetchCotizacionesFromMongo,
  syncCotizacionToMongo,
  deleteCotizacionFromMongo,
  fetchPendientesFromMongo,
  syncPendienteToMongo,
  deletePendienteFromMongo,
  saveProveedorToMongo,
} from "@/lib/serverSync";
import { getFirebaseDb, isFirestoreDisabled, handleFirestoreError } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export type DockWall = "right" | "left" | "top" | "bottom";

export interface DockState {
  wall: DockWall;
  ratio: number; // 0 to 1 along that wall
}

const DEFAULT_DOCK: DockState = {
  wall: "right",
  ratio: 1.0, // bottom-right default
};

const DOCK_STORAGE_KEY = "finanbot_dock_state_v1";

function loadSavedDock(): DockState {
  if (typeof window === "undefined") return DEFAULT_DOCK;
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        ["right", "left", "top", "bottom"].includes(parsed.wall) &&
        typeof parsed.ratio === "number" &&
        !isNaN(parsed.ratio)
      ) {
        return {
          wall: parsed.wall,
          ratio: Math.max(0, Math.min(1, parsed.ratio)),
        };
      }
    }
  } catch {}
  return DEFAULT_DOCK;
}

function saveDockState(dock: DockState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(dock));
  } catch {}
}

function getWallDisplayName(wall: DockWall): string {
  switch (wall) {
    case "left":
      return "izquierda";
    case "right":
      return "derecha";
    case "top":
      return "superior";
    case "bottom":
      return "inferior";
  }
}

function getCoordinatesForDock(
  dock: DockState,
  elemWidth: number,
  elemHeight: number,
  windowWidth: number,
  windowHeight: number,
  margin = 20
): { x: number; y: number } {
  const maxAvailableX = Math.max(margin, windowWidth - elemWidth - margin);
  const maxAvailableY = Math.max(margin, windowHeight - elemHeight - margin);

  let x = maxAvailableX;
  let y = maxAvailableY;

  switch (dock.wall) {
    case "left":
      x = margin;
      y = margin + dock.ratio * (maxAvailableY - margin);
      break;
    case "right":
      x = maxAvailableX;
      y = margin + dock.ratio * (maxAvailableY - margin);
      break;
    case "top":
      y = margin;
      x = margin + dock.ratio * (maxAvailableX - margin);
      break;
    case "bottom":
      y = maxAvailableY;
      x = margin + dock.ratio * (maxAvailableX - margin);
      break;
  }

  return {
    x: Math.round(Math.max(margin, Math.min(maxAvailableX, x))),
    y: Math.round(Math.max(margin, Math.min(maxAvailableY, y))),
  };
}

function getDockFromCoordinates(
  x: number,
  y: number,
  elemWidth: number,
  elemHeight: number,
  windowWidth: number,
  windowHeight: number,
  margin = 20
): DockState {
  const maxAvailableX = Math.max(margin, windowWidth - elemWidth - margin);
  const maxAvailableY = Math.max(margin, windowHeight - elemHeight - margin);

  const clampedX = Math.max(margin, Math.min(maxAvailableX, x));
  const clampedY = Math.max(margin, Math.min(maxAvailableY, y));

  const distLeft = clampedX - margin;
  const distRight = maxAvailableX - clampedX;
  const distTop = clampedY - margin;
  const distBottom = maxAvailableY - clampedY;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  const rangeX = Math.max(1, maxAvailableX - margin);
  const rangeY = Math.max(1, maxAvailableY - margin);

  if (minDist === distLeft) {
    return {
      wall: "left",
      ratio: Math.max(0, Math.min(1, (clampedY - margin) / rangeY)),
    };
  } else if (minDist === distRight) {
    return {
      wall: "right",
      ratio: Math.max(0, Math.min(1, (clampedY - margin) / rangeY)),
    };
  } else if (minDist === distTop) {
    return {
      wall: "top",
      ratio: Math.max(0, Math.min(1, (clampedX - margin) / rangeX)),
    };
  } else {
    return {
      wall: "bottom",
      ratio: Math.max(0, Math.min(1, (clampedX - margin) / rangeX)),
    };
  }
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  emailAttached?: {
    subject: string;
    from: string;
    date: string;
  };
  actionCard?: {
    type: string;
    title: string;
    subtitle?: string;
    linkHref?: string;
    linkLabel?: string;
    badgeText?: string;
    details?: string[];
  };
}

export function AgentGlobalWidget() {
  const router = useRouter();
  const pathname = usePathname();

  // Widget Window State
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "recordatorios">("chat");
  const [isDraggingOverWidget, setIsDraggingOverWidget] = useState(false);

  // Mount & Dimensions State
  const [isMounted, setIsMounted] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 800,
  });

  // Wall Docking & Positioning State
  const [dockState, setDockState] = useState<DockState>(DEFAULT_DOCK);
  const [isDraggingPill, setIsDraggingPill] = useState(false);
  const [pillDragPos, setPillDragPos] = useState<{ x: number; y: number } | null>(null);

  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [modalDragPos, setModalDragPos] = useState<{ x: number; y: number } | null>(null);

  const pillDragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number } | null>(null);
  const pillHasMovedRef = useRef(false);

  const modalDragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number } | null>(null);
  const modalHasMovedRef = useRef(false);

  // Chat State
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<ParsedEmail | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recordatorios State
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [recFilter, setRecFilter] = useState<"todos" | "pendientes" | "completados">("pendientes");
  const [newRecTitle, setNewRecTitle] = useState("");
  const [newRecDate, setNewRecDate] = useState("");
  const [newRecTime, setNewRecTime] = useState("09:00");
  const [addingRec, setAddingRec] = useState(false);

  // Cached Quotes for Context
  const [quotesCache, setQuotesCache] = useState<any[]>([]);

  // Calculate pending reminders count for badge
  const pendingCount = recordatorios.filter((r) => !r.completado).length;

  // Initial welcome message
  useEffect(() => {
    try {
      const savedChat = localStorage.getItem("finanzas_agent_chat_history");
      if (savedChat) {
        setMessages(JSON.parse(savedChat));
        return;
      }
    } catch {}

    setMessages([
      {
        id: "welcome-1",
        role: "assistant",
        content: `👋 **¡Hola! Soy FinanBot, tu Asistente de Finanzas & Compras.**

Puedo ayudarte a automatizar tareas cotidianas:
- 📧 **Arrastrá cualquier correo (.eml o texto)** aquí para armar automáticamente una cotización con sus ítems.
- ✅ Escribime *"ya envié la cotización de X"* para cambiar su estado a **Enviada**.
- ⏰ Pedime *"haceme acordar pagarle a Edenor el viernes a las 11"* y lo agendo en tu lista de recordatorios.

¿Qué querés gestionar hoy?`,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("finanzas_agent_chat_history", JSON.stringify(messages.slice(-30)));
      } catch {}
    }
  }, [messages]);

  // Load recordatorios on mount and refresh
  const reloadRecordatorios = useCallback(async () => {
    try {
      const list = await fetchRecordatorios();
      setRecordatorios(list);
    } catch (err) {
      console.warn("Error cargando recordatorios:", err);
    }
  }, []);

  useEffect(() => {
    reloadRecordatorios();
  }, [reloadRecordatorios]);

  // Load and cache active quotes for the agent context
  const reloadQuotesCache = useCallback(async () => {
    try {
      // 1. Mongo
      const mongoQuotes = await fetchCotizacionesFromMongo();
      if (mongoQuotes && Array.isArray(mongoQuotes) && mongoQuotes.length > 0) {
        setQuotesCache(mongoQuotes);
        return;
      }

      // 2. Firestore fallback
      if (!isFirestoreDisabled()) {
        const db = getFirebaseDb();
        if (db) {
          const snap = await getDocs(collection(db, "cotizaciones"));
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setQuotesCache(list);
          return;
        }
      }

      // 3. LocalStorage fallback
      const local = localStorage.getItem("finanzas-cotizaciones");
      if (local) {
        setQuotesCache(JSON.parse(local));
      }
    } catch (err) {
      console.warn("Aviso cargando cotizaciones para agente:", err);
    }
  }, []);

  useEffect(() => {
    reloadQuotesCache();
  }, [reloadQuotesCache]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, activeTab]);

  // Mount effect & Window resize
  useEffect(() => {
    setIsMounted(true);
    setDockState(loadSavedDock());
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const handleOpenWidget = (e?: any) => {
      setIsOpen(true);
      setActiveTab("chat");
      if (e?.detail?.prompt) {
        setInputMessage(e.detail.prompt);
      }
    };
    window.addEventListener("open-agent-widget", handleOpenWidget);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("open-agent-widget", handleOpenWidget);
    };
  }, []);

  const modalWidth = Math.min(440, Math.max(300, windowDimensions.width - 32));
  const modalHeight = Math.min(600, Math.max(380, windowDimensions.height * 0.85));

  const pillCoords = isDraggingPill && pillDragPos
    ? pillDragPos
    : getCoordinatesForDock(
        dockState,
        240,
        54,
        windowDimensions.width,
        windowDimensions.height
      );

  const modalCoords = isDraggingModal && modalDragPos
    ? modalDragPos
    : getCoordinatesForDock(
        dockState,
        modalWidth,
        modalHeight,
        windowDimensions.width,
        windowDimensions.height
      );

  const handlePillPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pillDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: pillCoords.x,
      initialY: pillCoords.y,
    };
    pillHasMovedRef.current = false;
  };

  const handlePillPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pillDragStartRef.current) return;

    const dx = e.clientX - pillDragStartRef.current.clientX;
    const dy = e.clientY - pillDragStartRef.current.clientY;

    if (!pillHasMovedRef.current && Math.hypot(dx, dy) > 5) {
      pillHasMovedRef.current = true;
      setIsDraggingPill(true);
    }

    if (pillHasMovedRef.current) {
      const rawX = pillDragStartRef.current.initialX + dx;
      const rawY = pillDragStartRef.current.initialY + dy;
      const clampedX = Math.max(10, Math.min(windowDimensions.width - 240 - 10, rawX));
      const clampedY = Math.max(10, Math.min(windowDimensions.height - 54 - 10, rawY));
      setPillDragPos({ x: clampedX, y: clampedY });
    }
  };

  const handlePillPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pillDragStartRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (pillHasMovedRef.current && pillDragPos) {
      const newDock = getDockFromCoordinates(
        pillDragPos.x,
        pillDragPos.y,
        240,
        54,
        windowDimensions.width,
        windowDimensions.height
      );
      setDockState(newDock);
      saveDockState(newDock);
      toast.info("FinanBot reposicionado", `Fijado en pared ${getWallDisplayName(newDock.wall)}`);
    } else {
      setIsOpen(true);
    }

    pillDragStartRef.current = null;
    pillHasMovedRef.current = false;
    setIsDraggingPill(false);
    setPillDragPos(null);
  };

  const handlePillPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    pillDragStartRef.current = null;
    pillHasMovedRef.current = false;
    setIsDraggingPill(false);
    setPillDragPos(null);
  };

  const handleModalHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    modalDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: modalCoords.x,
      initialY: modalCoords.y,
    };
    modalHasMovedRef.current = false;
  };

  const handleModalHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modalDragStartRef.current) return;

    const dx = e.clientX - modalDragStartRef.current.clientX;
    const dy = e.clientY - modalDragStartRef.current.clientY;

    if (!modalHasMovedRef.current && Math.hypot(dx, dy) > 5) {
      modalHasMovedRef.current = true;
      setIsDraggingModal(true);
    }

    if (modalHasMovedRef.current) {
      const rawX = modalDragStartRef.current.initialX + dx;
      const rawY = modalDragStartRef.current.initialY + dy;
      const clampedX = Math.max(10, Math.min(windowDimensions.width - modalWidth - 10, rawX));
      const clampedY = Math.max(10, Math.min(windowDimensions.height - modalHeight - 10, rawY));
      setModalDragPos({ x: clampedX, y: clampedY });
    }
  };

  const handleModalHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modalDragStartRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (modalHasMovedRef.current && modalDragPos) {
      const newDock = getDockFromCoordinates(
        modalDragPos.x,
        modalDragPos.y,
        modalWidth,
        modalHeight,
        windowDimensions.width,
        windowDimensions.height
      );
      setDockState(newDock);
      saveDockState(newDock);
      toast.info("FinanBot reposicionado", `Fijado en pared ${getWallDisplayName(newDock.wall)}`);
    }

    modalDragStartRef.current = null;
    modalHasMovedRef.current = false;
    setIsDraggingModal(false);
    setModalDragPos(null);
  };

  const handleModalHeaderPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    modalDragStartRef.current = null;
    modalHasMovedRef.current = false;
    setIsDraggingModal(false);
    setModalDragPos(null);
  };

  const handleFlipWall = () => {
    let nextWall: DockWall = "left";
    if (dockState.wall === "left") nextWall = "right";
    else if (dockState.wall === "right") nextWall = "left";
    else if (dockState.wall === "top") nextWall = "bottom";
    else if (dockState.wall === "bottom") nextWall = "top";

    const nextDock: DockState = {
      wall: nextWall,
      ratio: dockState.ratio,
    };
    setDockState(nextDock);
    saveDockState(nextDock);
    toast.info("FinanBot movido", `Cambiado a pared ${getWallDisplayName(nextWall)}`);
  };

  // Global drag listener to highlight widget & safety reset
  useEffect(() => {
    const handleGlobalDragReset = () => {
      widgetDragCounterRef.current = 0;
      setIsDraggingOverWidget(false);
    };
    window.addEventListener("dragend", handleGlobalDragReset);
    window.addEventListener("drop", handleGlobalDragReset);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragReset);
      window.removeEventListener("drop", handleGlobalDragReset);
    };
  }, []);

  const widgetDragCounterRef = useRef(0);

  // Handle Drag & Drop on Widget without flickering
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    widgetDragCounterRef.current += 1;
    if (widgetDragCounterRef.current === 1) {
      setIsDraggingOverWidget(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    if (!isDraggingOverWidget) {
      setIsDraggingOverWidget(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    widgetDragCounterRef.current = Math.max(0, widgetDragCounterRef.current - 1);
    if (widgetDragCounterRef.current === 0) {
      setIsDraggingOverWidget(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    widgetDragCounterRef.current = 0;
    setIsDraggingOverWidget(false);

    // Open widget if closed
    if (!isOpen) setIsOpen(true);
    setActiveTab("chat");

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      await processUploadedFile(file);
      return;
    }

    // If dragged raw text
    const textData = e.dataTransfer.getData("text/plain");
    if (textData && textData.trim()) {
      const parsed = parseEmailContent(textData, "Texto Arrastrado");
      setPendingEmail(parsed);
      toast.info("Correo detectado", "Se leyó el texto arrastrado.");
    }
  };

  // Process a dropped or picked file (.eml, .txt, etc.)
  const processUploadedFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseEmailContent(text, file.name);
      setPendingEmail(parsed);

      toast.success(
        "Correo cargado con éxito",
        `Asunto: ${parsed.subject || file.name}`
      );

      // Add a system bubble into the chat previewing the email
      const userBubble: ChatMessage = {
        id: `email-${Date.now()}`,
        role: "user",
        content: `📧 **Correo arrastrado:** "${parsed.subject}"\nDe: ${parsed.from}\nFecha: ${parsed.date}`,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        emailAttached: {
          subject: parsed.subject,
          from: parsed.from,
          date: parsed.date,
        },
      };

      setMessages((prev) => [...prev, userBubble]);

      // Automatically ask the agent to parse and act on it
      await sendMessageToAgent(
        "Analizá este correo arrastrado. Si es un pedido de presupuesto o cotización de insumos, generá la cotización nueva con todos sus ítems; si tiene compromisos o fechas de vencimiento, programá los recordatorios.",
        parsed
      );
    } catch (err: any) {
      toast.error("Error al leer el archivo", err?.message || "Formato no compatible");
    }
  };

  // Execute an action returned by the agent
  const executeAgentAction = async (action: any): Promise<ChatMessage["actionCard"] | null> => {
    if (!action || !action.type) return null;

    try {
      // 1. ACTION: CREATE COTIZACION
      if (action.type === "create_cotizacion") {
        const payload = action.payload || {};
        const quoteId = `cot-${Date.now()}`;
        const quoteName = payload.name || `Cotización ${payload.providerName || "Insumos"} - ${new Date().toLocaleDateString("es-AR")}`;

        const rawItems = Array.isArray(payload.items) ? payload.items : [];
        const formattedItems = rawItems.map((item: any, idx: number) => ({
          id: `item-${Date.now()}-${idx}`,
          name: item.name || `Ítem ${idx + 1}`,
          baseUnit: item.baseUnit || "U",
          targetQuantity: Number(item.targetQuantity) || 1,
          description: item.specification || item.description || "",
        }));

        const providerId = `prov-${Date.now()}`;
        const providerQuotes: Record<string, any> = {};

        formattedItems.forEach((it: any, idx: number) => {
          const rawItem = rawItems[idx] || {};
          providerQuotes[it.id] = {
            currency: payload.currency || "ARS",
            presentationType: rawItem.unitsPerPresentation > 1 ? "package" : "base",
            presentationName: rawItem.presentationName || "Unidad",
            unitsPerPresentation: Number(rawItem.unitsPerPresentation) || 1,
            price: Number(rawItem.price) || 0,
            discount: Number(rawItem.discount) || 0,
            specification: rawItem.specification || "",
          };
        });

        const newQuote: any = {
          id: quoteId,
          name: quoteName,
          status: "borrador",
          exchangeRate: payload.exchangeRate || 1400,
          baseCurrency: payload.currency || "ARS",
          useRealLots: false,
          notes: payload.notes || `Generada automáticamente desde correo por FinanBot.\nPlazo: ${payload.deliveryTime || "-"}\nPago: ${payload.paymentTerms || "-"}\nValidez: ${payload.validityPeriod || "-"}`,
          items: formattedItems,
          providers: [
            {
              id: providerId,
              name: payload.providerName || "Proveedor Cotizante",
              quotes: providerQuotes,
              deliveryTime: payload.deliveryTime || "",
              paymentTerms: payload.paymentTerms || "",
              validityPeriod: payload.validityPeriod || "",
              notes: payload.notes || "",
            },
          ],
          createdBy: "FinanBot (Asistente IA)",
          createdAt: {
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: 0,
          },
        };

        // Dual-write: Mongo
        try {
          await syncCotizacionToMongo(newQuote);
        } catch (e) {
          console.warn("Aviso Mongo sync cotización:", e);
        }

        // Dual-write: Firestore
        if (!isFirestoreDisabled()) {
          const db = getFirebaseDb();
          if (db) {
            await setDoc(doc(db, "cotizaciones", quoteId), newQuote).catch(handleFirestoreError);
          }
        }

        // LocalStorage update
        try {
          const local = localStorage.getItem("finanzas-cotizaciones");
          const list = local ? JSON.parse(local) : [];
          localStorage.setItem("finanzas-cotizaciones", JSON.stringify([newQuote, ...list]));
        } catch {}

        reloadQuotesCache();
        toast.success("Nueva Cotización creada", `"${quoteName}" guardada en borrador.`);

        return {
          type: "cotizacion_creada",
          title: quoteName,
          subtitle: `Proveedor: ${payload.providerName || "Detectado"} • ${formattedItems.length} ítems`,
          linkHref: "/cotizaciones",
          linkLabel: "Ver Cotización en la plataforma",
          badgeText: "BORRADOR CREADO",
          details: formattedItems.slice(0, 3).map((it: any) => `• ${it.targetQuantity} ${it.baseUnit} - ${it.name}`),
        };
      }

      // 2. ACTION: UPDATE COTIZACION STATUS (e.g. "ya envié la cotización...")
      if (action.type === "update_cotizacion_status") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetQuoteId || "").toLowerCase().trim();
        const newStatus = payload.newStatus || "enviada";
        const sentAt = payload.sentAt || new Date().toISOString();

        // Search quote in cache or DB
        let target = quotesCache.find(
          (q) =>
            q.id === payload.targetQuoteId ||
            (q.name && q.name.toLowerCase().includes(queryText)) ||
            (Array.isArray(q.providers) &&
              q.providers.some((p: any) => p.name && p.name.toLowerCase().includes(queryText)))
        );

        if (!target && quotesCache.length > 0) {
          // Fallback: take most recent if ambiguous and query matched generic words
          target = quotesCache[0];
        }

        if (target) {
          const updatedQuote = {
            ...target,
            status: newStatus,
            sentAt: newStatus === "enviada" ? sentAt : target.sentAt,
          };

          // Dual-write: Mongo
          try {
            await syncCotizacionToMongo(updatedQuote);
          } catch (e) {
            console.warn("Aviso Mongo sync cotización status:", e);
          }

          // Dual-write: Firestore
          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            if (db) {
              await updateDoc(doc(db, "cotizaciones", target.id), {
                status: newStatus,
                sentAt: updatedQuote.sentAt || "",
              }).catch(handleFirestoreError);
            }
          }

          // LocalStorage
          try {
            const local = localStorage.getItem("finanzas-cotizaciones");
            if (local) {
              const list = JSON.parse(local);
              localStorage.setItem(
                "finanzas-cotizaciones",
                JSON.stringify(list.map((q: any) => (q.id === target.id ? updatedQuote : q)))
              );
            }
          } catch {}

          reloadQuotesCache();
          toast.success("Estado actualizado", `La cotización "${target.name}" ahora está en "${newStatus.toUpperCase()}".`);

          return {
            type: "cotizacion_enviada",
            title: target.name,
            subtitle: `Estado actualizado a: ${newStatus.toUpperCase()}`,
            linkHref: "/cotizaciones",
            linkLabel: "Ver en Cotizaciones",
            badgeText: newStatus.toUpperCase(),
          };
        } else {
          toast.warning("Cotización no encontrada", `No se encontró una cotización que coincida con "${queryText}".`);
        }
      }

      // 3. ACTION: DELETE COTIZACION
      if (action.type === "delete_cotizacion") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetQuoteId || "").toLowerCase().trim();

        const target = quotesCache.find(
          (q) =>
            q.id === payload.targetQuoteId ||
            (q.name && q.name.toLowerCase().includes(queryText)) ||
            (Array.isArray(q.providers) &&
              q.providers.some((p: any) => p.name && p.name.toLowerCase().includes(queryText)))
        );

        if (target) {
          try {
            await deleteCotizacionFromMongo(target.id);
          } catch (e) {
            console.warn("Aviso Mongo delete cotizacion:", e);
          }

          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            if (db && !target.id.startsWith("local-")) {
              await deleteDoc(doc(db, "cotizaciones", target.id)).catch(handleFirestoreError);
            }
          }

          try {
            const local = localStorage.getItem("finanzas-cotizaciones");
            if (local) {
              const list = JSON.parse(local);
              localStorage.setItem(
                "finanzas-cotizaciones",
                JSON.stringify(list.filter((q: any) => q.id !== target.id))
              );
            }
          } catch {}

          reloadQuotesCache();
          toast.success("Cotización eliminada", `Se eliminó "${target.name}".`);

          return {
            type: "cotizacion_eliminada",
            title: target.name,
            subtitle: "Cotización eliminada del sistema",
            linkHref: "/cotizaciones",
            linkLabel: "Ver Cotizaciones",
            badgeText: "ELIMINADA",
          };
        } else {
          toast.warning("No encontrada", `No se encontró cotización con "${queryText}".`);
        }
      }

      // 4. ACTION: SET WINNING PROVIDER
      if (action.type === "set_winning_provider") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetQuoteId || "").toLowerCase().trim();
        const provQuery = (payload.providerName || payload.providerId || "").toLowerCase().trim();

        let target = quotesCache.find(
          (q) =>
            q.id === payload.targetQuoteId ||
            (q.name && q.name.toLowerCase().includes(queryText)) ||
            (Array.isArray(q.providers) &&
              q.providers.some((p: any) => p.name && p.name.toLowerCase().includes(queryText)))
        );

        if (!target && quotesCache.length > 0) target = quotesCache[0];

        if (target) {
          const winnerProv = Array.isArray(target.providers)
            ? target.providers.find(
                (p: any) =>
                  p.id === payload.providerId ||
                  (p.name && p.name.toLowerCase().includes(provQuery))
              )
            : null;

          const winningProviderId = winnerProv?.id || payload.providerId || (target.providers?.[0]?.id ?? "");
          const winningProviderName = winnerProv?.name || payload.providerName || "Proveedor Adjudicado";

          const updatedQuote = {
            ...target,
            status: "finalizada",
            winningProviderId,
          };

          try {
            await syncCotizacionToMongo(updatedQuote);
          } catch (e) {
            console.warn("Aviso Mongo set winning provider:", e);
          }

          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            if (db) {
              await updateDoc(doc(db, "cotizaciones", target.id), {
                status: "finalizada",
                winningProviderId,
              }).catch(handleFirestoreError);
            }
          }

          try {
            const local = localStorage.getItem("finanzas-cotizaciones");
            if (local) {
              const list = JSON.parse(local);
              localStorage.setItem(
                "finanzas-cotizaciones",
                JSON.stringify(list.map((q: any) => (q.id === target.id ? updatedQuote : q)))
              );
            }
          } catch {}

          reloadQuotesCache();
          toast.success("Ganador adjudicado", `Cotización "${target.name}" adjudicada a "${winningProviderName}".`);

          return {
            type: "cotizacion_adjudicada",
            title: target.name,
            subtitle: `Ganador: ${winningProviderName} • Estado: FINALIZADA`,
            linkHref: "/cotizaciones",
            linkLabel: "Ver en Cotizaciones",
            badgeText: "ADJUDICADA",
          };
        } else {
          toast.warning("No encontrada", `No se encontró cotización para adjudicar.`);
        }
      }

      // 5. ACTION: CREATE RECORDATORIO
      if (action.type === "create_recordatorio") {
        const payload = action.payload || {};
        const saved = await saveRecordatorio({
          titulo: payload.title || "Recordatorio sin título",
          descripcion: payload.description || "",
          fecha: payload.date || new Date().toISOString().split("T")[0],
          hora: payload.hora || "09:00",
          prioridad: payload.priority || "media",
          categoria: payload.category || "finanzas",
          origen: "chat",
        });

        reloadRecordatorios();
        toast.success("Recordatorio agendado", `"${saved.titulo}" para el ${saved.fecha}`);

        return {
          type: "recordatorio_creado",
          title: saved.titulo,
          subtitle: `Programado para el ${saved.fecha} a las ${saved.hora} hs`,
          badgeText: "RECORDATORIO",
        };
      }

      // 6. ACTION: TOGGLE RECORDATORIO
      if (action.type === "toggle_recordatorio") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetId || "").toLowerCase().trim();
        const isCompletado = payload.completado !== false;

        const target = recordatorios.find(
          (r) =>
            r.id === payload.targetId ||
            (r.titulo && r.titulo.toLowerCase().includes(queryText))
        );

        if (target) {
          await toggleRecordatorioStatus(target.id, isCompletado);
          reloadRecordatorios();
          toast.success(
            isCompletado ? "Recordatorio completado" : "Recordatorio reactivado",
            `"${target.titulo}" actualizado.`
          );

          return {
            type: "recordatorio_actualizado",
            title: target.titulo,
            subtitle: `Estado: ${isCompletado ? "COMPLETADO ✅" : "PENDIENTE ⏰"}`,
            badgeText: isCompletado ? "COMPLETADO" : "RECORDATORIO",
          };
        } else {
          toast.warning("No encontrado", `No se encontró el recordatorio "${queryText}".`);
        }
      }

      // 7. ACTION: DELETE RECORDATORIO
      if (action.type === "delete_recordatorio") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetId || "").toLowerCase().trim();

        const target = recordatorios.find(
          (r) =>
            r.id === payload.targetId ||
            (r.titulo && r.titulo.toLowerCase().includes(queryText))
        );

        if (target) {
          await deleteRecordatorio(target.id);
          reloadRecordatorios();
          toast.success("Recordatorio eliminado", `"${target.titulo}" borrado.`);

          return {
            type: "recordatorio_eliminado",
            title: target.titulo,
            subtitle: "Recordatorio eliminado de la lista y calendario",
            badgeText: "ELIMINADO",
          };
        } else {
          toast.warning("No encontrado", `No se encontró el recordatorio "${queryText}".`);
        }
      }

      // 8. ACTION: CREATE PENDIENTE
      if (action.type === "create_pendiente") {
        const payload = action.payload || {};
        const pendId = `pend-${Date.now()}`;
        const rawEtapas = Array.isArray(payload.etapas) ? payload.etapas : [];
        const etapas = rawEtapas.map((et: string | any, idx: number) => ({
          id: `step-${Date.now()}-${idx}`,
          titulo: typeof et === "string" ? et : et.titulo || `Paso ${idx + 1}`,
          completado: false,
          createdAt: new Date().toISOString(),
        }));

        const newPendiente: any = {
          id: pendId,
          firebaseId: pendId,
          titulo: payload.titulo || "Nueva tarea pendiente",
          descripcion: payload.descripcion || "",
          prioridad: payload.prioridad || "media",
          categoria: payload.categoria || "General",
          completado: false,
          creadoPor: "FinanBot (Asistente IA)",
          fechaLimite: payload.fechaLimite || null,
          etapas,
          createdAt: new Date().toISOString(),
          completedAt: null,
        };

        try {
          await syncPendienteToMongo(newPendiente);
        } catch (e) {
          console.warn("Aviso Mongo sync pendiente:", e);
        }

        if (!isFirestoreDisabled()) {
          const db = getFirebaseDb();
          if (db) {
            await setDoc(doc(db, "pendientes", pendId), newPendiente).catch(handleFirestoreError);
          }
        }

        toast.success("Tarea creada en Pendientes", `"${newPendiente.titulo}" agregada.`);

        return {
          type: "pendiente_creado",
          title: newPendiente.titulo,
          subtitle: `Prioridad: ${newPendiente.prioridad.toUpperCase()} • ${etapas.length} etapas`,
          linkHref: "/pendientes",
          linkLabel: "Ver Tablero de Pendientes",
          badgeText: "PENDIENTE",
          details: etapas.slice(0, 3).map((e: any) => `• ${e.titulo}`),
        };
      }

      // 9. ACTION: TOGGLE PENDIENTE
      if (action.type === "toggle_pendiente") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetId || "").toLowerCase().trim();
        const isCompletado = payload.completado !== false;

        const mongoData = await fetchPendientesFromMongo();
        let target = mongoData?.pendientes.find(
          (p: any) =>
            p.id === payload.targetId ||
            p.firebaseId === payload.targetId ||
            (p.titulo && p.titulo.toLowerCase().includes(queryText))
        );

        if (target) {
          const updated = {
            ...target,
            completado: isCompletado,
            completedAt: isCompletado ? new Date().toISOString() : null,
          };

          try {
            await syncPendienteToMongo(updated);
          } catch (e) {
            console.warn("Aviso Mongo sync toggle pendiente:", e);
          }

          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            const targetId = target.id || target.firebaseId;
            if (db && targetId) {
              await updateDoc(doc(db, "pendientes", targetId), {
                completado: isCompletado,
                completedAt: updated.completedAt,
              }).catch(handleFirestoreError);
            }
          }

          toast.success(
            isCompletado ? "Tarea completada" : "Tarea reactivada",
            `"${target.titulo}" marcada como ${isCompletado ? "completada" : "pendiente"}.`
          );

          return {
            type: "pendiente_actualizado",
            title: target.titulo,
            subtitle: `Estado: ${isCompletado ? "COMPLETADA ✅" : "PENDIENTE ⏳"}`,
            linkHref: "/pendientes",
            linkLabel: "Ver en Pendientes",
            badgeText: isCompletado ? "COMPLETADO" : "PENDIENTE",
          };
        } else {
          toast.warning("No encontrado", `No se encontró la tarea "${queryText}".`);
        }
      }

      // 10. ACTION: DELETE PENDIENTE
      if (action.type === "delete_pendiente") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetId || "").toLowerCase().trim();

        const mongoData = await fetchPendientesFromMongo();
        const target = mongoData?.pendientes.find(
          (p: any) =>
            p.id === payload.targetId ||
            p.firebaseId === payload.targetId ||
            (p.titulo && p.titulo.toLowerCase().includes(queryText))
        );

        if (target) {
          const targetId = target.id || target.firebaseId;
          try {
            await deletePendienteFromMongo(targetId);
          } catch (e) {
            console.warn("Aviso Mongo delete pendiente:", e);
          }

          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            if (db && targetId) {
              await deleteDoc(doc(db, "pendientes", targetId)).catch(handleFirestoreError);
            }
          }

          toast.success("Tarea eliminada", `Se eliminó "${target.titulo}" de pendientes.`);

          return {
            type: "pendiente_eliminado",
            title: target.titulo,
            subtitle: "Tarea eliminada del tablero",
            linkHref: "/pendientes",
            linkLabel: "Ver Tablero",
            badgeText: "ELIMINADO",
          };
        } else {
          toast.warning("No encontrado", `No se encontró la tarea "${queryText}".`);
        }
      }

      // 11. ACTION: ADD ETAPA PENDIENTE
      if (action.type === "add_etapa_pendiente") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetId || "").toLowerCase().trim();
        const etapaTitulo = payload.etapaTitulo || "Nuevo paso";

        const mongoData = await fetchPendientesFromMongo();
        let target = mongoData?.pendientes.find(
          (p: any) =>
            p.id === payload.targetId ||
            p.firebaseId === payload.targetId ||
            (p.titulo && p.titulo.toLowerCase().includes(queryText))
        );

        if (!target && mongoData?.pendientes?.length) target = mongoData.pendientes[0];

        if (target) {
          const existingEtapas = Array.isArray(target.etapas) ? target.etapas : [];
          const newEtapa = {
            id: `step-${Date.now()}`,
            titulo: etapaTitulo,
            completado: false,
            createdAt: new Date().toISOString(),
          };
          const updated = {
            ...target,
            etapas: [...existingEtapas, newEtapa],
          };

          try {
            await syncPendienteToMongo(updated);
          } catch (e) {
            console.warn("Aviso Mongo add etapa pendiente:", e);
          }

          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            const targetId = target.id || target.firebaseId;
            if (db && targetId) {
              await updateDoc(doc(db, "pendientes", targetId), {
                etapas: updated.etapas,
              }).catch(handleFirestoreError);
            }
          }

          toast.success("Paso agregado", `Se sumó "${etapaTitulo}" a "${target.titulo}".`);

          return {
            type: "etapa_agregada",
            title: target.titulo,
            subtitle: `Paso agregado: ${etapaTitulo}`,
            linkHref: "/pendientes",
            linkLabel: "Ver en Pendientes",
            badgeText: "PASO AGREGADO",
          };
        } else {
          toast.warning("No encontrado", `No se encontró la tarea para agregarle el paso.`);
        }
      }

      // 12. ACTION: CREATE PIZARRON NOTE
      if (action.type === "create_pizarron_note") {
        const payload = action.payload || {};
        const noteId = `note-${Date.now()}`;
        const rawChecklist = Array.isArray(payload.checklist) ? payload.checklist : [];
        const checklist = rawChecklist.map((c: string | any, idx: number) => ({
          id: `chk-${Date.now()}-${idx}`,
          text: typeof c === "string" ? c : c.text || `Item ${idx + 1}`,
          done: false,
        }));

        const newNote = {
          id: noteId,
          title: payload.title || "Nota Pizarrón",
          content: payload.content || "",
          color: payload.color || "yellow",
          pinColor: payload.pinColor || "red",
          rotation: Number((Math.random() * 6 - 3).toFixed(1)),
          x: Math.floor(Math.random() * 180 + 100),
          y: Math.floor(Math.random() * 120 + 80),
          createdAt: new Date().toISOString(),
          checklist: checklist.length > 0 ? checklist : undefined,
          tag: payload.tag || "FinanBot",
        };

        try {
          fetch("https://apivacas.jariel.com.ar/api/pizarron/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newNote),
          }).catch(console.warn);
        } catch (e) {}

        if (!isFirestoreDisabled()) {
          const db = getFirebaseDb();
          if (db) {
            await setDoc(doc(db, "pizarron_notas", noteId), newNote).catch(handleFirestoreError);
          }
        }

        toast.success("Nota clavada en Pizarrón", `"${newNote.title}" agregada.`);

        return {
          type: "pizarron_nota_creada",
          title: newNote.title,
          subtitle: `Nota fijada en el pizarrón de Inicio (${newNote.color})`,
          linkHref: "/",
          linkLabel: "Ver en Inicio / Pizarrón",
          badgeText: "PIZARRÓN",
          details: newNote.content ? [newNote.content.slice(0, 80)] : undefined,
        };
      }

      // 13. ACTION: DELETE PIZARRON NOTE
      if (action.type === "delete_pizarron_note") {
        const payload = action.payload || {};
        const queryText = (payload.query || payload.targetId || "").toLowerCase().trim();

        let targetId = payload.targetId;
        let targetTitle = payload.query || "Nota";

        try {
          const res = await fetch("https://apivacas.jariel.com.ar/api/pizarron/notes");
          if (res.ok) {
            const data = await res.json();
            if (data?.notes && Array.isArray(data.notes)) {
              const found = data.notes.find(
                (n: any) =>
                  n.id === payload.targetId ||
                  (n.title && n.title.toLowerCase().includes(queryText)) ||
                  (n.content && n.content.toLowerCase().includes(queryText))
              );
              if (found) {
                targetId = found.id;
                targetTitle = found.title || targetTitle;
              }
            }
          }
        } catch (e) {}

        if (targetId) {
          try {
            fetch(`https://apivacas.jariel.com.ar/api/pizarron/notes/${encodeURIComponent(targetId)}`, {
              method: "DELETE",
            }).catch(console.warn);
          } catch (e) {}

          if (!isFirestoreDisabled()) {
            const db = getFirebaseDb();
            if (db) {
              await deleteDoc(doc(db, "pizarron_notas", targetId)).catch(handleFirestoreError);
            }
          }

          toast.success("Nota desclavada", `"${targetTitle}" retirada del pizarrón.`);

          return {
            type: "pizarron_nota_eliminada",
            title: targetTitle,
            subtitle: "Nota retirada del pizarrón de inicio",
            linkHref: "/",
            linkLabel: "Ver Pizarrón",
            badgeText: "RETIRADA",
          };
        } else {
          toast.warning("No encontrada", `No se encontró la nota "${queryText}".`);
        }
      }

      // 14. ACTION: CREATE PROVEEDOR
      if (action.type === "create_proveedor") {
        const payload = action.payload || {};
        const provId = `prov-${Date.now()}`;
        const newProv: any = {
          id: provId,
          nombre: payload.nombre || "Nuevo Proveedor",
          rubro: payload.rubro || "General",
          zona: payload.zona || "Buenos Aires",
          email: payload.email || (payload.emails && payload.emails[0]) || "",
          emails: Array.isArray(payload.emails) ? payload.emails : (payload.email ? [payload.email] : []),
          telefono: payload.telefono || "",
          sitio_web: payload.sitio_web || "",
          guardado: true,
          rating: payload.rating || 5,
          slaTags: payload.slaTags || ["Registrado por Asistente"],
          fuente: "asistente_ia",
          tipo_fuente: "manual",
          createdAt: new Date().toISOString(),
        };

        try {
          await saveProveedorToMongo(newProv);
        } catch (e) {
          console.warn("Aviso Mongo save proveedor:", e);
        }

        if (!isFirestoreDisabled()) {
          const db = getFirebaseDb();
          if (db) {
            await setDoc(doc(db, "proveedores", provId), newProv).catch(handleFirestoreError);
          }
        }

        toast.success("Proveedor registrado", `"${newProv.nombre}" agregado al directorio.`);

        return {
          type: "proveedor_creado",
          title: newProv.nombre,
          subtitle: `Rubro: ${newProv.rubro} • ${newProv.zona}`,
          linkHref: "/proveedores",
          linkLabel: "Ver en Directorio de Proveedores",
          badgeText: "PROVEEDOR",
          details: [
            newProv.email ? `Email: ${newProv.email}` : "",
            newProv.telefono ? `Tel: ${newProv.telefono}` : "",
          ].filter(Boolean),
        };
      }

      // 15. ACTION: NAVIGATE
      if (action.type === "navigate") {
        const payload = action.payload || {};
        const targetPath = payload.path || "/";
        router.push(targetPath);
        toast.info("Navegando", `Abriendo ${targetPath}`);

        return {
          type: "navegacion",
          title: `Navegación: ${targetPath}`,
          subtitle: "Página abierta en tu pantalla",
          linkHref: targetPath,
          linkLabel: "Ir a la sección",
          badgeText: "NAVEGACIÓN",
        };
      }

      // 16. ACTION: CALCULATE FINANCIAL
      if (action.type === "calculate_financial") {
        const payload = action.payload || {};
        const title = `Cálculo: ${payload.type?.toUpperCase() || "Financiero"}`;
        const subtitle = payload.resultDescription || `Monto base: $${payload.amount || 0}`;

        return {
          type: "calculo_financiero",
          title,
          subtitle,
          linkHref: "/calculadora",
          linkLabel: "Abrir Calculadora Completa",
          badgeText: "CÁLCULO",
          details: payload.rate ? [`Tasa / Alícuota aplicada: ${payload.rate}%`] : undefined,
        };
      }
    } catch (err: any) {
      console.error("Error ejecutando acción del agente:", err);
      toast.error("Error al ejecutar acción", err?.message);
    }

    return null;
  };

  // Send message to backend agent
  const sendMessageToAgent = async (overrideMsg?: string, emailData?: ParsedEmail) => {
    const textToSend = overrideMsg || inputMessage;
    if (!textToSend.trim() && !emailData && !pendingEmail) return;

    const emailToSend = emailData || pendingEmail;

    // Create user bubble
    if (!overrideMsg) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: textToSend,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setInputMessage("");
    setPendingEmail(null);
    setIsLoading(true);

    try {
      const requestPayload = {
        message: textToSend,
        history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        emailContext: emailToSend || undefined,
        currentQuotes: quotesCache.map((q) => ({
          id: q.id,
          name: q.name,
          status: q.status || "borrador",
          winningProviderId: q.winningProviderId,
        })),
      };

      let res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback directo a https://apivacas.jariel.com.ar/api/openclaw-agent/chat si /api/agent/chat falla en Vercel
        res = await fetch("https://apivacas.jariel.com.ar/api/openclaw-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        }).catch(() => null);
      }

      if (!res || !res.ok) {
        throw new Error(`Error en el servidor: HTTP ${res?.status || 500}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo obtener respuesta del asistente.");
      }

      const { reply, action, intent } = json.data;

      // Execute action or handle security violation
      let actionCard: ChatMessage["actionCard"] | null = null;
      if (intent === "security_violation") {
        actionCard = {
          type: "security_violation",
          title: "Acción Fuera de Dominio Bloqueada",
          subtitle: "Guardrail de Seguridad Activado",
          badgeText: "SEGURIDAD",
          details: [
            "🛡️ FinanBot opera exclusivamente dentro de la aplicación Compras & Finanzas.",
            "❌ No se permite ejecutar comandos de terminal, alterar bases de datos completas o intervenir recursos fuera de la página.",
          ],
        };
        toast.warning("Operación no permitida", "El asistente opera exclusivamente en las funciones de la web.");
      } else if (action && action.type) {
        actionCard = await executeAgentAction(action);
      }

      // Add assistant response
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: reply || "Listo, procesado.",
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        actionCard: actionCard || undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Error comunicando con asistente:", err);
      toast.error("Error del asistente", err.message || "Error al conectar");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Disculpá, ocurrió un problema al procesar tu solicitud: *${err.message}*.\nPor favor verificá tu conexión o reintentá en unos segundos.`,
          timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new manual reminder
  const handleAddManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecTitle.trim()) return;

    setAddingRec(true);
    try {
      const saved = await saveRecordatorio({
        titulo: newRecTitle.trim(),
        fecha: newRecDate || new Date().toISOString().split("T")[0],
        hora: newRecTime || "09:00",
        completado: false,
        prioridad: "media",
        origen: "manual",
      });

      setNewRecTitle("");
      setNewRecDate("");
      reloadRecordatorios();
      toast.success("Recordatorio creado", `"${saved.titulo}"`);
    } catch (err: any) {
      toast.error("Error al crear recordatorio", err.message);
    } finally {
      setAddingRec(false);
    }
  };

  // Toggle reminder done/undone
  const handleToggleReminder = async (rec: Recordatorio) => {
    const nextState = !rec.completado;
    // Optimistic
    setRecordatorios((prev) =>
      prev.map((r) => (r.id === rec.id ? { ...r, completado: nextState } : r))
    );
    try {
      await toggleRecordatorioStatus(rec.id, nextState);
    } catch {
      reloadRecordatorios();
    }
  };

  // Delete reminder
  const handleDeleteReminder = async (id: string) => {
    setRecordatorios((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteRecordatorio(id);
      toast.info("Recordatorio eliminado");
    } catch {
      reloadRecordatorios();
    }
  };

  // Filtered reminders
  const filteredRecordatorios = recordatorios.filter((r) => {
    if (recFilter === "pendientes") return !r.completado;
    if (recFilter === "completados") return r.completado;
    return true;
  });

  if (!isMounted) return null;

  return (
    <>
      {/* File input fallback for dragging / manual picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processUploadedFile(e.target.files[0]);
          }
        }}
        accept=".eml,.msg,.txt,.pdf"
        className="hidden"
      />

      {/* Floating Trigger Button (Movable along any wall) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="finanbot-pill-outer"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 9990,
              pointerEvents: "none",
            }}
            animate={{
              x: pillCoords.x,
              y: pillCoords.y,
            }}
            transition={
              isDraggingPill
                ? { duration: 0 }
                : { type: "spring", stiffness: 350, damping: 28 }
            }
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              style={{ pointerEvents: "auto" }}
            >
              <div
                data-local-dropzone="true"
                onPointerDown={handlePillPointerDown}
                onPointerMove={handlePillPointerMove}
                onPointerUp={handlePillPointerUp}
                onPointerCancel={handlePillPointerCancel}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full shadow-2xl backdrop-blur-2xl transition-all select-none cursor-grab active:cursor-grabbing ${
                  isDraggingPill
                    ? "bg-indigo-950/95 ring-2 ring-indigo-400 shadow-indigo-500/40 scale-105 cursor-grabbing"
                    : isDraggingOverWidget
                    ? "bg-indigo-600 ring-4 ring-indigo-400/50 shadow-indigo-500/50"
                    : "bg-[#0b101d]/95 hover:bg-[#12192e] border border-indigo-500/30 hover:border-indigo-400 shadow-black/80"
                }`}
                style={{ touchAction: "none" }}
                title="FinanBot: Arrastrá a cualquier pared de la pantalla o hacé clic para abrir"
              >
                {/* Grip Handle */}
                <div className="flex items-center text-slate-500 group-hover:text-indigo-400 transition-colors pointer-events-none">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Glow Ambient */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 blur-lg group-hover:opacity-100 opacity-60 transition duration-500 pointer-events-none -z-10" />

                {/* Bot Icon with glowing pulse */}
                <div className="relative w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition-transform pointer-events-none">
                  <Bot className="w-4 h-4" />
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="text-left hidden sm:block min-w-[120px] pointer-events-none">
                  <p className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                    <span>FinanBot</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold">
                      IA
                    </span>
                  </p>
                  <p
                    className={`text-[10px] font-medium transition-colors ${
                      isDraggingOverWidget
                        ? "text-indigo-200"
                        : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  >
                    {isDraggingOverWidget ? "¡Soltá el correo aquí!" : "Mails & Recordatorios"}
                  </p>
                </div>

                {/* Badge for Pending Reminders */}
                {pendingCount > 0 && (
                  <span className="ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-amber-950 text-[11px] font-black flex items-center justify-center shadow-md shadow-amber-500/40 pointer-events-none">
                    {pendingCount}
                  </span>
                )}

                {/* 1-click Quick Flip Wall Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFlipWall();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-opacity"
                  title={dockState.wall === "left" ? "Mover a pared derecha" : "Mover a pared izquierda"}
                >
                  {dockState.wall === "left" ? (
                    <PanelRight className="w-3.5 h-3.5 text-indigo-300" />
                  ) : (
                    <PanelLeft className="w-3.5 h-3.5 text-indigo-300" />
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Floating Assistant Modal (Movable along any wall) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="finanbot-modal-outer"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 9995,
              pointerEvents: "none",
            }}
            animate={{
              x: modalCoords.x,
              y: modalCoords.y,
            }}
            transition={
              isDraggingModal
                ? { duration: 0 }
                : { type: "spring", stiffness: 350, damping: 28 }
            }
          >
            <motion.div
              data-local-dropzone="true"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              style={{
                pointerEvents: "auto",
                width: modalWidth,
                height: modalHeight,
              }}
              className={`rounded-3xl border border-white/10 bg-[#0a0f1d]/98 backdrop-blur-3xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden ${
                isDraggingOverWidget ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0a0f1d]" : ""
              } ${isDraggingModal ? "ring-2 ring-indigo-400/60 shadow-indigo-500/40" : ""}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Header (Draggable) */}
              <div
                onPointerDown={handleModalHeaderPointerDown}
                onPointerMove={handleModalHeaderPointerMove}
                onPointerUp={handleModalHeaderPointerUp}
                onPointerCancel={handleModalHeaderPointerCancel}
                className="relative z-10 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: "none" }}
                title="Arrastrá desde la barra superior para mover FinanBot a cualquier pared"
              >
                <div className="flex items-center gap-2 pointer-events-none">
                  <div className="flex items-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                    <GripVertical className="w-4 h-4 opacity-60" />
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>FinanBot</span>
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                        OpenClaw
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span>Pared <span className="text-indigo-400 font-semibold capitalize">{getWallDisplayName(dockState.wall)}</span></span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400 font-mono text-[9px]">Arrastrame</span>
                    </p>
                  </div>
                </div>

                {/* Tabs Switcher & Controls */}
                <div className="flex items-center gap-2">
                  {/* Tabs Switcher */}
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.04] border border-white/5">
                    <button
                      onClick={() => setActiveTab("chat")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        activeTab === "chat"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("recordatorios")}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                        activeTab === "recordatorios"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Recordatorios</span>
                      {pendingCount > 0 && (
                        <span
                          className={`text-[9px] px-1 rounded-full font-black ${
                            activeTab === "recordatorios"
                              ? "bg-white text-indigo-700"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Wall Flip Button */}
                  <button
                    onClick={handleFlipWall}
                    className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    title={dockState.wall === "left" ? "Mover a pared derecha" : "Mover a pared izquierda"}
                  >
                    {dockState.wall === "left" ? (
                      <PanelRight className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <PanelLeft className="w-4 h-4 text-indigo-400" />
                    )}
                  </button>

                  {/* Controls */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    title="Minimizar asistente"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

            {/* Drag Overlay Feedback */}
            {isDraggingOverWidget && (
              <div className="absolute inset-0 z-50 bg-indigo-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-indigo-400 rounded-3xl animate-in fade-in pointer-events-none select-none [&_*]:pointer-events-none">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-indigo-300 mb-3 shadow-lg shadow-indigo-500/30">
                  <Mail className="w-8 h-8 animate-bounce" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">¡Soltá el correo aquí!</h4>
                <p className="text-xs text-indigo-200 max-w-xs">
                  FinanBot extraerá los ítems, proveedores y precios para armar la cotización o agendar tus recordatorios.
                </p>
              </div>
            )}

            {/* TAB 1: CHAT */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#090d18]/60">
                {/* Drag Hint Notice */}
                <div className="px-3.5 py-1.5 bg-indigo-500/10 border-b border-indigo-500/15 flex items-center justify-between text-[11px] text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Arrastrá un correo (.eml / texto) o escribí un comando</span>
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="underline hover:text-white font-medium text-[10px]"
                  >
                    Subir archivo
                  </button>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`relative max-w-[88%] rounded-2xl p-3.5 text-xs shadow-md leading-relaxed ${
                          m.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-sm"
                            : "bg-[#141b2d] text-slate-200 border border-white/[0.07] rounded-bl-sm"
                        }`}
                      >
                        {/* Text / Markdown */}
                        <div className="prose prose-invert prose-xs max-w-none break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>

                        {/* Interactive Action Card if Agent performed an action */}
                        {m.actionCard && (
                          <div className="mt-3 pt-2.5 border-t border-white/10 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  m.actionCard.type === "security_violation"
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : m.actionCard.type?.includes("eliminad") || m.actionCard.badgeText === "RETIRADA"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                }`}
                              >
                                {m.actionCard.badgeText || "ACCIÓN EJECUTADA"}
                              </span>
                              {m.actionCard.linkHref && (
                                <button
                                  onClick={() => router.push(m.actionCard!.linkHref!)}
                                  className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center gap-1 underline transition-colors"
                                >
                                  <span>{m.actionCard.linkLabel || "Ver detalle"}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <p className="text-xs font-bold text-white">{m.actionCard.title}</p>
                            {m.actionCard.subtitle && (
                              <p className="text-[11px] text-slate-300">{m.actionCard.subtitle}</p>
                            )}

                            {m.actionCard.details && m.actionCard.details.length > 0 && (
                              <div className="text-[10px] text-slate-400 bg-black/20 p-2 rounded-lg space-y-0.5">
                                {m.actionCard.details.map((d, i) => (
                                  <p key={i}>{d}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <span className="block text-[9px] text-slate-400/80 mt-1.5 text-right font-medium">
                          {m.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                      <div className="w-5 h-5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                      <span className="italic text-[11px]">FinanBot está analizando...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Pending Email Chip */}
                {pendingEmail && (
                  <div className="mx-3 mb-2 p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200 animate-in fade-in">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="truncate">
                        <p className="font-bold text-white text-[11px] truncate">
                          {pendingEmail.subject || "Correo Adjunto"}
                        </p>
                        <p className="text-[10px] text-indigo-300 truncate">
                          De: {pendingEmail.from}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPendingEmail(null)}
                      className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
                      title="Quitar correo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Quick Prompts Bar */}
                <div className="px-3 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-white/[0.04]">
                  <button
                    onClick={() => {
                      setInputMessage("Ya envié la cotización de ");
                    }}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-medium text-slate-300 hover:text-white border border-white/5 transition-colors"
                  >
                    ✅ Ya envié la cotización de...
                  </button>
                  <button
                    onClick={() => {
                      setInputMessage("Haceme acordar pagarle a ");
                    }}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-medium text-slate-300 hover:text-white border border-white/5 transition-colors"
                  >
                    ⏰ Haceme acordar...
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-medium text-indigo-300 hover:text-white border border-indigo-500/20 transition-colors flex items-center gap-1"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Subir .eml</span>
                  </button>
                </div>

                {/* Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessageToAgent();
                  }}
                  className="p-3 border-t border-white/[0.08] bg-[#0c1222] flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Adjuntar archivo o correo (.eml)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Escribí un mensaje o arrastrá un mail..."
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />

                  <button
                    type="submit"
                    disabled={isLoading || (!inputMessage.trim() && !pendingEmail)}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center"
                    title="Enviar mensaje"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: RECORDATORIOS */}
            {activeTab === "recordatorios" && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#090d18]/60 p-3.5 space-y-3 overflow-hidden">
                {/* Form to Add Quick Reminder */}
                <form
                  onSubmit={handleAddManualReminder}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Nuevo Recordatorio</span>
                  </div>

                  <input
                    type="text"
                    value={newRecTitle}
                    onChange={(e) => setNewRecTitle(e.target.value)}
                    placeholder="Ej. Enviar comprobante de pago a proveedor..."
                    className="w-full bg-[#0d1424] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newRecDate}
                      onChange={(e) => setNewRecDate(e.target.value)}
                      className="flex-1 bg-[#0d1424] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="time"
                      value={newRecTime}
                      onChange={(e) => setNewRecTime(e.target.value)}
                      className="w-24 bg-[#0d1424] border border-white/10 rounded-xl px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={addingRec || !newRecTitle.trim()}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </form>

                {/* Filters */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    {(["pendientes", "todos", "completados"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setRecFilter(mode)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                          recFilter === mode
                            ? "bg-white/15 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {filteredRecordatorios.length} recordatorios
                  </span>
                </div>

                {/* List of Reminders */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredRecordatorios.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-500">
                        <Clock className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-300">
                        {recFilter === "pendientes"
                          ? "¡Sin recordatorios pendientes!"
                          : "No hay recordatorios registrados"}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-xs">
                        Pedile al chat &quot;haceme acordar pagarle a X el viernes&quot; o crealo arriba.
                      </p>
                    </div>
                  ) : (
                    filteredRecordatorios.map((r) => {
                      const isToday =
                        r.fecha === new Date().toISOString().split("T")[0];

                      return (
                        <div
                          key={r.id}
                          className={`group p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                            r.completado
                              ? "bg-white/[0.01] border-white/5 opacity-60"
                              : "bg-[#111728] border-white/[0.08] hover:border-indigo-500/30"
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleReminder(r)}
                            className="mt-0.5 text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                          >
                            {r.completado ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs font-bold text-white leading-tight ${
                                r.completado ? "line-through text-slate-400" : ""
                              }`}
                            >
                              {r.titulo}
                            </p>
                            {r.descripcion && (
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                {r.descripcion}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  isToday && !r.completado
                                    ? "text-amber-400 font-bold"
                                    : "text-slate-400"
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {r.fecha || "Sin fecha"} {r.hora ? `• ${r.hora} hs` : ""}
                              </span>
                              {r.origen === "email" && (
                                <span className="px-1.5 rounded bg-indigo-500/20 text-indigo-300 font-medium text-[9px]">
                                  Email
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteReminder(r.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
                            title="Eliminar recordatorio"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);
}
