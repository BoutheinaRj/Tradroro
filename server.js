import express from "express"
import cors from "cors"
import { spawnSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

const ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_CATEGORY: "INVALID_CATEGORY",
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_PARAMS: "INVALID_PARAMS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
}

const WINDOWS_RESERVED_NAMES = new Set([
  "con","prn","aux","nul",
  "com1","com2","com3","com4","com5","com6","com7","com8","com9",
  "lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9",
])

app.use(cors())
app.use(express.json())

// Chemin du bureau (Windows)
const DESKTOP_PATH = path.join(
  process.env.USERPROFILE || "C:\\Users\\LENOVO",
  "Desktop"
)

// ----------------- General helpers -----------------

function sendError(res, status, errorCode, message) {
  return res.status(status).json({ ok: false, success: false, errorCode, message })
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function runWindowsCommand(command, args) {
  return spawnSync(command, args, { windowsHide: true, encoding: "utf8" })
}

function readParams(body) {
  return body && typeof body.params === "object" && body.params !== null ? body.params : {}
}

function clampInt(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  return Math.max(min, Math.min(max, i))
}

// ----------------- File security -----------------

function isSafeFileSystemName(value) {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120) return false
  if (trimmed === "." || trimmed === "..") return false
  if (/[<>:"/\\|?*\x00-\x1F]/.test(trimmed)) return false
  const baseName = trimmed.split(".")[0].toLowerCase()
  return !WINDOWS_RESERVED_NAMES.has(baseName)
}

function isSafeRelativePath(value) {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 260) return false
  if (path.isAbsolute(trimmed)) return false
  if (trimmed.includes("..")) return false
  if (/[<>:"|?*\x00-\x1F]/.test(trimmed)) return false
  return !trimmed
    .split(/[\\/]/)
    .some((segment) => !segment || segment === "." || segment === "..")
}

function resolveDesktopPath(relativePath) {
  const resolved = path.resolve(DESKTOP_PATH, relativePath)
  const desktopRoot = path.resolve(DESKTOP_PATH)
  if (resolved !== desktopRoot && !resolved.startsWith(desktopRoot + path.sep)) return null
  return resolved
}

function createFolderResult(params) {
  const folderName =
    typeof params.folderName === "string" && params.folderName.trim()
      ? params.folderName.trim()
      : "Projet Nova"

  const folderRelativePath =
    typeof params.path === "string" && params.path.trim()
      ? params.path.trim()
      : folderName

  if (!isSafeFileSystemName(folderName)) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Invalid folder name." }
  }
  if (!isSafeRelativePath(folderRelativePath)) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Invalid folder path." }
  }

  const folderPath = resolveDesktopPath(folderRelativePath)
  if (!folderPath) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Invalid folder path." }
  }

  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true })

  return { ok: true, success: true, message: `📁 Folder '${path.basename(folderPath)}' created on the desktop ✅` }
}

function createTestFileResult(params) {
  const fileName =
    typeof params.fileName === "string" && params.fileName.trim()
      ? params.fileName.trim()
      : "test.txt"

  const fileRelativePath =
    typeof params.path === "string" && params.path.trim()
      ? params.path.trim()
      : fileName

  const content =
    typeof params.content === "string" && params.content.length > 0
      ? params.content
      : `This is a test file created by TRADRLY BOT 🤖
    Content was added automatically.
    Date: ${new Date().toLocaleString()}`

  if (!isSafeFileSystemName(fileName)) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Invalid file name." }
  }
  if (!isSafeRelativePath(fileRelativePath)) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Invalid file path." }
  }
  if (content.length > 20000) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ File content is too large." }
  }

  const filePath = resolveDesktopPath(fileRelativePath)
  if (!filePath) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Invalid file path." }
  }

  fs.writeFileSync(filePath, content, "utf-8")
  return {
    ok: true,
    success: true,
    message: `📝 File '${path.basename(filePath)}' created successfully on the desktop ✅\n\nContent:\n---\n${content}\n---`,
  }
}

// ----------------- Luminosité (laptop) -----------------

function setLaptopBrightness(level) {
  const lvl = clampInt(level, 0, 100)
  if (lvl === null) {
    return { ok: false, success: false, errorCode: ERROR_CODES.INVALID_PARAMS, message: "❌ Niveau de luminosité invalide (0–100)." }
  }

  const psCommand = `
    $level = ${lvl};
    $methods = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods;
    if ($methods -eq $null) { throw "WmiMonitorBrightnessMethods not available"; }
    $methods.WmiSetBrightness(1, $level) | Out-Null;
    "OK"
  `

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
    { windowsHide: true, encoding: "utf8" }
  )

  if (result.status !== 0) {
    const details = (result.stderr || "").trim()
    return {
      ok: false,
      success: false,
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      message:
        "❌ Impossible de régler la luminosité (vérifiez pilotes/permissions)."
        + (details ? `\nDétails: ${details}` : ""),
    }
  }

  return { ok: true, success: true, message: `☀️ Brightness set to ${lvl}%.` }
}

function extractBrightnessLevelFromText(text) {
  if (typeof text !== "string") return null
  const t = normalizeText(text)

  // "set brightness to 80%", "brightness 50", "brightness 70%"
  const m =
    t.match(/(?:luminosite|brightness).*?(\d{1,3})\s*%?/) ||
    t.match(/(\d{1,3})\s*%?\s*(?:luminosite|brightness)/)

  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ----------------- Volume (touches média) -----------------

function pressMediaKey(vkHex) {
  const ps = `
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class K {
      [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
    }
"@
    [K]::keybd_event(${vkHex},0,0,0)
    [K]::keybd_event(${vkHex},0,2,0)
    "OK"
  `
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, encoding: "utf8" }
  )
  return r
}

function volumeMuteToggle() {
  const r = pressMediaKey("0xAD") // VK_VOLUME_MUTE
  if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to mute/unmute." }
  return { ok:true, success:true, message:"🔇 Mute/unmute toggled." }
}

function volumeUp() {
  const r = pressMediaKey("0xAF") // VK_VOLUME_UP
  if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to increase the volume." }
  return { ok:true, success:true, message:"🔊 Volume increased." }
}

function volumeDown() {
  const r = pressMediaKey("0xAE") // VK_VOLUME_DOWN
  if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to decrease the volume." }
  return { ok:true, success:true, message:"🔉 Volume decreased." }
}

// ----------------- Fenêtres -----------------

function minimizeAllWindows() {
  const ps = `
    $shell = New-Object -ComObject Shell.Application
    $shell.MinimizeAll()
    "OK"
  `
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, encoding: "utf8" }
  )
  if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to minimize windows." }
  return { ok:true, success:true, message:"🪟 All windows minimized." }
}

function undoMinimizeAllWindows() {
  const ps = `
    $shell = New-Object -ComObject Shell.Application
    $shell.UndoMinimizeALL()
    "OK"
  `
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, encoding: "utf8" }
  )
  if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to restore windows." }
  return { ok:true, success:true, message:"🪟 Windows restored." }
}

// ----------------- Apps (ouvrir/fermer) -----------------

function openAppStart(exeOrAlias) {
  // Utilise "start" : marche pour beaucoup d'apps (alias)
  const r = runWindowsCommand("cmd", ["/c", "start", "", exeOrAlias])
  if (r.status !== 0) {
    return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to open the app." }
  }
  return { ok:true, success:true, message:`🚀 ${exeOrAlias} is opening...` }
}

function killProcess(imageName) {
  const r = runWindowsCommand("taskkill", ["/IM", imageName, "/F"])
  if (r.status !== 0) {
    return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:`❌ Unable to close ${imageName}.` }
  }
  return { ok:true, success:true, message:`❎ ${imageName} closed.` }
}

// ----------------- Actions desktop -----------------

const desktopActions = {
  // Open apps
  "ouvre visual studio code": () => openAppStart("code"),
  "ouvre chrome": () => openAppStart("chrome"),
  "ouvre edge": () => openAppStart("msedge"),
  "ouvre bloc-notes": () => openAppStart("notepad"),
  "ouvre calculatrice": () => openAppStart("calc"),
  "ouvre explorateur": () => openAppStart("explorer"),
  "ouvre parametres": () => openAppStart("ms-settings:"),

  // Close apps (process names)
  "ferme chrome": () => killProcess("chrome.exe"),
  "ferme edge": () => killProcess("msedge.exe"),
  "ferme visual studio code": () => killProcess("Code.exe"),
  "ferme bloc-notes": () => killProcess("notepad.exe"),

  // Windows
  "minimise toutes les fenetres": () => minimizeAllWindows(),
  "restaure toutes les fenetres": () => undoMinimizeAllWindows(),

  // Volume
  "mute le volume": () => volumeMuteToggle(),
  "active le mute": () => volumeMuteToggle(),
  "augmente le volume": () => volumeUp(),
  "baisse le volume": () => volumeDown(),

  // Brightness (fallback when no number is provided)
  "augmente la luminosité": (params) => setLaptopBrightness(params?.level ?? 80),

  // System
  "verrouille mon écran": () => {
    const r = runWindowsCommand("rundll32.exe", ["user32.dll,LockWorkStation"])
    if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to lock the screen." }
    return { ok:true, success:true, message:"🔒 Screen locked. See you soon!" }
  },

  "mets le pc en veille": () => {
    const r = runWindowsCommand("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"])
    if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to put the PC to sleep." }
    return { ok:true, success:true, message:"💤 Going to sleep..." }
  },

  // Files/folders
  "crée un dossier": (params) => createFolderResult(params),
  "crée un fichier test": (params) => createTestFileResult(params),

  "ouvre le bureau": () => {
    const r = runWindowsCommand("cmd", ["/c", "start", "", "explorer", DESKTOP_PATH])
    if (r.status !== 0) return { ok:false, success:false, errorCode: ERROR_CODES.INTERNAL_ERROR, message:"❌ Unable to open the desktop." }
    return { ok:true, success:true, message:"📂 Desktop opened." }
  },
}

const desktopCommandAliases = {
  "open visual studio code": "ouvre visual studio code",
  "open chrome": "ouvre chrome",
  "open edge": "ouvre edge",
  "open notepad": "ouvre bloc-notes",
  "open calculator": "ouvre calculatrice",
  "open file explorer": "ouvre explorateur",
  "open settings": "ouvre parametres",
  "close chrome": "ferme chrome",
  "close edge": "ferme edge",
  "close visual studio code": "ferme visual studio code",
  "close notepad": "ferme bloc-notes",
  "minimize all windows": "minimise toutes les fenetres",
  "restore all windows": "restaure toutes les fenetres",
  "mute volume": "mute le volume",
  "toggle mute": "active le mute",
  "increase volume": "augmente le volume",
  "decrease volume": "baisse le volume",
  "lock my screen": "verrouille mon écran",
  "put the pc to sleep": "mets le pc en veille",
  "open the desktop": "ouvre le bureau",
  "create a folder project nova on the desktop": "crée un dossier",
  "create a test.txt file with text": "crée un fichier test",
  "set brightness to 80%": "augmente la luminosité",
  "set brightness to 30%": "augmente la luminosité",
}

const desktopCommandWhitelist = new Map(
  Object.keys(desktopActions).map((command) => [normalizeText(command), command])
)

for (const [alias, target] of Object.entries(desktopCommandAliases)) {
  desktopCommandWhitelist.set(normalizeText(alias), target)
}

// ----------------- Endpoint -----------------

app.post("/api/execute", (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {}
  const { command, category, action } = body

  if (typeof category !== "string" || !category.trim()) {
    return sendError(res, 400, ERROR_CODES.INVALID_REQUEST, "Catégorie manquante ou invalide.")
  }

  // Only desktop is allowed for now
  if (category !== "desktop") {
    return sendError(res, 400, ERROR_CODES.INVALID_CATEGORY, "Category not allowed.")
  }

  // 1) Dynamic brightness handling: "brightness at X%"
  const brightnessLevel =
    extractBrightnessLevelFromText(command) ?? extractBrightnessLevelFromText(action)

  if (brightnessLevel !== null) {
    const result = setLaptopBrightness(brightnessLevel)
    if (!result || result.ok === false) {
      return res.status(400).json({
        ok: false,
        success: false,
        errorCode: result?.errorCode || ERROR_CODES.INVALID_REQUEST,
        message: result?.message || "❌ Unable to adjust brightness",
      })
    }
    return res.json({ ok: true, success: true, message: result.message })
  }

  // 2) Standard whitelist (command / action)
  const normalizedAction = typeof action === "string" ? normalizeText(action) : ""
  const normalizedCommand = typeof command === "string" ? normalizeText(command) : ""

  const whitelistedCommand =
    desktopCommandWhitelist.get(normalizedAction) ||
    desktopCommandWhitelist.get(normalizedCommand)

  if (!whitelistedCommand) {
    return sendError(res, 400, ERROR_CODES.INVALID_ACTION, "Action not allowed or command unknown.")
  }

  const params = readParams(body)
  const result = desktopActions[whitelistedCommand](params)

  if (!result || result.ok === false) {
    return res.status(400).json({
      ok: false,
      success: false,
      errorCode: result?.errorCode || ERROR_CODES.INVALID_REQUEST,
      message: result?.message || "🤖 Command not recognized. Please try again.",
    })
  }

  return res.json({ ok: true, success: true, message: result.message })
})

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 TRADRLY BOT Server running on http://localhost:${PORT}`)
})