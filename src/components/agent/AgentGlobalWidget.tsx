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
} from "@/lib/serverSync";
import { getFirebaseDb, isFirestoreDisabled, handleFirestoreError } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

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
    type: "cotizacion_creada" | "cotizacion_enviada" | "recordatorio_creado" | "pendiente_creado";
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

  // Global drag listener to highlight widget
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        // Can highlight
      }
    };
    window.addEventListener("dragover", handleWindowDragOver);
    return () => window.removeEventListener("dragover", handleWindowDragOver);
  }, []);

  // Handle Drag & Drop on Widget
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverWidget(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverWidget(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

      // 3. ACTION: CREATE RECORDATORIO
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
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          emailContext: emailToSend || undefined,
          currentQuotes: quotesCache.map((q) => ({
            id: q.id,
            name: q.name,
            status: q.status || "borrador",
            winningProviderId: q.winningProviderId,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en el servidor: HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "No se pudo obtener respuesta del asistente.");
      }

      const { reply, action } = json.data;

      // Execute action if provided
      let actionCard: ChatMessage["actionCard"] | null = null;
      if (action && action.type) {
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

      {/* Floating Trigger Button (Always visible at bottom-right) */}
      <div
        className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 select-none"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 20 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="flex items-center"
            >
              <button
                onClick={() => setIsOpen(true)}
                className={`group relative flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
                  isDraggingOverWidget
                    ? "bg-indigo-600 border-2 border-white scale-110 shadow-indigo-500/50"
                    : "bg-[#0b101d]/95 hover:bg-[#12192e] border border-indigo-500/30 hover:border-indigo-400 shadow-black/80"
                }`}
                title="Abrir Asistente Finanzas & Compras (Arrastrá correos aquí)"
              >
                {/* Glow Ambient */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 blur-lg group-hover:opacity-100 opacity-60 transition duration-500 pointer-events-none" />

                {/* Bot Icon with glowing pulse */}
                <div className="relative w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition-transform">
                  <Bot className="w-4 h-4" />
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="text-left hidden sm:block">
                  <p className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                    <span>FinanBot</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold">
                      IA
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 group-hover:text-slate-300">
                    {isDraggingOverWidget ? "¡Soltá el correo aquí!" : "Mails & Recordatorios"}
                  </p>
                </div>

                {/* Badge for Pending Reminders */}
                {pendingCount > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-amber-950 text-[11px] font-black flex items-center justify-center shadow-md shadow-amber-500/40">
                    {pendingCount}
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expanded Floating Assistant Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className={`fixed bottom-6 right-4 sm:right-6 z-[9995] w-[95vw] sm:w-[440px] h-[600px] max-h-[85vh] rounded-3xl border border-white/10 bg-[#0a0f1d]/98 backdrop-blur-3xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden ${
              isDraggingOverWidget ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0a0f1d]" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Header */}
            <div className="relative z-10 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
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
                    <span>Cinemark & Hoyts</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-indigo-400 font-mono text-[9px]">Gateway :18789</span>
                  </p>
                </div>
              </div>

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

              {/* Controls */}
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                title="Minimizar asistente"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Drag Overlay Feedback */}
            {isDraggingOverWidget && (
              <div className="absolute inset-0 z-50 bg-indigo-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-indigo-400 rounded-3xl animate-in fade-in">
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
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
        )}
      </AnimatePresence>
    </>
  );
}
