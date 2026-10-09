"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Pin, 
  Trash2, 
  Plus, 
  Eraser, 
  Sparkles, 
  RotateCcw, 
  Check, 
  CheckSquare, 
  Square, 
  Search,
  MessageSquare,
  Flame,
  Palette,
  Maximize2,
  Clock,
  Calendar,
  X
} from "lucide-react";
import { EyeTrackerCube } from "./EyeTrackerCube";

export interface PinnedNote {
  id: string;
  title: string;
  content: string;
  color: "yellow" | "blue" | "green" | "pink" | "purple" | "orange";
  pinColor: "red" | "gold" | "blue" | "emerald";
  rotation: number;
  x: number;
  y: number;
  createdAt: string;
  checklist?: { id: string; text: string; done: boolean }[];
  tag?: string;
}

const NOTE_COLORS = {
  yellow: {
    bg: "bg-[#fef08a]",
    border: "border-yellow-300",
    text: "text-amber-950",
    header: "text-amber-900",
    placeholder: "placeholder-amber-800/40",
    shadow: "shadow-amber-500/15",
    tagBg: "bg-amber-400/30 text-amber-950"
  },
  blue: {
    bg: "bg-[#bae6fd]",
    border: "border-sky-300",
    text: "text-sky-950",
    header: "text-sky-900",
    placeholder: "placeholder-sky-800/40",
    shadow: "shadow-sky-500/15",
    tagBg: "bg-sky-400/30 text-sky-950"
  },
  green: {
    bg: "bg-[#bbf7d0]",
    border: "border-emerald-300",
    text: "text-emerald-950",
    header: "text-emerald-900",
    placeholder: "placeholder-emerald-800/40",
    shadow: "shadow-emerald-500/15",
    tagBg: "bg-emerald-400/30 text-emerald-950"
  },
  pink: {
    bg: "bg-[#fbcfe8]",
    border: "border-pink-300",
    text: "text-pink-950",
    header: "text-pink-900",
    placeholder: "placeholder-pink-800/40",
    shadow: "shadow-pink-500/15",
    tagBg: "bg-pink-400/30 text-pink-950"
  },
  purple: {
    bg: "bg-[#e9d5ff]",
    border: "border-purple-300",
    text: "text-purple-950",
    header: "text-purple-900",
    placeholder: "placeholder-purple-800/40",
    shadow: "shadow-purple-500/15",
    tagBg: "bg-purple-400/30 text-purple-950"
  },
  orange: {
    bg: "bg-[#fed7aa]",
    border: "border-orange-300",
    text: "text-orange-950",
    header: "text-orange-900",
    placeholder: "placeholder-orange-800/40",
    shadow: "shadow-orange-500/15",
    tagBg: "bg-orange-400/30 text-orange-950"
  }
};

const CHALK_COLORS = [
  { id: "white", name: "Tiza Blanca", color: "#f8fafc", bg: "bg-slate-100" },
  { id: "yellow", name: "Tiza Amarilla", color: "#fef08a", bg: "bg-yellow-300" },
  { id: "cyan", name: "Tiza Celeste", color: "#7dd3fc", bg: "bg-sky-300" },
  { id: "mint", name: "Tiza Menta", color: "#86efac", bg: "bg-emerald-300" },
  { id: "pink", name: "Tiza Rosa", color: "#f472b6", bg: "bg-pink-400" },
  { id: "orange", name: "Tiza Naranja", color: "#fdba74", bg: "bg-amber-400" }
];

const CARITA_GREETINGS = [
  "¡Bienvenido a tu Pizarrón de Control! 📌",
  "¡Anotá tus ideas antes de que se escapen! ✏️",
  "Pizarrón limpio = Día productivo 🧽",
  "¡Clavá una nota con un pin para no olvidarte! 📌",
  "Dibujá o escribí lo que quieras en la pizarra ✨",
  "Supervisando compras y cotizaciones 🕵️‍♂️"
];

const INITIAL_NOTES: PinnedNote[] = [
  {
    id: "note-init-1",
    title: "📋 Recordatorio Licitación",
    content: "Revisar comparativa de limpieza sedes Cinemark & Hoyts. Validar plazos de entrega y condiciones de pago.",
    color: "yellow",
    pinColor: "red",
    rotation: -2.5,
    x: 40,
    y: 35,
    createdAt: "Hoy",
    tag: "Prioritario",
    checklist: [
      { id: "c1", text: "Pedir ajuste de IVA en CleanX", done: true },
      { id: "c2", text: "Validar plazos de entrega", done: false }
    ]
  },
  {
    id: "note-init-2",
    title: "💡 Ideas & Mejoras",
    content: "Pizarrón interactivo operativo. Podés escribir con tiza, borrar con el borrador o clavar notas con chinchetas.",
    color: "blue",
    pinColor: "gold",
    rotation: 1.8,
    x: 320,
    y: 50,
    createdAt: "Hoy",
    tag: "Tip"
  }
];

interface BlackboardHubProps {
  onOpenSearch?: () => void;
}

export function BlackboardHub({ onOpenSearch }: BlackboardHubProps) {
  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<"chalk" | "eraser" | "pointer">("chalk");
  const [chalkColor, setChalkColor] = useState<string>("#f8fafc");
  const [chalkWidth, setChalkWidth] = useState<number>(4);
  const [hasChalkStrokes, setHasChalkStrokes] = useState<boolean>(false);
  const strokeHistoryRef = useRef<ImageData[]>([]);

  // Pinned Notes State
  const [notes, setNotes] = useState<PinnedNote[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("finanzas_blackboard_notes");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn("Error cargando notas de pizarra:", e);
      }
    }
    return INITIAL_NOTES;
  });

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeNoteColor, setActiveNoteColor] = useState<keyof typeof NOTE_COLORS>("yellow");

  // Carita State
  const [caritaSpeech, setCaritaSpeech] = useState<string>(CARITA_GREETINGS[0]);
  const [isSpeechVisible, setIsSpeechVisible] = useState<boolean>(true);
  const [caritaMood, setCaritaMood] = useState<"normal" | "thinking" | "searching">("normal");

  // Time & Date state for blackboard header
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Save notes to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("finanzas_blackboard_notes", JSON.stringify(notes));
      } catch (e) {
        console.warn("Error guardando notas de pizarra:", e);
      }
    }
  }, [notes]);

  // Init and restore Canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const rect = board.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Handle high DPI
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Restore saved drawing
    try {
      const savedDataUrl = localStorage.getItem("finanzas_blackboard_canvas");
      if (savedDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setHasChalkStrokes(true);
        };
        img.src = savedDataUrl;
      }
    } catch (e) {
      console.warn("Error restaurando lienzo de tiza:", e);
    }
  }, []);

  useEffect(() => {
    initCanvas();
    const handleResize = () => {
      // Re-init with preserve
      const canvas = canvasRef.current;
      if (!canvas) return;
      const prevData = canvas.toDataURL();
      initCanvas();
      const ctx = canvas.getContext("2d");
      if (ctx && prevData) {
        const img = new Image();
        img.onload = () => {
          const board = boardRef.current;
          if (board) {
            ctx.drawImage(img, 0, 0, board.clientWidth, board.clientHeight);
          }
        };
        img.src = prevData;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      localStorage.setItem("finanzas_blackboard_canvas", canvas.toDataURL());
      setHasChalkStrokes(true);
    } catch (e) {
      console.warn("Error guardando lienzo de tiza:", e);
    }
  };

  // Chalk Drawing Handlers with realistic particle jitter
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === "pointer") return;
    setIsDrawing(true);
    setCaritaMood(activeTool === "chalk" ? "thinking" : "searching");
    const pos = getCanvasPos(e);
    lastPosRef.current = pos;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeTool === "chalk") {
      drawChalkSegment(ctx, pos.x, pos.y, pos.x, pos.y, chalkColor, chalkWidth);
    } else if (activeTool === "eraser") {
      eraseSegment(ctx, pos.x, pos.y, 28);
    }
  };

  const drawChalkSegment = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    width: number
  ) => {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // 1. Base chalk stroke with soft opacity
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.72;
    ctx.shadowBlur = 1.5;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // 2. Chalk dust micro-particles for realistic rough blackboard texture
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.floor(dist / 3));
    ctx.fillStyle = color;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const curX = x0 + (x1 - x0) * t;
      const curY = y0 + (y1 - y0) * t;

      for (let p = 0; p < 3; p++) {
        const offset = (Math.random() - 0.5) * (width * 1.1);
        const radius = Math.random() * (width * 0.35);
        ctx.globalAlpha = Math.random() * 0.45;
        ctx.beginPath();
        ctx.arc(curX + offset, curY + offset, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  const eraseSegment = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || activeTool === "pointer") return;
    const pos = getCanvasPos(e);
    const canvas = canvasRef.current;
    if (!canvas || !lastPosRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeTool === "chalk") {
      drawChalkSegment(ctx, lastPosRef.current.x, lastPosRef.current.y, pos.x, pos.y, chalkColor, chalkWidth);
    } else if (activeTool === "eraser") {
      eraseSegment(ctx, pos.x, pos.y, 28);
    }

    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPosRef.current = null;
    setCaritaMood("normal");
    saveCanvasState();
  };

  // Clear chalk board with wipe effect
  const handleClearChalkboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      localStorage.removeItem("finanzas_blackboard_canvas");
    } catch (e) {}
    setHasChalkStrokes(false);
    triggerCaritaSpeech("✨ ¡Pizarrón de tiza limpiado por completo!");
  };

  // Pinned Notes Operations
  const handleAddNote = (color: keyof typeof NOTE_COLORS = activeNoteColor) => {
    const colorsList: (keyof typeof NOTE_COLORS)[] = ["yellow", "blue", "green", "pink", "purple", "orange"];
    const chosenColor = color || colorsList[Math.floor(Math.random() * colorsList.length)];
    const pinColors: ("red" | "gold" | "blue" | "emerald")[] = ["red", "gold", "blue", "emerald"];
    const chosenPin = pinColors[Math.floor(Math.random() * pinColors.length)];

    const randomRot = (Math.random() * 6 - 3); // between -3 and +3 deg
    const board = boardRef.current;
    const maxX = board ? Math.max(20, board.clientWidth - 280) : 300;
    const maxY = board ? Math.max(20, board.clientHeight - 260) : 200;

    const newNote: PinnedNote = {
      id: `note-${Date.now()}`,
      title: "Nueva Nota",
      content: "",
      color: chosenColor,
      pinColor: chosenPin,
      rotation: Number(randomRot.toFixed(1)),
      x: Math.floor(Math.random() * (maxX - 40)) + 40,
      y: Math.floor(Math.random() * (maxY - 60)) + 60,
      createdAt: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      checklist: []
    };

    setNotes((prev) => [...prev, newNote]);
    setSelectedNoteId(newNote.id);
    triggerCaritaSpeech("📌 ¡Nota clavada con éxito!");
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    triggerCaritaSpeech("🗑️ Nota desclavada de la pizarra");
  };

  const handleUpdateNote = (id: string, updates: Partial<PinnedNote>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    );
  };

  const handleAddChecklistItem = (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const currentList = n.checklist || [];
        return {
          ...n,
          checklist: [
            ...currentList,
            { id: `chk-${Date.now()}`, text: "", done: false }
          ]
        };
      })
    );
  };

  const handleToggleChecklistItem = (noteId: string, checkId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        return {
          ...n,
          checklist: (n.checklist || []).map((c) =>
            c.id === checkId ? { ...c, done: !c.done } : c
          )
        };
      })
    );
  };

  const handleUpdateChecklistText = (noteId: string, checkId: string, text: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        return {
          ...n,
          checklist: (n.checklist || []).map((c) =>
            c.id === checkId ? { ...c, text } : c
          )
        };
      })
    );
  };

  const handleDeleteChecklistItem = (noteId: string, checkId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        return {
          ...n,
          checklist: (n.checklist || []).filter((c) => c.id !== checkId)
        };
      })
    );
  };

  const triggerCaritaSpeech = (msg: string) => {
    setCaritaSpeech(msg);
    setIsSpeechVisible(true);
  };

  const handleCaritaClick = () => {
    const nextGreet = CARITA_GREETINGS[Math.floor(Math.random() * CARITA_GREETINGS.length)];
    setCaritaSpeech(nextGreet);
    setIsSpeechVisible(true);
    setCaritaMood("thinking");
    setTimeout(() => setCaritaMood("normal"), 1500);
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto flex flex-col space-y-4 select-none">
      {/* Blackboard Wooden / Dark Metal Outer Frame */}
      <div 
        ref={boardRef}
        className="relative w-full min-h-[640px] sm:min-h-[720px] rounded-3xl border-8 sm:border-[12px] border-[#2a1d12] bg-[#0c141d] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col transition-all"
        style={{
          boxShadow: "inset 0 0 100px rgba(0,0,0,0.85), 0 20px 50px rgba(0,0,0,0.9)",
          backgroundImage: "radial-gradient(ellipse at 50% 25%, #162434 0%, #0c141d 65%, #070c12 100%)"
        }}
      >
        {/* Subtle Slate Chalk Dust Texture Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 35%, rgba(255,255,255,0.06) 0%, transparent 40%),
                              radial-gradient(circle at 75% 65%, rgba(255,255,255,0.05) 0%, transparent 50%),
                              radial-gradient(circle at 50% 85%, rgba(255,255,255,0.08) 0%, transparent 60%)`
          }}
        />

        {/* Blackboard Chalk Border Grid Line / Top Header Bar */}
        <div className="relative z-20 flex flex-wrap items-center justify-between px-5 sm:px-8 py-3.5 border-b border-white/10 bg-black/35 backdrop-blur-md">
          {/* Left: Chalkboard Header / Clock */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs">
              <Calendar className="w-3.5 h-3.5 text-yellow-300" />
              <span>{currentDate || "Hoy"}</span>
              <span className="text-white/20">•</span>
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              <span className="font-bold text-white">{currentTime}</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-3 h-3 text-yellow-300" />
              <span>Hub Pizarrón</span>
            </div>
          </div>

          {/* Right: Quick Search Button & Notes counter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              📌 {notes.length} {notes.length === 1 ? "nota" : "notas"}
            </span>

            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                title="Buscar en la plataforma (Cmd+K)"
              >
                <Search className="w-3.5 h-3.5 text-sky-300" />
                <span className="hidden sm:inline">Buscar</span>
                <kbd className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded border border-white/10 text-slate-400 font-mono">⌘K</kbd>
              </button>
            )}
          </div>
        </div>

        {/* Center Canvas Area: Where Chalk Drawing Happens */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`absolute inset-0 z-10 w-full h-full ${
            activeTool === "chalk"
              ? "cursor-crosshair"
              : activeTool === "eraser"
              ? "cursor-cell"
              : "cursor-default pointer-events-none"
          }`}
          style={{ touchAction: "none" }}
        />

        {/* Mascot Center Header Shelf: EyeTrackerCube looking over the blackboard */}
        <div className="relative z-30 flex flex-col items-center justify-center pt-4 pb-2 pointer-events-none">
          <div className="relative pointer-events-auto flex flex-col items-center group">
            {/* Speech Bubble from Carita */}
            <AnimatePresence>
              {isSpeechVisible && caritaSpeech && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="absolute -top-12 z-40 px-4 py-1.5 rounded-2xl bg-white/95 text-slate-900 text-xs font-bold shadow-xl border border-white/40 flex items-center gap-2 max-w-xs text-center"
                >
                  <span>{caritaSpeech}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSpeechVisible(false);
                    }}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {/* Bubble triangle pointer */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clickable Carita */}
            <div 
              onClick={handleCaritaClick}
              className="cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              title="¡Hacé clic en la carita para interactuar!"
            >
              <EyeTrackerCube
                size={135}
                follow={85}
                bounce={40}
                mood={caritaMood}
              />
            </div>

            {/* Subtle Wooden Mascot Shelf Rim */}
            <div className="w-40 h-2 bg-gradient-to-r from-transparent via-[#8b5a2b] to-transparent rounded-full opacity-60 shadow-md mt-1" />
          </div>
        </div>

        {/* Pinned Notes Layer (Z-20, draggable Post-it notes with pins) */}
        <div className="relative z-20 flex-1 w-full h-full pointer-events-none overflow-hidden p-4">
          <AnimatePresence>
            {notes.map((note) => {
              const theme = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
              const isSelected = selectedNoteId === note.id;

              return (
                <motion.div
                  key={note.id}
                  drag={activeTool === "pointer"}
                  dragMomentum={false}
                  initial={{ opacity: 0, scale: 0.7, rotate: note.rotation }}
                  animate={{ 
                    opacity: 1, 
                    scale: isSelected ? 1.02 : 1, 
                    rotate: note.rotation,
                    x: note.x,
                    y: note.y
                  }}
                  exit={{ opacity: 0, scale: 0.4, y: note.y + 60, transition: { duration: 0.2 } }}
                  onDragEnd={(_, info) => {
                    handleUpdateNote(note.id, {
                      x: Math.max(10, note.x + info.offset.x),
                      y: Math.max(10, note.y + info.offset.y)
                    });
                  }}
                  onClick={() => setSelectedNoteId(note.id)}
                  style={{ position: "absolute", left: 0, top: 0 }}
                  className={`pointer-events-auto w-64 sm:w-72 rounded-2xl p-4 border ${theme.border} ${theme.bg} ${theme.shadow} shadow-2xl transition-shadow group select-text cursor-grab active:cursor-grabbing`}
                >
                  {/* Realistic Metallic Pushpin at top center */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30">
                    <div 
                      className={`w-5 h-5 rounded-full border-2 border-white/80 shadow-md flex items-center justify-center ${
                        note.pinColor === "gold"
                          ? "bg-gradient-to-tr from-amber-500 to-yellow-300"
                          : note.pinColor === "blue"
                          ? "bg-gradient-to-tr from-blue-600 to-sky-300"
                          : note.pinColor === "emerald"
                          ? "bg-gradient-to-tr from-emerald-600 to-teal-300"
                          : "bg-gradient-to-tr from-rose-600 to-red-400"
                      }`}
                    >
                      <div className="w-1.5 h-1.5 bg-white/90 rounded-full" />
                    </div>
                    {/* Pin shadow */}
                    <div className="w-2.5 h-1 bg-black/30 rounded-full blur-[1px] mt-0.5" />
                  </div>

                  {/* Note Header: Title & Pin Controls */}
                  <div className="flex items-start justify-between gap-2 pt-1 mb-2">
                    <input
                      type="text"
                      value={note.title}
                      onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                      placeholder="Título de la nota..."
                      className={`font-black text-sm bg-transparent border-none focus:outline-none flex-1 truncate ${theme.header} ${theme.placeholder}`}
                    />

                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      {/* Color Picker trigger for Note */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const colorsList: (keyof typeof NOTE_COLORS)[] = ["yellow", "blue", "green", "pink", "purple", "orange"];
                          const curIdx = colorsList.indexOf(note.color);
                          const nextColor = colorsList[(curIdx + 1) % colorsList.length];
                          handleUpdateNote(note.id, { color: nextColor });
                        }}
                        className="p-1 text-slate-700 hover:text-black rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                        title="Cambiar color de Post-it"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>

                      {/* Unpin / Delete Note */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="p-1 text-slate-700 hover:text-rose-600 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                        title="Desclavar y borrar nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Note Body: Textarea */}
                  <textarea
                    value={note.content}
                    onChange={(e) => handleUpdateNote(note.id, { content: e.target.value })}
                    placeholder="Escribí acá tu nota, recordatorio o pendientes..."
                    rows={3}
                    className={`w-full text-xs font-medium bg-transparent resize-none focus:outline-none leading-relaxed ${theme.text} ${theme.placeholder}`}
                  />

                  {/* Optional Checklist items */}
                  {note.checklist && note.checklist.length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-black/10">
                      {note.checklist.map((chk) => (
                        <div key={chk.id} className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleChecklistItem(note.id, chk.id)}
                            className="cursor-pointer text-slate-700 hover:text-black"
                          >
                            {chk.done ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-800" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={chk.text}
                            onChange={(e) => handleUpdateChecklistText(note.id, chk.id, e.target.value)}
                            placeholder="Ítem de lista..."
                            className={`flex-1 bg-transparent border-none text-xs focus:outline-none ${theme.text} ${
                              chk.done ? "line-through opacity-60" : ""
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(note.id, chk.id)}
                            className="text-slate-500 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note Footer: Add checklist item + timestamp */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-black/5 text-[10px] text-slate-700/80 font-mono">
                    <button
                      type="button"
                      onClick={() => handleAddChecklistItem(note.id)}
                      className="inline-flex items-center gap-1 hover:underline text-slate-800 font-semibold cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Agregar tarea</span>
                    </button>
                    <span>{note.createdAt}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Bottom Wooden Tray (Ledge) with Real Chalk Sticks & Eraser */}
        <div 
          className="relative z-30 px-4 sm:px-8 py-3 bg-gradient-to-t from-[#2a1d12] via-[#3a281a] to-[#22160d] border-t-4 border-[#1c120a] shadow-2xl flex flex-wrap items-center justify-between gap-3"
          style={{
            boxShadow: "inset 0 4px 12px rgba(255,255,255,0.06), 0 -8px 25px rgba(0,0,0,0.7)"
          }}
        >
          {/* Left: Tools Selector (Tiza, Borrador, Puntero) */}
          <div className="flex items-center gap-2">
            {/* Tiza Mode */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("chalk");
                triggerCaritaSpeech("✏️ Modo Tiza: Dibujá o escribí en el pizarrón.");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === "chalk"
                  ? "bg-white/20 text-white border border-white/40 shadow-inner scale-105"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10"
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full border border-white/50" style={{ backgroundColor: chalkColor }} />
              <span>Tiza</span>
            </button>

            {/* Borrador Mode */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("eraser");
                triggerCaritaSpeech("🧽 Modo Borrador: Arrastrá para borrar trazos de tiza.");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === "eraser"
                  ? "bg-amber-400/25 text-amber-200 border border-amber-400/40 shadow-inner scale-105"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10"
              }`}
            >
              <Eraser className="w-3.5 h-3.5 text-amber-300" />
              <span>Borrador</span>
            </button>

            {/* Puntero / Mover Notas Mode */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("pointer");
                triggerCaritaSpeech("🖐️ Modo Mover: Arrastrá y ordená tus notas clavadas.");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === "pointer"
                  ? "bg-sky-400/25 text-sky-200 border border-sky-400/40 shadow-inner scale-105"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10"
              }`}
            >
              <span>🖐️ Mover Notas</span>
            </button>
          </div>

          {/* Center: Chalk Color Palette & Size (visible when chalk active) */}
          {activeTool === "chalk" && (
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Color de tiza:</span>
              <div className="flex items-center gap-1.5">
                {CHALK_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChalkColor(c.color)}
                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer border ${
                      chalkColor === c.color ? "scale-125 border-white shadow-md ring-2 ring-white/30" : "border-black/40 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
              </div>

              {/* Stroke size selector */}
              <div className="flex items-center gap-1 ml-2 border-l border-white/15 pl-2">
                {[
                  { w: 3, label: "Fina" },
                  { w: 6, label: "Media" },
                  { w: 12, label: "Gruesa" }
                ].map((s) => (
                  <button
                    key={s.w}
                    type="button"
                    onClick={() => setChalkWidth(s.w)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      chalkWidth === s.w
                        ? "bg-white/20 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Right: Actions (+ Clavar Nota, Limpiar Tiza) */}
          <div className="flex items-center gap-2">
            {/* Limpiar Pizarrón de tiza */}
            {hasChalkStrokes && (
              <button
                type="button"
                onClick={handleClearChalkboard}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white rounded-xl text-xs font-semibold border border-rose-500/30 transition-all cursor-pointer"
                title="Borrar todos los trazos de tiza"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar Tiza</span>
              </button>
            )}

            {/* + Clavar Nota Pin */}
            <button
              type="button"
              onClick={() => handleAddNote(activeNoteColor)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5 fill-current" />
              <span>+ Clavar Nota</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
