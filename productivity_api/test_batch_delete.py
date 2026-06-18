#!/usr/bin/env python
"""Test batch task deletion feature"""

import requests
import json

API = "http://localhost:8000"

# Test 1: List current tasks
print("=" * 70)
print("CURRENT TASKS:")
print("=" * 70)
r = requests.post(f"{API}/api/chat", json={"text": "montre mes taches", "context": "tasks"})
data = r.json()
tasks = data['action']['data']
print(json.dumps([{"id": t['id'], "title": t['title'], "status": t['status']} for t in tasks[:10]], indent=2, ensure_ascii=False))
print()

# Test 2: Delete multiple tasks
print("=" * 70)
print("DELETE MULTIPLE: 'supprime les taches 5 et 7'")
print("=" * 70)
r = requests.post(f"{API}/api/chat", json={"text": "supprime les taches 5 et 7", "context": "tasks"})
data = r.json()
print("Understanding:")
print(f"  Intent: {data['understanding'].get('intent')}")
print(f"  Confidence: {data['understanding'].get('confidence')}")
print(f"  Parameters: {json.dumps(data['understanding'].get('parameters'), ensure_ascii=False)}")
print()
print("Action Result:")
print(f"  Executed: {data['action'].get('executed')}")
print(f"  Message: {data['action'].get('message')}")
print()

# Test 3: Delete 3 tasks at once
print("=" * 70)
print("DELETE MULTIPLE: 'supprime les taches 6, 8, 10'")
print("=" * 70)
r = requests.post(f"{API}/api/chat", json={"text": "supprime les taches 6, 8, 10", "context": "tasks"})
data = r.json()
print("Understanding:")
print(f"  Intent: {data['understanding'].get('intent')}")
print(f"  Confidence: {data['understanding'].get('confidence')}")
print(f"  IDs to delete: {data['understanding'].get('parameters', {}).get('ids')}")
print()
print("Action Result:")
print(f"  Executed: {data['action'].get('executed')}")
print(f"  Message: {data['action'].get('message')}")
print()

# Test 4: Verify tasks were deleted
print("=" * 70)
print("REMAINING TASKS AFTER DELETE:")
print("=" * 70)
r = requests.post(f"{API}/api/chat", json={"text": "liste mes taches", "context": "tasks"})
data = r.json()
tasks = data['action']['data']
print(json.dumps([{"id": t['id'], "title": t['title']} for t in tasks[:10]], indent=2, ensure_ascii=False))
