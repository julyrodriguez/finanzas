"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  Bot,
  Send,
  Upload,
  FileText,
  Mail,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Square,
  Paperclip,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export interface QuoteAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  cotizacionId?: string;
  providerId?: string;
  providerName?: string;
  url: string;
  uploadedAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ItemContext {
  name: string;
  targetQuantity?: number;
  baseUnit?: string;
}

interface ProviderContext {
  id: string;
  name: string;
}

interface CotizacionesAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotizacionId: string;
  quoteName: string;
  items: ItemContext[];
  providers: ProviderContext[];
  attachments: QuoteAttachment[];
  onUploadAttachment: (file: File, providerId?: string, providerName?: string) => Promise<void>;
  onDeleteAttachment: (attachment: QuoteAttachment) => Promise<void>;
}

const QUICK_PROMPTS = [
  {
    label: "📊 Comparar precios entre proveedores",
    prompt: "Generá una tabla comparativa con los precios de cada ítem entre los proveedores, indicando moneda, precio unitario y cuál es más conveniente."
  },
  {
    label: "🏆 Proveedor más económico y conveniente",
    prompt: "¿Cuál es el proveedor más económico en total y cuál conviene más considerando plazos de entrega y condiciones?"
  },
  {
    label: "🚚 Plazos de entrega y formas de pago",
    prompt: "Hacé un resumen de los plazos de entrega, formas de pago y validez de oferta de cada proveedor según los presupuestos o mails."
  },
  {
    label: "🔍 Detección de faltantes o diferencias",
    prompt: "¿Algún proveedor dejó ítems sin cotizar o cotizó presentaciones distintas a las solicitadas?"
  }
];

export function CotizacionesAiChatModal({
  isOpen,
  onClose,
  cotizacionId,
  quoteName,
  items,
  providers,
  attachments,
  onUploadAttachment,
  onDeleteAttachment
}: CotizacionesAiChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedProviderForUpload, setSelectedProviderForUpload] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll al final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    handleStopGeneration();
    setMessages([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const provObj = providers.find((p) => p.id === selectedProviderForUpload);
      await onUploadAttachment(file, selectedProviderForUpload, provObj ? provObj.name : "Proveedor");
    } catch (err) {
      console.error("Error subiendo archivo desde chat:", err);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (!text || isGenerating) return;

    setInputMessage("");

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsGenerating(true);

    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages([...newHistory, placeholderAssistant]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const apiEndpoint = process.env.NEXT_PUBLIC_COTIZACIONES_API || "https://apivacas.jariel.com.ar/api/cotizaciones-ia/chat";
      
      const payload = {
        cotizacionId,
        quoteName,
        items,
        providers,
        attachments,
        modelName: "gemini-3.5-flash-lite",
        messages: newHistory.map((m) => ({
          role: m.role,
          content: m.content
        }))
      };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo leer la respuesta");

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.replace(/^data:\s*/, "");

          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              accumulatedContent += `\n\n⚠️ Error: ${parsed.error}`;
            } else if (parsed.text) {
              accumulatedContent += parsed.text;
            }
          } catch (e) {
            accumulatedContent += dataStr;
          }

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulatedContent } : msg
            )
          );
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + "\n\n*(Respuesta detenida)*" }
              : msg
          )
        );
      } else {
        console.error("Error en chat:", err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    `⚠️ No se pudo obtener respuesta (${err.message}). Por favor intentá nuevamente.`
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full h-full sm:h-[90vh] sm:max-w-4xl bg-[#0c121e] sm:border sm:border-white/10 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#101726] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white truncate">
                Chat de Cotización
              </h3>
              <p className="text-[11px] text-gray-400 truncate">
                {quoteName || "Cotización"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-xl transition-colors text-xs flex items-center gap-1 cursor-pointer"
                title="Limpiar chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reiniciar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible Attachments Bar */}
        <div className="border-b border-white/5 bg-[#0e1522] px-4 py-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setIsFilesExpanded(!isFilesExpanded)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
              <span>Archivos ({attachments.length})</span>
              {isFilesExpanded ? (
                <ChevronUp className="w-3 h-3 text-gray-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedProviderForUpload}
                onChange={(e) => setSelectedProviderForUpload(e.target.value)}
                className="bg-[#141d2e] text-[11px] text-gray-300 border border-white/10 rounded-lg px-2 py-1 max-w-[120px] truncate focus:outline-none"
              >
                <option value="">Proveedor...</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0">
                <Upload className="w-3 h-3" />
                <span>{isUploading ? "..." : "Subir"}</span>
                <input
                  type="file"
                  accept=".pdf,.eml,message/rfc822,.png,.jpg,.jpeg,.xlsx,.xls,.txt"
                  className="hidden"
                  disabled={isUploading}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {isFilesExpanded && (
            <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {attachments.length === 0 ? (
                <p className="text-[11px] text-gray-500 italic py-1">
                  No hay archivos cargados. Podés subir presupuestos en PDF o correos .eml.
                </p>
              ) : (
                attachments.map((att) => {
                  const isEml = att.filename.endsWith(".eml") || att.mimeType.includes("rfc822");
                  const isPdf = att.filename.endsWith(".pdf") || att.mimeType.includes("pdf");
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-[#141e30] border border-white/10 rounded-lg text-[11px] text-gray-300"
                    >
                      {isEml ? (
                        <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                      ) : isPdf ? (
                        <FileText className="w-3 h-3 text-red-400 shrink-0" />
                      ) : (
                        <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[120px]" title={att.originalName}>
                        {att.originalName}
                      </span>
                      {att.providerName && (
                        <span className="text-[9px] px-1 bg-white/5 text-gray-400 rounded">
                          {att.providerName}
                        </span>
                      )}
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-400 hover:text-emerald-400"
                        title="Ver archivo"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={() => onDeleteAttachment(att)}
                        className="text-gray-500 hover:text-red-400"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-3 py-6 max-w-lg mx-auto">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 mb-3">
                <Bot className="w-8 h-8" />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-300 mb-4">
                Escribí una pregunta o tocá una sugerencia:
              </p>

              <div className="flex flex-col gap-2 w-full">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(qp.prompt)}
                    className="text-left px-3.5 py-2.5 bg-[#121927] hover:bg-[#182337] border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all text-xs font-semibold text-gray-200 hover:text-emerald-300 flex items-center justify-between group cursor-pointer"
                  >
                    <span>{qp.label}</span>
                    <span className="text-gray-500 group-hover:text-emerald-400 text-xs">→</span>
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
                  className={`flex items-start gap-2 sm:gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`relative group max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-tr-sm shadow-md"
                        : "bg-[#131b2b] text-gray-200 border border-white/10 rounded-tl-sm shadow-lg"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-end mb-1 text-[10px] text-gray-500 gap-1.5">
                        <span>{msg.timestamp}</span>
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-0.5 hover:text-white rounded transition-colors cursor-pointer"
                          title="Copiar"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.content ? (
                      <div className="prose prose-invert max-w-none text-xs sm:text-sm overflow-x-auto space-y-2.5">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="my-3 overflow-x-auto border border-white/10 rounded-xl bg-[#0e1522]">
                                <table className="w-full text-left border-collapse text-xs">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-emerald-950/40 text-emerald-300 font-bold border-b border-white/10">
                                {children}
                              </thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-2.5 py-1.5 text-xs font-semibold text-gray-200 border-r border-white/5 last:border-r-0">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-2.5 py-1.5 border-t border-white/5 border-r last:border-r-0 text-gray-300">
                                {children}
                              </td>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-5 space-y-1 my-1.5 text-gray-300">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-5 space-y-1 my-1.5 text-gray-300">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => <li className="my-0.5">{children}</li>,
                            h3: ({ children }) => (
                              <h3 className="text-sm font-bold text-white mt-3 mb-1.5">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                            strong: ({ children }) => (
                              <strong className="font-bold text-white">{children}</strong>
                            )
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 py-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                        <span className="text-xs italic">Escribiendo respuesta...</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Controls Bar */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#101726] shrink-0">
          <div className="flex items-end gap-2 bg-[#0a0f19] border border-white/10 focus-within:border-emerald-500/50 rounded-2xl p-1.5 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí un mensaje..."
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none resize-none px-2.5 py-1.5 max-h-28 min-h-[36px]"
            />

            {isGenerating ? (
              <button
                onClick={handleStopGeneration}
                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Detener respuesta"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage()}
                disabled={!inputMessage.trim()}
                className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed shrink-0"
                title="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
