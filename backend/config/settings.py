from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # MongoDB (Canonical Model + Reconciliation Data)
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "recon_ai"

    # Neo4j (GraphRAG)
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "changeme"
    NEO4J_DATABASE: str = "reconai"

    # LLM
    LLM_PROVIDER: str = "openai"  # openai | anthropic
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o"
    LLM_TEMPERATURE: float = 0.0

    # Vector Store (ChromaDB)
    CHROMA_PERSIST_DIR: str = "./data/chroma"
    CHROMA_COLLECTION: str = "recon_ai_breaks"

    # Agent Configuration
    MATERIALITY_THRESHOLD_ABSOLUTE: float = 0.005  # $0.005/share
    MATERIALITY_THRESHOLD_RELATIVE: float = 0.0001  # 0.01%
    CONFIDENCE_ESCALATION_THRESHOLD: float = 0.70
    CRITICAL_BREAK_THRESHOLD: float = 0.0005  # 0.05% of NAV
    MAX_DRILL_DOWN_DEPTH: int = 4  # L0 through L3

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
