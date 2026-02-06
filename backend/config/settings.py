from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # PostgreSQL (Canonical Model / CPU Tasks)
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "recon_ai"
    POSTGRES_USER: str = "recon_ai"
    POSTGRES_PASSWORD: str = "changeme"

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

    # Kafka (Event Bus)
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_BREAK_ALERT_TOPIC: str = "recon.break.alerts"
    KAFKA_AGENT_EVENTS_TOPIC: str = "recon.agent.events"

    # Redis (Caching)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Agent Configuration
    MATERIALITY_THRESHOLD_ABSOLUTE: float = 0.005  # $0.005/share
    MATERIALITY_THRESHOLD_RELATIVE: float = 0.0001  # 0.01%
    CONFIDENCE_ESCALATION_THRESHOLD: float = 0.70
    CRITICAL_BREAK_THRESHOLD: float = 0.0005  # 0.05% of NAV
    MAX_DRILL_DOWN_DEPTH: int = 4  # L0 through L3

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def postgres_async_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
