"""
Test script for advanced NLP features.
Run: python test_nlp.py
"""

from spacy_extractor import parse_command_advanced, extract_priority_level, extract_participants
from nlp_advanced import extract_metadata, extract_priority, extract_entities

TEST_COMMANDS = [
    "Crée une réunion avec Alice et Bob sur ProjetX demain 14h, c'est URGENT !",
    "Note: Appeler le client Acme à 10h demain pour discuter contrat",
    "Ajoute tâche: réviser rapport pour Paul avant vendredi, prioritaire",
    "Planifie meeting avec Sarah sur ClientABC project, ASAP !",
    "Supprime la tâche #5 sur le ProjetNova",
    "Focus 45 minutes, pas d'interruption - important",
]


def test_spacy_extractor():
    """Test spacy_extractor.py functions"""
    print("\n" + "=" * 60)
    print("🧪 SPACY EXTRACTOR TESTS")
    print("=" * 60)

    for cmd in TEST_COMMANDS:
        print(f"\n📝 Input: {cmd}")
        parsed = parse_command_advanced(cmd)

        print(f"  ✓ Intent: {parsed['intent']}")
        print(f"  ✓ Title: {parsed['title']}")
        print(f"  ✓ Priority: {parsed['priority']} ({parsed['priority_label']})")
        print(f"  ✓ Entities: {parsed['entities']}")
        print(f"  ✓ Participants: {parsed['participants']}")
        print(f"  ✓ Main Verb: {parsed['verb']}")
        if parsed['start_at']:
            print(f"  ✓ Scheduled: {parsed['start_at']}")


def test_nlp_advanced():
    """Test nlp_advanced.py functions"""
    print("\n" + "=" * 60)
    print("🧪 ADVANCED NLP TESTS")
    print("=" * 60)

    for cmd in TEST_COMMANDS[:3]:
        print(f"\n📝 Input: {cmd}")
        meta = extract_metadata(cmd)

        print(f"  🏷️  Entities:")
        for ent_type, values in meta["entities"].items():
            if values:
                print(f"      - {ent_type}: {values}")

        priority_score, priority_kw = meta["priority"]
        print(f"  ⚡ Priority: {priority_score}/5 (keyword: '{priority_kw}')")

        sentiment = meta["sentiment"]
        print(f"  😊 Sentiment: {sentiment['emotion']} (polarity: {sentiment['polarity']:.2f})")

        if meta["verb_objects"]:
            print(f"  🔗 Verb-Objects: {meta['verb_objects']}")

        assignment = meta["assignment"]
        if assignment["assignee"]:
            print(f"  👤 Assignee: {assignment['assignee']}")
        if assignment["deadline"]:
            print(f"  📅 Deadline: {assignment['deadline']}")


def test_priority_detection():
    """Test priority detection"""
    print("\n" + "=" * 60)
    print("🎯 PRIORITY DETECTION TESTS")
    print("=" * 60)

    priority_tests = [
        ("C'est URGENT, fais-le maintenant", 5),
        ("Prioritaire, à faire avant vendredi", 4),
        ("Bientôt, pas trop tard", 3),
        ("Quand tu peux, pas pressé", 1),
    ]

    for cmd, expected in priority_tests:
        score, label = extract_priority_level(cmd)
        status = "✓" if score == expected else "✗"
        print(f"  {status} '{cmd}' → {score}/5")


def test_entity_extraction():
    """Test entity extraction"""
    print("\n" + "=" * 60)
    print("🏷️  ENTITY EXTRACTION TESTS")
    print("=" * 60)

    entity_tests = [
        ("Réunion avec Alice et Bob", ["Alice", "Bob"]),
        ("Parler à Marie de ProjetX chez Google", ["Marie", "ProjetX", "Google"]),
    ]

    for cmd, expected_people in entity_tests:
        entities = extract_entities(cmd)
        people = entities.get("people", [])
        status = "✓" if any(p in people for p in expected_people) else "✗"
        print(f"  {status} '{cmd}'")
        print(f"      Found: {people}")


if __name__ == "__main__":
    print("\n🚀 Starting NLP Test Suite...")

    try:
        test_spacy_extractor()
    except Exception as e:
        print(f"❌ Spacy Extractor Error: {e}")

    try:
        test_nlp_advanced()
    except Exception as e:
        print(f"❌ Advanced NLP Error: {e}")

    try:
        test_priority_detection()
    except Exception as e:
        print(f"❌ Priority Detection Error: {e}")

    try:
        test_entity_extraction()
    except Exception as e:
        print(f"❌ Entity Extraction Error: {e}")

    print("\n✅ Test Suite Complete!\n")
