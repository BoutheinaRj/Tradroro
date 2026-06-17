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

## ▶️ Lancer le projet (dans VS Code)

Pré-requis : **Node.js 18+** installé.

```bash
# 1. Ouvrir le dossier dans VS Code, puis dans le terminal :
npm install      # installe React, TypeScript, Vite
npm run dev      # lance le serveur de développement
```

Ouvrez ensuite l'adresse affichée (par défaut **http://localhost:5173**).

Pour générer la version de production :
```bash
npm run build    # vérifie les types (tsc) + build dans /dist
npm run preview  # prévisualise le build
```

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
