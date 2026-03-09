"""
Unit tests for source readers: CSV, JSON, Excel with various options.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.mapping.readers import CsvReader, JsonReader, ExcelReader, get_reader

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "mapping")


class TestCsvReader:
    def test_read_csv(self):
        reader = CsvReader()
        rows = list(reader.read(
            os.path.join(FIXTURES, "sample_nav.csv"),
            {"delimiter": ",", "hasHeader": True, "nullValues": ["", "N/A", "NULL"], "trimValues": True},
        ))
        assert len(rows) == 7
        assert rows[0]["Fund_ID"] == "VGD-500"
        assert rows[0]["Currency"] == "USD"

    def test_read_csv_null_handling(self):
        reader = CsvReader()
        rows = list(reader.read(
            os.path.join(FIXTURES, "sample_nav.csv"),
            {"delimiter": ",", "hasHeader": True, "nullValues": ["", "N/A", "NULL"]},
        ))
        # Row 6 (index 5) has empty Fund_ID and N/A Net_Assets
        empty_row = rows[5]
        assert empty_row["Fund_ID"] is None or empty_row["Fund_ID"] == ""
        assert empty_row["Net_Assets"] is None

    def test_count_rows(self):
        reader = CsvReader()
        count = reader.count_rows(
            os.path.join(FIXTURES, "sample_nav.csv"),
            {"hasHeader": True, "skipRows": 0},
        )
        assert count == 7

    def test_infer_schema(self):
        reader = CsvReader()
        fields = reader.infer_schema(
            os.path.join(FIXTURES, "sample_nav.csv"),
            {"delimiter": ","},
        )
        assert len(fields) >= 7
        names = [f["name"] for f in fields]
        assert "Fund_ID" in names
        assert "Val_Date" in names


class TestJsonReader:
    def test_read_json(self):
        reader = JsonReader()
        rows = list(reader.read(
            os.path.join(FIXTURES, "sample_positions.json"),
            {"rootPath": "$"},
        ))
        assert len(rows) == 4
        assert rows[0]["Account"] == "VGD-500"
        assert rows[0]["CUSIP"] == "922908363"

    def test_count_rows(self):
        reader = JsonReader()
        count = reader.count_rows(
            os.path.join(FIXTURES, "sample_positions.json"),
            {"rootPath": "$"},
        )
        assert count == 4

    def test_infer_schema(self):
        reader = JsonReader()
        fields = reader.infer_schema(
            os.path.join(FIXTURES, "sample_positions.json"),
            {"rootPath": "$"},
        )
        names = [f["name"] for f in fields]
        assert "Account" in names
        assert "CUSIP" in names


class TestExcelReader:
    def test_read_excel(self):
        reader = ExcelReader()
        rows = list(reader.read(
            os.path.join(FIXTURES, "sample_positions.xlsx"),
            {"sheetName": "Positions", "hasHeader": True, "headerRow": 0, "dataStartRow": 1},
        ))
        assert len(rows) == 3
        assert rows[0]["Account"] == "VGD-500"

    def test_count_rows(self):
        reader = ExcelReader()
        count = reader.count_rows(
            os.path.join(FIXTURES, "sample_positions.xlsx"),
            {"sheetName": "Positions"},
        )
        assert count == 3

    def test_infer_schema(self):
        reader = ExcelReader()
        fields = reader.infer_schema(
            os.path.join(FIXTURES, "sample_positions.xlsx"),
            {"sheetName": "Positions"},
        )
        names = [f["name"] for f in fields]
        assert "Account" in names


class TestReaderFactory:
    def test_get_csv_reader(self):
        reader = get_reader("CSV")
        assert isinstance(reader, CsvReader)

    def test_get_json_reader(self):
        reader = get_reader("JSON")
        assert isinstance(reader, JsonReader)

    def test_get_excel_reader(self):
        reader = get_reader("EXCEL")
        assert isinstance(reader, ExcelReader)

    def test_get_unsupported(self):
        with pytest.raises(ValueError, match="Unsupported"):
            get_reader("PARQUET")
