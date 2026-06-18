#!/usr/bin/env python
"""Test intelligent Gemini understanding - bugs fixes + multilingual + universal."""
import requests, json

API = "http://localhost:8000"

def chat(text, context=None):
    body = {"text": text}
    if context:
        body["context"] = context
    r = requests.post(f"{API}/api/chat", json=body)
    d = r.json()
    u = d.get("understanding", {})
    a = d.get("action") or {}
    return {
        "text": text,
        "context": context or "general",
        "intent": u.get("intent"),
        "params": {k: v for k, v in (u.get("parameters") or {}).items() if v not in (None, "", [])},
        "executed": a.get("executed"),
        "message": a.get("message"),
        "reply": u.get("natural_response"),
    }

def show(r):
    print(f"\n>>> [{r['context']}] \"{r['text']}\"")
    print(f"    intent={r['intent']}  params={json.dumps(r['params'], ensure_ascii=False)}")
    print(f"    executed={r['executed']}  msg={r['message']}")
    print(f"    reply={r['reply']}")

print("=" * 75)
print("SETUP: create tasks and events for testing")
print("=" * 75)
show(chat("add task review report", "general"))
show(chat("ajoute une tache appeler le client", "general"))
show(chat("schedule meeting with Manel tomorrow 2pm", "general"))
show(chat("planifie un rendez-vous avec Sara demain 4pm", "general"))

print("\n" + "=" * 75)
print("BUG 1: rename task (was not understood)")
print("=" * 75)
show(chat("liste mes taches", "tasks"))
show(chat("rename task to 'final report'", "tasks"))  # ambiguous, needs id
show(chat("renomme la tache 1 en rapport final", "tasks"))

print("\n" + "=" * 75)
print("BUG 2: delete specific event by name (was deleting ALL tomorrow)")
print("=" * 75)
show(chat("efface la reunion avec Manel de demain", "events"))
show(chat("liste mes evenements", "events"))  # Sara should still be there

print("\n" + "=" * 75)
print("MULTILINGUAL: Arabic + universal auto-detect")
print("=" * 75)
show(chat("اضف مهمة شراء الخبز", "general"))   # add task buy bread
show(chat("start a 45 minute focus", "general"))
show(chat("commence un focus de 30 minutes", "general"))

print("\nDONE.")
