# RECON Clare AI — Backend

FastAPI application powering the RECON-AI Control Center. Provides REST APIs for Conversion events (Incumbent → BNY Eagle) and MMIF Regulatory Filing events (CBI).

## Prerequisites

| Service | Default | Required |
|---------|---------|----------|
| **Python** | 3.11+ | Yes |
| **MongoDB** | `localhost:27017` | Yes |
| **Neo4j** | `bolt://localhost:7687` | Optional (GraphRAG) |
| **Anthropic API key** | Set in `.env` | For AI analysis features |

### Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Docker
docker run -d -p 27017:27017 --name recon-mongo mongo:7
```

## Quick Start

```bash
cd backend

# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env   # then edit .env with your API keys
# Or use defaults — MongoDB on localhost:27017 works out of the box

# 4. Seed the database (first time only)
python3 db/seed.py

# 5. Start the server
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at **http://localhost:8000**.

## Environment Variables

Create a `.env` file in `backend/` (or set these in your shell):

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=recon_ai

# API Server
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=*

# LLM (for AI analysis features)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
ANTHROPIC_API_KEY=sk-ant-...

# Neo4j (optional — for GraphRAG)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=changeme
```

## Seed Data

Seed the database with sample events, funds, and reference data:

```bash
python3 db/seed.py
```

This creates:
- **4 Conversion events** (Vanguard, Fidelity, T. Rowe Price, American Funds)
- **3 MMIF Filing events** (Q1 UCITS, Q1 AIF, Monthly MMF)
- Reference data (securities, GL accounts, ledger categories, classifications)
- Sample MMIF validation data with intentional breaks
- MMIF mapping configuration

Re-running `seed.py` drops and re-creates all collections.

## API Endpoints

### Swagger UI

Once running, open **http://localhost:8000/docs** for interactive API documentation.

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | List conversion events |
| `GET` | `/api/events/{id}` | Get conversion event |
| `POST` | `/api/validate` | Run conversion validation |
| `GET` | `/api/events/{id}/runs` | List validation runs |

### MMIF Regulatory Filing Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mmif/events` | List MMIF filing events |
| `GET` | `/api/mmif/events/{id}` | Get MMIF event |
| `POST` | `/api/mmif/events` | Create MMIF event |
| `POST` | `/api/mmif/events/{id}/validate` | Run MMIF validation (VR-001..VR-015) |
| `GET` | `/api/mmif/events/{id}/runs` | List MMIF validation runs |
| `GET` | `/api/mmif/events/{id}/breaks` | List MMIF breaks |
| `GET` | `/api/mmif/events/{id}/summary` | Dashboard summary |
| `GET` | `/api/mmif/events/{id}/mapping` | Get GL→MMIF mapping config |
| `PUT` | `/api/mmif/events/{id}/mapping` | Update mapping config |
| `GET` | `/api/mmif/validation-rules` | List all VR rule definitions |
| `GET` | `/api/mmif/check-suite-options` | Check suite options for UI |

### Other Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET/PUT` | `/api/events/{id}/allocations` | Reviewer allocations |
| `GET/POST` | `/api/events/{id}/breaks` | Break resolution |
| `GET/POST` | `/api/known-differences` | Known differences |
| `GET/POST` | `/api/breaks/{id}/comments` | Break commentary |
| `GET` | `/api/notifications` | User notifications |
| `GET` | `/api/audit-logs` | Audit trail |
| `POST/GET` | `/api/mappings` | Data mapping definitions |

## Project Structure

```
backend/
├── api/
│   ├── main.py                 # FastAPI app, lifespan, core endpoints
│   ├── routers/
│   │   ├── __init__.py         # Router registry
│   │   ├── mmif.py             # MMIF regulatory filing endpoints
│   │   ├── allocations.py      # Reviewer allocation CRUD
│   │   ├── break_resolution.py # Break management
│   │   ├── mapping.py          # Data mapping utility
│   │   └── ...                 # Other routers
│   └── websocket.py            # WebSocket manager
├── db/
│   ├── mongodb.py              # MongoDB client + collection names
│   ├── schemas.py              # Pydantic schemas (all models)
│   └── seed.py                 # Database seeder
├── mmif/
│   ├── __init__.py
│   ├── validation_rules.py     # VR-001..VR-015 rule definitions
│   └── engine.py               # MMIF validation engine
├── services/
│   ├── validation_engine.py    # Conversion validation engine
│   ├── ai_analysis.py          # LLM-powered break analysis
│   ├── derived_subledger.py    # Subledger computation
│   └── mapping/                # Data mapping engine (CEL)
├── models/                     # SQLAlchemy models
├── agents/                     # LangGraph AI agent workflows
├── graph/                      # Neo4j schema + client
├── config/
│   └── settings.py             # Pydantic settings from .env
├── tests/
├── requirements.txt
└── .env
```

## Running Tests

```bash
source venv/bin/activate
pytest tests/ -v
```

## Connecting the Frontend

The frontend (React) expects the backend at `http://localhost:8000` by default.

```bash
cd ../frontend
npm install
npm start          # Runs on http://localhost:3000
```

Override the API URL with `REACT_APP_API_URL` if needed.

## User Roles

The system supports two primary user groups:

| Role | Focus | Default Route |
|------|-------|---------------|
| **Fund Accountant** | Conversion events (Incumbent → Eagle) | `/events` |
| **Fund Administrator** | MMIF regulatory filing (CBI) | `/mmif` |
| **Recon Lead** | Supervisory access to both | `/events` |

Switch roles in the UI via the role dropdown in the top-right corner.
