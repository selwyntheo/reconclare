"""
Lookup table service for cross-reference resolution during mapping execution.
"""
import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class LookupService:
    """Manages lookup tables: load from files, store in MongoDB, build in-memory indexes."""

    def __init__(self, db):
        self._db = db
        self._cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

    async def load_table_from_file(
        self, file_path: str, name: str, key_field: str,
        description: Optional[str] = None, uploaded_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Parse a CSV or JSON file and store as a lookup table in MongoDB."""
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix == ".csv":
            data = self._parse_csv(file_path)
        elif suffix == ".json":
            data = self._parse_json(file_path)
        else:
            raise ValueError(f"Unsupported lookup file format: {suffix}")

        # Validate key field exists
        if data and key_field not in data[0]:
            raise ValueError(f"Key field '{key_field}' not found in data. Available: {list(data[0].keys())}")

        table_id = f"lkp_{uuid4().hex[:12]}"
        doc = {
            "tableId": table_id,
            "name": name,
            "description": description,
            "keyField": key_field,
            "data": data,
            "rowCount": len(data),
            "uploadedAt": datetime.now(timezone.utc),
            "uploadedBy": uploaded_by,
        }

        collection = self._db["lookupTables"]
        await collection.insert_one(doc)
        self._build_index(name, data, key_field)

        return {"tableId": table_id, "name": name, "rowCount": len(data)}

    async def list_tables(self) -> List[Dict[str, Any]]:
        """List all available lookup tables (metadata only)."""
        collection = self._db["lookupTables"]
        cursor = collection.find({}, {"data": 0})
        return await cursor.to_list(length=1000)

    async def get_table(self, table_id: str) -> Optional[Dict[str, Any]]:
        """Get a lookup table by ID."""
        collection = self._db["lookupTables"]
        return await collection.find_one({"tableId": table_id})

    async def delete_table(self, table_id: str) -> bool:
        """Delete a lookup table."""
        collection = self._db["lookupTables"]
        result = await collection.delete_one({"tableId": table_id})
        # Remove from cache
        doc = await collection.find_one({"tableId": table_id})
        if doc:
            self._cache.pop(doc["name"], None)
        return result.deleted_count > 0

    async def load_tables_for_execution(self, table_names: Optional[List[str]] = None) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """Load lookup tables into memory for CEL evaluation.
        Returns {tableName: {keyValue: {field: value}}}."""
        collection = self._db["lookupTables"]

        query = {}
        if table_names:
            query["name"] = {"$in": table_names}

        cursor = collection.find(query)
        tables = await cursor.to_list(length=100)

        for table in tables:
            name = table["name"]
            if name not in self._cache:
                self._build_index(name, table["data"], table["keyField"])

        return self._cache

    def get_lookup_context(self) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """Return the current in-memory lookup context for CEL evaluation."""
        return self._cache

    def _build_index(self, name: str, data: List[Dict[str, Any]], key_field: str):
        """Build hash-indexed lookup map."""
        index = {}
        for row in data:
            key = str(row.get(key_field, ""))
            index[key] = row
        self._cache[name] = index

    @staticmethod
    def _parse_csv(file_path: str) -> List[Dict[str, Any]]:
        """Parse CSV file into list of dicts."""
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]

    @staticmethod
    def _parse_json(file_path: str) -> List[Dict[str, Any]]:
        """Parse JSON file into list of dicts."""
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return [data]
