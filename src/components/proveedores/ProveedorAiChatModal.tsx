"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Proveedor } from "@/types/proveedor";
import {
  X,
  Bot,
  Send,
  Sparkles,
  Copy,
  Check,
  Building2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Mail,
  Globe,
  Compass,
  ArrowRight,
  RotateCcw,
  Search,
  Users
} from "lucide-react";

export interface ProveedorAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProveedores: Proveedor[];
  rubro: string;
  zona: string;
  geminiApiKey?: string;
  initialQuery?: string;
  onAddNewProveedores: (newProveedores: Proveedor[]) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  newProveedores?: Proveedor[];
  type?: "new_providers" | "provider_deep_dive" | "general";
  matchedProvider?: string;
}

const DEFAULT_SUGGESTIONS = [
  {
    label: "🔍 Buscá nuevas que no sean las de recién",
    text: "Buscá nuevas empresas que no sean las que busco recién y traeme opciones distintas",
  },
  {
    label: "📊 Comparar los mejores 3 proveedores",
    text: "¿Cuáles son los 3 proveedores más sólidos y recomendados de la lista actual?",
  },
  {
    label: "🛡️ ¿Cuáles tienen contacto directo?",
    text: "¿Cuáles de los proveedores cargados tienen teléfono directo o email corporativo verificado?",
  },
  {
    label: "📋 Preguntas clave para licitación",
    text: "¿Qué preguntas técnicas y requisitos de seguridad e higiene debo exigirles al pedir presupuesto?",
  },
];

export function ProveedorAiChatModal({
  isOpen,
  onClose,
  currentProveedores,
  rubro,
  zona,
  geminiApiKey,
  initialQuery,
  onAddNewProveedores,
}: ProveedorAiChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recentlyAddedCount, setRecentlyAddedCount] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialSentRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages]);

  // Handle initialQuery automatically when opened
  useEffect(() => {
    if (isOpen && initialQuery && initialQuery !== initialSentRef.current) {
      initialSentRef.current = initialQuery;
      handleSendMessage(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");
    setIsLoading(true);

    const apiEndpoint =
      process.env.NEXT_PUBLIC_PROVEEDORES_CHAT_API ||
      (process.env.NEXT_PUBLIC_PROVEEDORES_API
        ? process.env.NEXT_PUBLIC_PROVEEDORES_API.replace(/\/search$/, "/chat")
        : "https://apivacas.jariel.com.ar/api/proveedores-ia/chat");

    try {
      let res: Response | null = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentProveedores,
          rubro: rubro || "Servicios Comerciales",
          zona: zona || "CABA y GBA",
          geminiApiKey: geminiApiKey || undefined,
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        // Fallback resiliente a ruta proxy interna de Next.js
        res = await fetch("/api/proveedores/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            currentProveedores,
            rubro: rubro || "Servicios Comerciales",
            zona: zona || "CABA y GBA",
            geminiApiKey: geminiApiKey || undefined,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo obtener respuesta del asistente");
      }

      const newFound: Proveedor[] = Array.isArray(data.newProveedores) ? data.newProveedores : [];

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "He procesado tu consulta.",
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        type: data.type,
        newProveedores: newFound,
        matchedProvider: data.matchedProvider,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Si se encontraron nuevas empresas distintas, agregarlas al listado principal
      if (newFound.length > 0) {
        onAddNewProveedores(newFound);
        setRecentlyAddedCount(newFound.length);
        setTimeout(() => setRecentlyAddedCount(null), 6000);
      }
    } catch (err: any) {
      console.error("Error en chat de proveedores:", err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Ocurrió un error al procesar tu solicitud:** ${err.message || "Error desconocido"}. Por favor volvé a intentar.`,
        timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[820px] bg-gradient-to-b from-[#0b1220] via-[#0d1527] to-[#080d19] border border-blue-500/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
        {/* Top subtle highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] bg-slate-950/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-[#0d1629] rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Copilot de Compras & Proveedores</span>
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  <span>{currentProveedores.length} proveedores en contexto</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {rubro && zona ? (
                  <span>
                    Rubro: <strong className="text-slate-300">{rubro}</strong> · Zona: <strong className="text-slate-300">{zona}</strong>
                  </span>
                ) : (
                  "Investigá antecedentes o encontrá opciones nuevas no listadas"
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 border border-white/[0.06] transition-all active:scale-[0.92] cursor-pointer"
            title="Cerrar asistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Notification Banner when new providers are appended */}
        {recentlyAddedCount !== null && (
          <div className="bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 border-b border-emerald-500/30 px-5 py-2 flex items-center justify-between text-xs text-emerald-300 animate-in slide-in-from-top duration-300 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>¡Nuevos proveedores agregados!</strong> Se incorporaron{" "}
                <span className="font-bold underline text-white">+{recentlyAddedCount} empresas distintas</span> a tu listado en pantalla.
              </span>
            </div>
            <span className="text-[11px] text-emerald-400/80">Listado actualizado</span>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-6 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/5">
                <Bot className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-bold text-white">
                  ¿Cómo puedo ayudarte con esta búsqueda?
                </h4>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Podés pedirme que investigue a fondo una empresa específica, que compare opciones, o que busque nuevas alternativas que no hayan aparecido recién.
                </p>
              </div>

              {/* Quick suggestion chips */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {DEFAULT_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s.text)}
                    className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/[0.08] hover:border-blue-500/30 text-xs text-slate-300 hover:text-white transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between group"
                  >
                    <span className="font-medium pr-2">{s.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-blue-600/20">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm shadow-lg ${
                      isUser
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-blue-600/20"
                        : "bg-[#0f172a]/95 border border-white/[0.08] text-slate-200 rounded-tl-sm shadow-slate-950/40"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/[0.06] text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {msg.type === "new_providers"
                              ? "Ampliación de Búsqueda"
                              : msg.type === "provider_deep_dive"
                              ? `Dossier: ${msg.matchedProvider || "Empresa"}`
                              : "Asesoría de Compras"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                          <button
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="p-1 hover:text-white rounded transition-colors cursor-pointer"
                            title="Copiar respuesta"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed font-normal">{msg.content}</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto space-y-2.5">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h3: ({ children }) => (
                                <h3 className="text-sm font-bold text-white mt-3.5 mb-1.5 flex items-center gap-1.5 border-b border-white/[0.06] pb-1">
                                  {children}
                                </h3>
                              ),
                              h4: ({ children }) => (
                                <h4 className="text-xs font-bold text-slate-200 mt-2 mb-1">
                                  {children}
                                </h4>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc pl-5 space-y-1 my-1.5 text-slate-300">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-5 space-y-1 my-1.5 text-slate-300">
                                  {children}
                                </ol>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-white">{children}</strong>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline font-mono text-[11px]"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* If this assistant response brought new providers, render card pills */}
                        {msg.newProveedores && msg.newProveedores.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-white/[0.08] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{msg.newProveedores.length} Nuevas Opciones Incorporadas:</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Ya visibles en tu lista
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {msg.newProveedores.map((p, idx) => (
                                <div
                                  key={p.id || idx}
                                  className="p-2.5 rounded-xl bg-slate-950/70 border border-emerald-500/20 flex flex-col justify-between gap-1.5 text-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-bold text-white truncate">{p.nombre}</span>
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                      Nueva
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 line-clamp-2">
                                    {p.descripcion_trabajos}
                                  </p>
                                  <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-300 flex-wrap">
                                    {p.telefono && (
                                      <span className="flex items-center gap-1 font-mono text-emerald-300">
                                        <Phone className="w-2.5 h-2.5" />
                                        {p.telefono}
                                      </span>
                                    )}
                                    {p.email && (
                                      <span className="flex items-center gap-1 font-mono text-blue-300">
                                        <Mail className="w-2.5 h-2.5" />
                                        {p.email}
                                      </span>
                                    )}
                                    {p.sitio_web && (
                                      <a
                                        href={p.sitio_web}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-slate-400 hover:text-white flex items-center gap-0.5 ml-auto"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-900/90 border border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-slate-300 flex items-center gap-2.5 shadow-md">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>Analizando evidencia web y estructurando respuesta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion row when active */}
        {messages.length > 0 && !isLoading && (
          <div className="px-5 py-2 border-t border-white/[0.06] bg-slate-950/30 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar shrink-0">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider shrink-0 mr-1">
              Sugerencias:
            </span>
            {DEFAULT_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s.text)}
                className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-[11px] text-slate-300 hover:text-white border border-white/[0.06] hover:border-blue-500/30 transition-all shrink-0 cursor-pointer active:scale-95"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-950/60 shrink-0">
          <div className="relative flex items-center rounded-xl bg-slate-900/90 border border-white/10 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/40 shadow-inner">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ej: Buscame más info de Electro Tucumán, o buscá nuevas que no sean las de recién..."
              className="w-full bg-transparent px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none resize-none max-h-28"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="m-2 p-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 disabled:opacity-40 text-white transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
              title="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
            <span>Presioná <strong>Enter</strong> para enviar · <strong>Shift + Enter</strong> para salto de línea</span>
            <span className="hidden sm:inline">Modelos Gemini con fallback resiliente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
