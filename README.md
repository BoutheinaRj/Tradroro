# 🚀 Tradroro – Assistant de productivité IA

Module de productivité de bureau, développé en 3 semaines au début de mon stage d'été chez **Tradrly**, avec un assistant IA intégré : **NOVA**.

Gérez vos tâches, votre agenda et vos sessions de concentration en parlant ou en écrivant naturellement :

> « Rappelle-moi de préparer la présentation demain à 14h »
> « Lance un focus de 25 minutes »
> « Montre-moi mes tâches urgentes »

## ✨ Fonctionnalités

- 🧠 **Compréhension par LLM (Google Gemini)** : détection d'intention, mémoire de conversation multi-tours, multilingue (FR, EN, arabe, arabizi)
- 🔁 **NLP de secours en local** : spaCy (entités, priorités), Sentence-Transformers (classification d'intentions), dateparser (dates en langage naturel)
- 🎙️ **Commandes vocales** : reconnaissance et synthèse vocale
- 🖥️ **Contrôle du bureau** : ouvrir des applications, régler le volume, verrouiller l'écran
- ✅ Tâches · 📅 Calendrier · ⏱️ Sessions Pomodoro / Focus

## ⚙️ Stack

| Couche | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, MUI, FullCalendar |
| Desktop | Electron |
| Serveur | Node.js / Express |
| Backend IA | Python, FastAPI, SQLAlchemy, SQLite |
| IA / NLP | Google Gemini, spaCy, Sentence-Transformers, NLTK, TextBlob, dateparser |

## 🛠️ Installation

```bash
# Frontend + serveur Node
npm install

# Backend Python
cd productivity_api
pip install -r requirements.txt
python -m spacy download fr_core_news_md
python -m spacy download en_core_web_sm
```

Créer `productivity_api/.env` :
```
GEMINI_API_KEY=votre_cle_api
```

## ▶️ Lancement

```bash
# Backend FastAPI
cd productivity_api && uvicorn main:app --reload --port 8000

# Application (serveur + Vite + Electron)
npm run electron:dev
```

## 👤 Auteur

Projet réalisé pendant un stage d'été chez Tradrly.
