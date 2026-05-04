# AI Recommendation Engine (Nexus Cinema)

Full-stack demo: **Django + DRF** backend with hybrid recommendations (content embeddings in **ChromaDB**, collaborative filtering, popularity, **Mistral** scoring), and a **React (Vite + TypeScript + Tailwind)** Netflix-style UI.

## Stack

| Layer | Tech |
|--------|------|
| API | Django 4.2, Django REST Framework, Token auth |
| ML / search | sentence-transformers (`all-MiniLM-L6-v2`), ChromaDB, scikit-learn |
| LLM | Mistral API (optional; feed still works without it) |
| UI | React 19, Vite, Tailwind CSS |

## Prerequisites

- **Python** 3.11+ (recommended)
- **Node.js** 20+ and npm
- Optional: **PostgreSQL** via `DATABASE_URL`; otherwise SQLite is used by default

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env` if you need Postgres, Mistral, or custom paths (see [Environment](#environment)).

```bash
python manage.py migrate
python manage.py seed_data --reset   # recommended once: clears old catalog so titles are unique
python manage.py generate_embeddings
python manage.py runserver
```

Re-run `seed_data` without flags to fill missing slots only (idempotent). Catalog titles are `"{Name} · #{tmdb_id}"` so no duplicate display names for seeded rows.

API runs at **http://127.0.0.1:8000** (default).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173** with `/api` proxied to the Django server (see `frontend/vite.config.ts`).

Register a user from the UI or use the login flow; the hybrid **feed** and explanations require authentication.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Optional. Postgres URL; if unset, SQLite `backend/db.sqlite3` is used |
| `DJANGO_SECRET_KEY` | Production secret |
| `DJANGO_DEBUG` | `true` / `false` |
| `MISTRAL_API_KEY` | Enables Mistral relevance, NL prefs, explanations, discovery chat |
| `MISTRAL_MODEL` | Default: `mistral-small-latest` |
| `CHROMA_PATH` | Chroma persistence directory (default: `backend/chroma_data`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins (default includes Vite dev URL) |

Do not commit real `.env` files; they are listed in `.gitignore`.

## Useful commands

| Command | Description |
|---------|-------------|
| `python manage.py seed_data` | Idempotent: ~220 movies by `tmdb_id` 10000–10219, users/ratings, A/B variants |
| `python manage.py seed_data --reset` | Wipes movies/ratings/genres (dev) then reseeds clean catalog |
| `python manage.py generate_embeddings` | (Re)build Chroma embeddings for catalog titles |

## Repository layout

```
backend/     Django project, apps (accounts, catalog, engagement, recommendations)
frontend/    Vite + React SPA
```

## Docker

A `backend/Dockerfile` is available for containerized deployment; adjust env and database to match your hosting setup.

## License

Use and modify for your own learning or products; add a license file if you redistribute.
