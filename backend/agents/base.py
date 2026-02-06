"""
Base Agent class for all RECON-AI reconciliation agents.
Provides common infrastructure: LLM access, DB queries, graph queries, tool execution.
"""
import json
from abc import ABC, abstractmethod
from datetime import date
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import Session as SQLSession, sessionmaker

from src.agents.state import AgentState, AgentFinding
from src.config.settings import settings
from src.graph.neo4j_client import Neo4jClient


class BaseAgent(ABC):
    """
    Abstract base class for all RECON-AI agents.
    Provides shared infrastructure for LLM, database, and graph access.
    """

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self._llm: Optional[ChatOpenAI] = None
        self._neo4j: Optional[Neo4jClient] = None
        self._sql_engine = None
        self._sql_session_factory = None

    # =========================================================================
    # Infrastructure Access
    # =========================================================================

    @property
    def llm(self) -> ChatOpenAI:
        if self._llm is None:
            self._llm = ChatOpenAI(
                model=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                api_key=settings.OPENAI_API_KEY,
            )
        return self._llm

    @property
    def neo4j(self) -> Neo4jClient:
        if self._neo4j is None:
            self._neo4j = Neo4jClient()
        return self._neo4j

    @property
    def sql_session_factory(self):
        if self._sql_session_factory is None:
            self._sql_engine = create_engine(settings.postgres_url)
            self._sql_session_factory = sessionmaker(bind=self._sql_engine)
        return self._sql_session_factory

    def get_sql_session(self) -> SQLSession:
        return self.sql_session_factory()

    # =========================================================================
    # Core Agent Interface
    # =========================================================================

    @abstractmethod
    def analyze(self, state: AgentState) -> AgentState:
        """
        Execute this agent's analysis on the current state.
        Must be implemented by all concrete agents.
        Returns the updated state.
        """
        pass

    def __call__(self, state: AgentState) -> AgentState:
        """Make agent callable for LangGraph node integration."""
        state.current_agent = self.name
        state.add_trace(self.name, "started", {"phase": state.phase.value})
        result = self.analyze(state)
        state.add_trace(self.name, "completed", {"phase": state.phase.value})
        return result

    # =========================================================================
    # LLM Helpers
    # =========================================================================

    def llm_reason(
        self, system_prompt: str, user_prompt: str,
        structured_output: bool = False,
    ) -> str:
        """Call the LLM with a system + user prompt pair."""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        if structured_output:
            response = self.llm.invoke(
                messages,
                response_format={"type": "json_object"},
            )
        else:
            response = self.llm.invoke(messages)
        return response.content

    def llm_classify(
        self, description: str, categories: list[str]
    ) -> str:
        """Use LLM to classify a break into one of the given categories."""
        system_prompt = (
            "You are a fund accounting expert. Classify the following "
            "reconciliation break into exactly one of the provided categories. "
            "Respond with ONLY the category name, nothing else."
        )
        user_prompt = (
            f"Break description: {description}\n\n"
            f"Categories: {', '.join(categories)}\n\n"
            f"Classification:"
        )
        return self.llm_reason(system_prompt, user_prompt).strip()

    # =========================================================================
    # Database Query Helpers
    # =========================================================================

    def query_sql(self, stmt) -> list:
        """Execute a SQLAlchemy select statement and return results."""
        with self.get_sql_session() as session:
            result = session.execute(stmt).scalars().all()
            return result

    def query_sql_raw(self, sql: str, params: dict = None) -> list[dict]:
        """Execute raw SQL and return results as list of dicts."""
        with self.get_sql_session() as session:
            result = session.execute(text(sql), params or {})
            columns = result.keys()
            return [dict(zip(columns, row)) for row in result.fetchall()]

    # =========================================================================
    # Graph Query Helpers
    # =========================================================================

    def query_graph(self, cypher: str, params: dict = None) -> list[dict]:
        """Execute a Cypher query against Neo4j."""
        with self.neo4j.session() as session:
            result = session.run(cypher, **(params or {}))
            return [dict(record) for record in result]

    def graph_causal_drill_down(
        self, account: str, valuation_dt: str
    ) -> list[dict]:
        """Execute the causal drill-down graph traversal."""
        return self.neo4j.causal_drill_down(account, valuation_dt)

    def graph_pattern_match(
        self, break_category: str, variance: float, **kwargs
    ) -> list[dict]:
        """Execute pattern matching against historical breaks."""
        return self.neo4j.pattern_match(break_category, variance, **kwargs)

    # =========================================================================
    # Finding Helpers
    # =========================================================================

    def create_finding(
        self, description: str, evidence: dict = None,
        confidence: float = 0.0, recommended_action: str = "",
        level: str = "",
    ) -> AgentFinding:
        """Create a standardized finding."""
        return AgentFinding(
            agent_name=self.name,
            level=level or self.name,
            description=description,
            evidence=evidence or {},
            confidence=confidence,
            recommended_action=recommended_action,
        )
