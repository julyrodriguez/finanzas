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
  Palette,
  Clock,
  Calendar,
  X,
  Cloud,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { EyeTrackerCube } from "./EyeTrackerCube";
import { getFirebaseDb } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from "firebase/firestore";

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
    shadow: "shadow-amber-500/20",
    tagBg: "bg-amber-400/30 text-amber-950"
  },
  blue: {
    bg: "bg-[#bae6fd]",
    border: "border-sky-300",
    text: "text-sky-950",
    header: "text-sky-900",
    placeholder: "placeholder-sky-800/40",
    shadow: "shadow-sky-500/20",
    tagBg: "bg-sky-400/30 text-sky-950"
  },
  green: {
    bg: "bg-[#bbf7d0]",
    border: "border-emerald-300",
    text: "text-emerald-950",
    header: "text-emerald-900",
    placeholder: "placeholder-emerald-800/40",
    shadow: "shadow-emerald-500/20",
    tagBg: "bg-emerald-400/30 text-emerald-950"
  },
  pink: {
    bg: "bg-[#fbcfe8]",
    border: "border-pink-300",
    text: "text-pink-950",
    header: "text-pink-900",
    placeholder: "placeholder-pink-800/40",
    shadow: "shadow-pink-500/20",
    tagBg: "bg-pink-400/30 text-pink-950"
  },
  purple: {
    bg: "bg-[#e9d5ff]",
    border: "border-purple-300",
    text: "text-purple-950",
    header: "text-purple-900",
    placeholder: "placeholder-purple-800/40",
    shadow: "shadow-purple-500/20",
    tagBg: "bg-purple-400/30 text-purple-950"
  },
  orange: {
    bg: "bg-[#fed7aa]",
    border: "border-orange-300",
    text: "text-orange-950",
    header: "text-orange-900",
    placeholder: "placeholder-orange-800/40",
    shadow: "shadow-orange-500/20",
    tagBg: "bg-orange-400/30 text-orange-950"
  }
};

const CHALK_COLORS = [
  { id: "white", name: "Tiza Blanca", color: "#f8fafc" },
  { id: "yellow", name: "Tiza Amarilla", color: "#fef08a" },
  { id: "cyan", name: "Tiza Celeste", color: "#7dd3fc" },
  { id: "mint", name: "Tiza Menta", color: "#86efac" },
  { id: "pink", name: "Tiza Rosa", color: "#f472b6" },
  { id: "orange", name: "Tiza Naranja", color: "#fdba74" }
];

const CARITA_GREETINGS = [
  "¡Bienvenido a tu Pizarrón de Control! 📌",
  "¡Anotá tus ideas antes de que se escapen! ✏️",
  "Pizarrón limpio = Día productivo 🧽",
  "¡Clavá una nota con un pin en el medio! 📌",
  "Dibujá o escribí lo que quieras en la pizarra ✨",
  "Supervisando compras y cotizaciones 🕵️‍♂️"
];

const API_BASE_URL = "https://apivacas.jariel.com.ar/api/pizarron/notes";

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
  const [eraserWidth, setEraserWidth] = useState<number>(45);
  const [hasChalkStrokes, setHasChalkStrokes] = useState<boolean>(false);

  // Pinned Notes State (Sin notas hardcodeadas)
  const [notes, setNotes] = useState<PinnedNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeNoteColor, setActiveNoteColor] = useState<keyof typeof NOTE_COLORS>("yellow");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLoadedFromDb, setIsLoadedFromDb] = useState<boolean>(false);

  // Carita State
  const [caritaSpeech, setCaritaSpeech] = useState<string>(CARITA_GREETINGS[0]);
  const [isSpeechVisible, setIsSpeechVisible] = useState<boolean>(true);
  const [caritaMood, setCaritaMood] = useState<"normal" | "thinking" | "searching">("normal");

  // Time & Date state
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

  // Sync to Backend (MongoDB + Firebase Firestore)
  const syncNoteToBackend = useCallback(async (note: PinnedNote) => {
    // 1. MongoDB API
    try {
      fetch(API_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note)
      }).catch((e) => console.warn("Aviso sync MongoDB nota:", e));
    } catch (e) {}

    // 2. Firebase Firestore
    try {
      const db = getFirebaseDb();
      if (db) {
        const docRef = doc(db, "pizarron_notas", note.id);
        await setDoc(docRef, note, { merge: true });
      }
    } catch (e) {
      console.warn("Aviso sync Firebase nota:", e);
    }
  }, []);

  const deleteNoteFromBackend = useCallback(async (noteId: string) => {
    // 1. MongoDB API
    try {
      fetch(`${API_BASE_URL}/${encodeURIComponent(noteId)}`, {
        method: "DELETE"
      }).catch((e) => console.warn("Aviso delete MongoDB nota:", e));
    } catch (e) {}

    // 2. Firebase Firestore
    try {
      const db = getFirebaseDb();
      if (db) {
        const docRef = doc(db, "pizarron_notas", noteId);
        await deleteDoc(docRef);
      }
    } catch (e) {
      console.warn("Aviso delete Firebase nota:", e);
    }
  }, []);

  // Cargar notas desde la BD al iniciar
  useEffect(() => {
    let isMounted = true;
    setIsSyncing(true);

    const loadNotesFromDb = async () => {
      let loaded = false;

      // 1. Intentar desde MongoDB
      try {
        const res = await fetch(API_BASE_URL);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.notes)) {
            if (isMounted) {
              setNotes(data.notes);
              loaded = true;
              setIsLoadedFromDb(true);
            }
          }
        }
      } catch (err) {
        console.warn("MongoDB notas no disponible, probando Firebase:", err);
      }

      // 2. Fallback con Firebase Firestore
      if (!loaded) {
        try {
          const db = getFirebaseDb();
          if (db) {
            const colRef = collection(db, "pizarron_notas");
            const snapshot = await getDocs(colRef);
            if (!isMounted) return;
            const fbNotes: PinnedNote[] = [];
            snapshot.forEach((d) => {
              fbNotes.push({ id: d.id, ...d.data() } as PinnedNote);
            });
            setNotes(fbNotes);
            setIsLoadedFromDb(true);
            loaded = true;
          }
        } catch (fbErr) {
          console.warn("Firebase notas error:", fbErr);
        }
      }

      // 3. Fallback localStorage si ambas BD fallaron
      if (!loaded && typeof window !== "undefined") {
        try {
          const local = localStorage.getItem("finanzas_blackboard_notes");
          if (local && isMounted) {
            setNotes(JSON.parse(local));
          }
        } catch (e) {}
      }

      if (isMounted) {
        setIsSyncing(false);
      }
    };

    loadNotesFromDb();

    // Listener Firestore en tiempo real si está disponible
    let unsubscribe: (() => void) | undefined = undefined;
    try {
      const db = getFirebaseDb();
      if (db) {
        const colRef = collection(db, "pizarron_notas");
        unsubscribe = onSnapshot(colRef, (snapshot) => {
          if (!isMounted) return;
          const liveNotes: PinnedNote[] = [];
          snapshot.forEach((d) => {
            liveNotes.push({ id: d.id, ...d.data() } as PinnedNote);
          });
          if (liveNotes.length > 0) {
            setNotes(liveNotes);
          }
        }, (err) => console.warn("Firestore snapshot listener aviso:", err));
      }
    } catch (e) {}

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Save notes to localStorage as backup
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("finanzas_blackboard_notes", JSON.stringify(notes));
      } catch (e) {}
    }
  }, [notes]);

  // Init and restore Canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const rect = board.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

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
      eraseSegment(ctx, pos.x, pos.y, eraserWidth);
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

    // Base chalk stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.75;
    ctx.shadowBlur = 1.8;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // Chalk micro-particles
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
      eraseSegment(ctx, pos.x, pos.y, eraserWidth);
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

  // Pinned Notes Operations: Clavar en el MEDIO de la pantalla
  const handleAddNote = (color: keyof typeof NOTE_COLORS = activeNoteColor) => {
    const colorsList: (keyof typeof NOTE_COLORS)[] = ["yellow", "blue", "green", "pink", "purple", "orange"];
    const chosenColor = color || colorsList[Math.floor(Math.random() * colorsList.length)];
    const pinColors: ("red" | "gold" | "blue" | "emerald")[] = ["red", "gold", "blue", "emerald"];
    const chosenPin = pinColors[Math.floor(Math.random() * pinColors.length)];

    const randomRot = Math.random() * 5 - 2.5;

    // Calcular posición EXACTA en el MEDIO del pizarrón
    const board = boardRef.current;
    const boardWidth = board ? board.clientWidth : window.innerWidth;
    const boardHeight = board ? board.clientHeight : window.innerHeight;
    const noteWidth = 275;
    const noteHeight = 190;

    // Jitter suave para que si clavas varias no queden 100% superpuestas
    const jitterX = (Math.random() - 0.5) * 50;
    const jitterY = (Math.random() - 0.5) * 50;

    const centerX = Math.max(20, Math.floor((boardWidth - noteWidth) / 2 + jitterX));
    const centerY = Math.max(70, Math.floor((boardHeight - noteHeight) / 2 + jitterY));

    const newNote: PinnedNote = {
      id: `note-${Date.now()}`,
      title: "Nueva Nota",
      content: "",
      color: chosenColor,
      pinColor: chosenPin,
      rotation: Number(randomRot.toFixed(1)),
      x: centerX,
      y: centerY,
      createdAt: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      checklist: []
    };

    setNotes((prev) => [...prev, newNote]);
    setSelectedNoteId(newNote.id);
    syncNoteToBackend(newNote);
    triggerCaritaSpeech("📌 ¡Nota clavada en el centro de la pizarra!");
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);
    deleteNoteFromBackend(id);
    triggerCaritaSpeech("🗑️ Nota desclavada y borrada de la BD");
  };

  const handleUpdateNote = (id: string, updates: Partial<PinnedNote>) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated = { ...n, ...updates };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleAddChecklistItem = (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const currentList = n.checklist || [];
        const updated = {
          ...n,
          checklist: [
            ...currentList,
            { id: `chk-${Date.now()}`, text: "", done: false }
          ]
        };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleToggleChecklistItem = (noteId: string, checkId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const updated = {
          ...n,
          checklist: (n.checklist || []).map((c) =>
            c.id === checkId ? { ...c, done: !c.done } : c
          )
        };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleUpdateChecklistText = (noteId: string, checkId: string, text: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const updated = {
          ...n,
          checklist: (n.checklist || []).map((c) =>
            c.id === checkId ? { ...c, text } : c
          )
        };
        syncNoteToBackend(updated);
        return updated;
      })
    );
  };

  const handleDeleteChecklistItem = (noteId: string, checkId: string) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== noteId) return n;
        const updated = {
          ...n,
          checklist: (n.checklist || []).filter((c) => c.id !== checkId)
        };
        syncNoteToBackend(updated);
        return updated;
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
    <div className="relative w-full h-full flex flex-col select-none">
      {/* Pizarrón que ocupa la pantalla completa */}
      <div 
        ref={boardRef}
        className="relative w-full h-full flex-1 rounded-2xl border-4 sm:border-8 border-[#26190e] bg-[#0c141d] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col transition-all"
        style={{
          boxShadow: "inset 0 0 100px rgba(0,0,0,0.85), 0 20px 50px rgba(0,0,0,0.95)",
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

        {/* Top Header Bar Integrada */}
        <div className="relative z-10 flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 border-b border-white/10 bg-black/40 backdrop-blur-md">
          {/* Left: Clock & Sync indicator */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs">
              <Calendar className="w-3.5 h-3.5 text-yellow-300" />
              <span>{currentDate || "Hoy"}</span>
              <span className="text-white/20">•</span>
              <Clock className="w-3.5 h-3.5 text-sky-300" />
              <span className="font-bold text-white">{currentTime}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">BD Conectada</span>
            </div>

            {isSyncing && (
              <span className="text-slate-400 text-[10px] font-mono flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>Sincronizando...</span>
              </span>
            )}
          </div>

          {/* Right: Notes count & Quick Search */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
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

        {/* ÁREA COMPLETA UNIFICADA DE LA PIZARRA */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {/* 1. Canvas Layer (Z-10): Dibuja y escribe tiza en TODA la superficie */}
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

          {/* 2. Carita Mascot Layer (Z-20): Perched in center top without any blocking shelf */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center select-none">
            {/* Clickable Carita */}
            <div 
              onClick={handleCaritaClick}
              className="cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              title="¡Hacé clic en la carita para interactuar!"
            >
              <EyeTrackerCube
                size={120}
                follow={85}
                bounce={40}
                mood={caritaMood}
              />
            </div>

            {/* Speech Bubble: Colocado debajo de la carita para que NUNCA sea tapado por el marco superior */}
            <AnimatePresence>
              {isSpeechVisible && caritaSpeech && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="absolute top-[125px] z-50 px-4 py-2 rounded-2xl bg-white/95 text-slate-900 text-xs font-bold shadow-2xl border border-white/50 flex items-center gap-2 max-w-sm text-center"
                >
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 border-l border-t border-white/50" />
                  <span>{caritaSpeech}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSpeechVisible(false);
                    }}
                    className="text-slate-400 hover:text-slate-800 cursor-pointer ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. Pinned Notes Layer (Z-30): Cubre el 100% de la pizarra SIN franjas ni clipping */}
          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
            <AnimatePresence>
              {notes.map((note) => {
                const theme = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
                const isSelected = selectedNoteId === note.id;

                return (
                  <motion.div
                    key={note.id}
                    drag
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.6, rotate: note.rotation }}
                    animate={{ 
                      opacity: 1, 
                      scale: isSelected ? 1.02 : 1, 
                      rotate: note.rotation,
                      x: note.x,
                      y: note.y
                    }}
                    exit={{ opacity: 0, scale: 0.3, y: note.y + 40, transition: { duration: 0.2 } }}
                    onDragEnd={(_, info) => {
                      const newX = Math.max(10, note.x + info.offset.x);
                      const newY = Math.max(10, note.y + info.offset.y);
                      handleUpdateNote(note.id, { x: newX, y: newY });
                    }}
                    onClick={() => setSelectedNoteId(note.id)}
                    style={{ position: "absolute", left: 0, top: 0 }}
                    className={`pointer-events-auto w-64 sm:w-72 rounded-2xl p-4 border ${theme.border} ${theme.bg} ${theme.shadow} shadow-2xl transition-shadow group select-text cursor-grab active:cursor-grabbing`}
                  >
                    {/* Chincheta Metálica en el centro superior */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-40">
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
                      <div className="w-2.5 h-1 bg-black/30 rounded-full blur-[1px] mt-0.5" />
                    </div>

                    {/* Encabezado de la Nota */}
                    <div className="flex items-center justify-between gap-2 pt-1 mb-2.5 w-full">
                      <input
                        type="text"
                        value={note.title}
                        onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                        placeholder="Título de la nota..."
                        style={{ backgroundColor: "transparent", color: "#0f172a" }}
                        className="font-black text-sm !bg-transparent border-none outline-none focus:outline-none flex-1 min-w-0 truncate text-slate-900 placeholder-slate-900/40"
                      />

                      <div className="flex items-center gap-0.5 shrink-0 bg-black/5 hover:bg-black/10 rounded-xl p-0.5 border border-black/10 transition-colors">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const colorsList: (keyof typeof NOTE_COLORS)[] = ["yellow", "blue", "green", "pink", "purple", "orange"];
                            const curIdx = colorsList.indexOf(note.color);
                            const nextColor = colorsList[(curIdx + 1) % colorsList.length];
                            handleUpdateNote(note.id, { color: nextColor });
                          }}
                          className="p-1 text-slate-700 hover:text-black rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
                          title="Cambiar color de Post-it"
                        >
                          <Palette className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          className="p-1 text-slate-700 hover:text-rose-600 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
                          title="Desclavar y borrar nota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Cuerpo de la Nota */}
                    <textarea
                      value={note.content}
                      onChange={(e) => handleUpdateNote(note.id, { content: e.target.value })}
                      placeholder="Escribí acá tu nota, recordatorio o pendientes..."
                      rows={3}
                      style={{ backgroundColor: "transparent", color: "#1e293b" }}
                      className="w-full text-xs font-semibold !bg-transparent resize-none border-none outline-none focus:outline-none leading-relaxed text-slate-800 placeholder-slate-800/40"
                    />

                    {/* Lista de Tareas / Checklist */}
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
                              style={{ backgroundColor: "transparent", color: "#1e293b" }}
                              className={`flex-1 !bg-transparent border-none text-xs focus:outline-none text-slate-800 ${
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

                    {/* Pie de Nota */}
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
        </div>

        {/* Bottom Wooden Tray (Ledge) */}
        <div 
          className="relative z-40 px-4 sm:px-6 py-2.5 bg-gradient-to-t from-[#26190e] via-[#352417] to-[#1f140b] border-t-4 border-[#170e07] shadow-2xl flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{
            boxShadow: "inset 0 4px 12px rgba(255,255,255,0.06), 0 -8px 25px rgba(0,0,0,0.8)"
          }}
        >
          {/* Herramientas (Tiza, Borrador, Mover Notas) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTool("chalk");
                triggerCaritaSpeech("✏️ Modo Tiza: Dibujá o escribí en el pizarrón.");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === "chalk"
                  ? "bg-white/20 text-white border border-white/40 shadow-inner scale-105"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10"
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full border border-white/50" style={{ backgroundColor: chalkColor }} />
              <span>Tiza</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("eraser");
                triggerCaritaSpeech("🧽 Modo Borrador: Arrastrá para borrar trazos.");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === "eraser"
                  ? "bg-amber-400/25 text-amber-200 border border-amber-400/40 shadow-inner scale-105"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10"
              }`}
            >
              <Eraser className="w-3.5 h-3.5 text-amber-300" />
              <span>Borrador</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTool("pointer");
                triggerCaritaSpeech("🖐️ Modo Mover: Arrastrá tus notas por toda la pizarra.");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTool === "pointer"
                  ? "bg-sky-400/25 text-sky-200 border border-sky-400/40 shadow-inner scale-105"
                  : "bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10"
              }`}
            >
              <span>🖐️ Mover Notas</span>
            </button>
          </div>

          {/* Paleta de Colores de Tiza */}
          {activeTool === "chalk" && (
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Tiza:</span>
              <div className="flex items-center gap-1.5">
                {CHALK_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChalkColor(c.color)}
                    className={`w-4.5 h-4.5 rounded-full transition-transform cursor-pointer border ${
                      chalkColor === c.color ? "scale-125 border-white shadow-md ring-2 ring-white/30" : "border-black/40 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
              </div>

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

          {/* Selector de Tamaño de Borrador */}
          {activeTool === "eraser" && (
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-amber-300 hidden sm:inline">Borrador:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { w: 20, label: "Fino" },
                  { w: 45, label: "Medio" },
                  { w: 85, label: "Grande" },
                  { w: 140, label: "XL (Rápido)" }
                ].map((s) => (
                  <button
                    key={s.w}
                    type="button"
                    onClick={() => {
                      setEraserWidth(s.w);
                      triggerCaritaSpeech(`🧽 Borrador ${s.label} (${s.w}px)`);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                      eraserWidth === s.w
                        ? "bg-amber-400 text-slate-950 font-bold shadow-md scale-105"
                        : "text-slate-300 hover:text-white bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span 
                      className="rounded-full bg-current opacity-80 inline-block" 
                      style={{ 
                        width: s.w === 20 ? 4 : s.w === 45 ? 6 : s.w === 85 ? 9 : 12, 
                        height: s.w === 20 ? 4 : s.w === 45 ? 6 : s.w === 85 ? 9 : 12 
                      }} 
                    />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Acciones: Limpiar Tiza y + Clavar Nota */}
          <div className="flex items-center gap-2">
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

            {/* + Clavar Nota: Coloca en el CENTRO */}
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
