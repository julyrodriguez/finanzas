/**
 * openclawBridge.ts
 * Puente de comunicación bidireccional entre la aplicación web de Finanzas
 * y el entorno local de OpenClaw.
 * 
 * 1. Sincroniza conversaciones, mails analizados y cotizaciones generadas
 *    en la memoria diaria de OpenClaw (~/.openclaw/workspace-finanzas/memory/YYYY-MM-DD.md).
 * 2. Permite despachar mensajes al Gateway de OpenClaw (puerto 18789)
 *    o mediante el CLI 'openclaw agent --agent agente-finanzas'.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";

const OPENCLAW_WORKSPACE = path.join(os.homedir(), ".openclaw", "workspace-finanzas");
const OPENCLAW_MEMORY_DIR = path.join(OPENCLAW_WORKSPACE, "memory");

export interface OpenClawSyncEntry {
  role: "user" | "assistant";
  content: string;
  emailContext?: {
    subject?: string;
    from?: string;
    date?: string;
  };
  actionCard?: {
    type: string;
    title: string;
    badgeText?: string;
  };
}

/**
 * Guarda el turno de conversación en la memoria diaria de OpenClaw
 */
export async function syncChatTurnToOpenClaw(entry: OpenClawSyncEntry): Promise<void> {
  try {
    if (!fs.existsSync(OPENCLAW_MEMORY_DIR)) {
      fs.mkdirSync(OPENCLAW_MEMORY_DIR, { recursive: true });
    }

    const today = new Date().toISOString().split("T")[0];
    const memoryFile = path.join(OPENCLAW_MEMORY_DIR, `${today}.md`);
    const time = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    let logText = `\n### [${time}] ${entry.role === "user" ? "👤 Julián (Web)" : "💼 FinanBot (Agente)"}\n`;

    if (entry.emailContext) {
      logText += `> 📧 **Correo Analizado:** "${entry.emailContext.subject}" de ${entry.emailContext.from} (${entry.emailContext.date})\n\n`;
    }

    logText += `${entry.content}\n`;

    if (entry.actionCard) {
      logText += `> ⚡ **Acción Ejecutada:** [${entry.actionCard.badgeText || entry.actionCard.type}] ${entry.actionCard.title}\n`;
    }

    fs.appendFileSync(memoryFile, logText, "utf-8");
  } catch (err: any) {
    console.warn("⚠️ [OpenClaw Bridge] No se pudo escribir en la memoria de OpenClaw:", err?.message);
  }
}

/**
 * Despacha un mensaje directamente al agente en el Gateway de OpenClaw vía CLI
 */
export async function dispatchToOpenClawGateway(message: string, timeoutMs = 25000): Promise<{
  success: boolean;
  reply?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, error: "OpenClaw Gateway timeout" });
    }, timeoutMs);

    execFile(
      "openclaw",
      ["agent", "--agent", "agente-finanzas", "--message", message, "--json"],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        clearTimeout(timer);
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }

        try {
          const json = JSON.parse(stdout);
          const reply =
            json.result?.finalAssistantVisibleText ||
            json.result?.finalAssistantRawText ||
            json.response ||
            "";
          resolve({ success: true, reply });
        } catch (e: any) {
          resolve({ success: false, error: "Respuesta no JSON de OpenClaw" });
        }
      }
    );
  });
}
