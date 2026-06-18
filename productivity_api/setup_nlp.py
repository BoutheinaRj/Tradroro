"""
Setup script to install NLP models and dependencies.
Run: python setup_nlp.py
"""

import subprocess
import sys


def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"\n📦 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} - Success")
            return True
        else:
            print(f"⚠️  {description} - Warning: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {description} - Error: {e}")
        return False


def setup():
    print("=" * 60)
    print("🚀 NLP Setup - Installing Models & Dependencies")
    print("=" * 60)

    # Install Python dependencies
    run_command(
        "pip install -q fastapi uvicorn sqlalchemy pydantic",
        "Installing FastAPI dependencies"
    )

    run_command(
        "pip install -q dateparser sentence-transformers torch",
        "Installing NLP base libraries"
    )

    # Install advanced NLP libraries
    run_command(
        "pip install -q spacy nltk textblob scikit-learn",
        "Installing Spacy, NLTK, TextBlob, Scikit-learn"
    )

    # Download Spacy French model
    run_command(
        f"{sys.executable} -m spacy download fr_core_news_md",
        "Downloading Spacy French model (fr_core_news_md)"
    )

    # Download NLTK data
    print("\n📦 Downloading NLTK data...")
    try:
        import nltk
        nltk.download("punkt", quiet=True)
        nltk.download("stopwords", quiet=True)
        nltk.download("averaged_perceptron_tagger", quiet=True)
        print("✅ NLTK data downloaded")
    except Exception as e:
        print(f"⚠️  NLTK data - Warning: {e}")

    print("\n" + "=" * 60)
    print("✅ Setup Complete!")
    print("=" * 60)
    print("\n🎯 Next steps:")
    print("  1. Run tests: python test_nlp.py")
    print("  2. Start API: uvicorn main:app --reload --port 8000")
    print("  3. Start UI: npm run electron:dev")


if __name__ == "__main__":
    setup()
