"""
Test complet du pipeline Gemini API → Exécution automatique
"""
import requests
import json
from datetime import datetime, timedelta

API = "http://localhost:8000"

def log(title, data):
    print("\n" + "="*70)
    print(f"🧪 {title}")
    print("="*70)
    print(json.dumps(data, indent=2, ensure_ascii=False))

def test_complete_pipeline():
    """Test complet: Gemini → Compréhension → Exécution"""
    
    # TEST 1: Create task
    print("\n" + "🚀 "*35)
    print("PIPELINE E2E: Gemini API → Action Exécution")
    print("🚀 "*35)
    
    r1 = requests.post(f"{API}/api/chat", json={
        "text": "cree une tache urgente finir le projet avant vendredi",
        "context": "tasks"
    })
    result1 = r1.json()
    log("1. CREATE_TASK", {
        "input": "cree une tache urgente finir le projet avant vendredi",
        "understanding": {
            "intent": result1['understanding'].get('intent'),
            "confidence": result1['understanding'].get('confidence'),
            "parameters": result1['understanding'].get('parameters'),
        },
        "action": {
            "executed": result1['action'].get('executed'),
            "message": result1['action'].get('message'),
            "data": result1['action'].get('data')
        }
    })
    
    # TEST 2: List tasks
    r2 = requests.post(f"{API}/api/chat", json={
        "text": "montre toutes mes taches",
        "context": "tasks"
    })
    result2 = r2.json()
    task_count = len(result2['action'].get('data', []))
    log("2. LIST_TASKS", {
        "input": "montre toutes mes taches",
        "understanding": {
            "intent": result2['understanding'].get('intent'),
            "confidence": result2['understanding'].get('confidence'),
        },
        "action": {
            "executed": result2['action'].get('executed'),
            "message": result2['action'].get('message'),
            "tasks_count": task_count,
            "first_3_tasks": [
                {"id": t['id'], "title": t['title'], "status": t['status']}
                for t in result2['action'].get('data', [])[:3]
            ]
        }
    })
    
    # TEST 3: Update task (mark as done)
    if task_count > 0:
        r3 = requests.post(f"{API}/api/chat", json={
            "text": "marque la tache 1 comme done",
            "context": "tasks"
        })
        result3 = r3.json()
        log("3. UPDATE_TASK (Mark Done)", {
            "input": "marque la tache 1 comme done",
            "understanding": {
                "intent": result3['understanding'].get('intent'),
                "confidence": result3['understanding'].get('confidence'),
                "parameters": result3['understanding'].get('parameters'),
            },
            "action": {
                "executed": result3['action'].get('executed'),
                "message": result3['action'].get('message'),
                "updated_task": result3['action'].get('data', {}).get('status')
            }
        })
    
    # TEST 4: Schedule event
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r4 = requests.post(f"{API}/api/chat", json={
        "text": f"planifie une reunion avec le client demain a 15h30",
        "context": "events"
    })
    result4 = r4.json()
    log("4. SCHEDULE_EVENT", {
        "input": "planifie une reunion avec le client demain a 15h30",
        "understanding": {
            "intent": result4['understanding'].get('intent'),
            "confidence": result4['understanding'].get('confidence'),
            "parameters": result4['understanding'].get('parameters'),
        },
        "action": {
            "executed": result4['action'].get('executed'),
            "message": result4['action'].get('message'),
            "event_data": result4['action'].get('data')
        }
    })
    
    # TEST 5: List events
    r5 = requests.post(f"{API}/api/chat", json={
        "text": "quels sont mes evenements",
        "context": "events"
    })
    result5 = r5.json()
    event_count = len(result5['action'].get('data', []))
    log("5. LIST_EVENTS", {
        "input": "quels sont mes evenements",
        "understanding": {
            "intent": result5['understanding'].get('intent'),
            "confidence": result5['understanding'].get('confidence'),
        },
        "action": {
            "executed": result5['action'].get('executed'),
            "message": result5['action'].get('message'),
            "events_count": event_count,
            "first_3_events": [
                {"id": e['id'], "title": e['title'], "start_at": e['start_at'][:10]}
                for e in result5['action'].get('data', [])[:3]
            ]
        }
    })
    
    # TEST 6: Start focus session
    r6 = requests.post(f"{API}/api/chat", json={
        "text": "demarre un focus de 50 minutes",
        "context": "focus"
    })
    result6 = r6.json()
    log("6. START_FOCUS", {
        "input": "demarre un focus de 50 minutes",
        "understanding": {
            "intent": result6['understanding'].get('intent'),
            "confidence": result6['understanding'].get('confidence'),
            "parameters": result6['understanding'].get('parameters'),
        },
        "action": {
            "executed": result6['action'].get('executed'),
            "message": result6['action'].get('message'),
            "session_data": {
                "id": result6['action'].get('data', {}).get('id'),
                "minutes": result6['action'].get('data', {}).get('minutes'),
                "status": result6['action'].get('data', {}).get('status')
            }
        }
    })
    
    # TEST 7: Stop focus
    r7 = requests.post(f"{API}/api/chat", json={
        "text": "arrete mon focus",
        "context": "focus"
    })
    result7 = r7.json()
    log("7. STOP_FOCUS", {
        "input": "arrete mon focus",
        "understanding": {
            "intent": result7['understanding'].get('intent'),
            "confidence": result7['understanding'].get('confidence'),
        },
        "action": {
            "executed": result7['action'].get('executed'),
            "message": result7['action'].get('message'),
            "session_status": result7['action'].get('data', {}).get('status')
        }
    })
    
    # TEST 8: Context validation (wrong context)
    r8 = requests.post(f"{API}/api/chat", json={
        "text": "cree une tache urgente",
        "context": "events"  # Wrong context!
    })
    result8 = r8.json()
    log("8. CONTEXT_VALIDATION (Wrong Context)", {
        "input": "cree une tache urgente",
        "context_used": "events (should be tasks!)",
        "understanding": {
            "intent": result8['understanding'].get('intent'),
            "confidence": result8['understanding'].get('confidence'),
            "natural_response": result8['understanding'].get('natural_response')[:100] + "..."
        },
        "action": {
            "executed": result8['action'].get('executed') if result8.get('action') else None,
        }
    })
    
    print("\n" + "✅ "*35)
    print("TEST SUITE COMPLÈTE TERMINÉE")
    print("✅ "*35)

if __name__ == "__main__":
    test_complete_pipeline()
