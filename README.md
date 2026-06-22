# 🤖 TRADRLY BOT — Interface de démo (React + TypeScript)

**TRADRLY BOT** est un **assistant IA intelligent de bureau** : un compagnon (logiciel + robot physique) qui **écoute** votre voix, **comprend** votre intention, **agit** sur votre ordinateur et vos applications, puis **répond** à voix haute avec une présence émotionnelle (écran, LED, animations).

Ce projet est l'**interface de présentation** (front-end) qui simule le dialogue avec le bot pour une démo — sans backend ni matériel.

---

## 🎯 Ce que fait l'application

Une page web interactive qui montre, catégorie par catégorie, ce que TRADRLY BOT sait faire :

| Catégorie | Rôle |
|-----------|------|
| 🖥️ **Contrôle du bureau** | Ouvrir des applis, régler la luminosité, gérer fichiers/écran |
| 💻 **Assistant développeur** | Expliquer du code, corriger des erreurs, générer des fonctions, commits |
| ✅ **Productivité** | Tâches, rappels, mode focus, agenda |
| 💬 **Communication** | Lire/résumer emails, mentions Slack, résumés de réunion |
| ⚙️ **Automatisation** | Sauvegardes, rapports planifiés, scripts, intégrations (Notion...) |
| ❤️ **Compagnon personnel** | Discussion, motivation, humeur, mode relax |

### Fonctionnement de la démo
1. On choisit une **catégorie** dans la barre latérale.
2. On clique sur une **commande vocale suggérée** (ou on écrit / clique sur le micro 🎙️).
3. Le bot affiche une animation « écrit... » puis renvoie une **réponse simulée**, comme une vraie conversation.

> ⚠️ Les réponses sont **simulées** (données de démo dans `src/data.ts`). Aucune IA réelle n'est appelée — c'est une maquette de présentation.

---

## 📁 Structure du projet

```
tradrly-bot-react-ts/
├─ index.html            # Point d'entrée HTML
├─ package.json          # Dépendances + scripts npm
├─ tsconfig.json         # Configuration TypeScript
├─ vite.config.ts        # Configuration Vite
└─ src/
   ├─ main.tsx           # Montage de l'app React
   ├─ App.tsx            # Composant principal (UI + logique du chat)
   ├─ data.ts            # Données de démo (commandes → réponses)
   ├─ types.ts           # Types TypeScript partagés
   └─ styles.css         # Thème sombre + animations
```

---

## ▶️ Lancer le projet

### Pré-requis
- **Node.js 18+** installé
- **Python 3.9+** installé (pour le backend NLP/API)

### 1️⃣ Installation des dépendances

```bash
# Frontend (React + TypeScript + Vite)
npm install

# Backend (Python NLP API)
cd productivity_api
pip install -r requirements.txt
cd ..
```

### 2️⃣ Modes de lancement

#### 🌐 Frontend uniquement (Vite dev server)
```bash
npm run dev
# Accès : http://localhost:5173
```

#### 🌐 + 🔧 Frontend + Serveur backend Node.js
```bash
npm run dev:full
# Frontend : http://localhost:5173
# Backend  : http://localhost:3001
```

#### 🖥️ Frontend + Backend + Electron (Application desktop)
```bash
npm run electron:dev
# Lance Electron qui charge l'interface depuis http://localhost:5173
```

#### 📦 Build pour production
```bash
npm run build      # Compile TypeScript + Vite, génère /dist
npm run preview    # Prévisualise le build
npm run electron:build  # Construit l'exécutable Electron (.exe)
```

---

## 📋 Commandes npm disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Vite dev server (frontend) |
| `npm run server` | Serveur Node.js seul (port 3001) |
| `npm run dev:full` | Frontend + backend en parallèle |
| `npm run electron:dev` | Frontend + backend + Electron |
| `npm run build` | Compile et build optimisé |
| `npm run preview` | Prévisualise le build |
| `npm run electron:build` | Build Electron (.exe) |
| `npm run electron:preview` | Lance le build Electron |
------------------------
Pou Lancer l'API Python en parallèle. D'abord, je vais activer l'environnement Python et démarrer le serveur FastAPI :
cd c:\Users\LENOVO\Downloads\tradrly-bot-react-ts\tradrly-bot-react-ts\productivity_api; .\..\..\.venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000

---

## 🛠️ Stack technique
- **React 18** — interface par composants
- **TypeScript** — typage statique (`types.ts`)
- **Vite** — build ultra-rapide + hot reload
- **CSS pur** — thème sombre, animations (avatar, « écrit... », bulles)

---

## 💡 Aller plus loin (vraie version)
Pour connecter le bot pour de vrai, on remplacerait `findReply()` (dans `data.ts`) par des appels au pipeline IA :
**Micro → STT (Whisper) → NLU → LLM (GPT-4o) → Actions → TTS → Voix**.
Voir le fichier `TRADRLY_BOT_architecture.html` pour l'architecture électronique + IA complète.
