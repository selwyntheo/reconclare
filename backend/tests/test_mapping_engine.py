"""
Unit tests for mapping engine: end-to-end pipeline, filtering, error strategies.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import tempfile
import pytest
from services.mapping.engine import MappingEngine
from services.mapping.schemas import (
    MappingDefinition, SourceConfig, TargetConfig, SourceOptions, TargetOptions,
    FieldMapping, FilterExpression, ErrorHandling, ErrorStrategy,
    FieldSchema, FileFormat, JobStatus,
)

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures", "mapping")


def _make_mapping(field_mappings, filters=None, error_handling=None,
                  source_format="CSV", target_format="JSON"):
    return MappingDefinition(
        mappingId="test_map",
        name="Test Mapping",
        source=SourceConfig(
            format=FileFormat(source_format),
            options=SourceOptions(
                delimiter=",", hasHeader=True,
                nullValues=["", "N/A", "NULL"], trimValues=True,
            ),
            schema_fields=[],
        ),
        target=TargetConfig(
            format=FileFormat(target_format),
            options=TargetOptions(prettyPrint=False, arrayWrapper=True),
            schema_fields=[],
        ),
        fieldMappings=[FieldMapping(**fm) for fm in field_mappings],
        filters=[FilterExpression(**f) for f in (filters or [])],
        errorHandling=error_handling or ErrorHandling(),
    )


class TestMappingEngineExecution:
    def setup_method(self):
        self.engine = MappingEngine()
        self.output_dir = tempfile.mkdtemp()

    def test_csv_to_json_basic(self):
        mapping = _make_mapping([
            {"targetField": "account", "cel": "src.Fund_ID"},
            {"targetField": "navPerShare", "cel": "parseDecimal(src.NAV_Per_Share)"},
        ])

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_nav.csv"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.COMPLETED
        assert summary.rowsProcessed > 0
        assert summary.outputPath is not None

        with open(summary.outputPath) as f:
            data = json.load(f)
        assert len(data) > 0
        assert data[0]["account"] is not None

    def test_filtering(self):
        mapping = _make_mapping(
            [{"targetField": "account", "cel": "src.Fund_ID"}],
            filters=[{"cel": "src.Fund_ID != '' && src.Net_Assets != 'N/A'"}],
        )

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_nav.csv"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.COMPLETED
        # The empty row and N/A row should be filtered
        assert summary.rowsSkipped >= 1

    def test_with_params(self):
        mapping = _make_mapping([
            {"targetField": "account", "cel": "src.Fund_ID"},
            {"targetField": "date", "cel": "params.reportDate"},
        ])

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_nav.csv"),
            output_dir=self.output_dir,
            params={"reportDate": "2026-03-09"},
        )

        assert summary.status == JobStatus.COMPLETED
        with open(summary.outputPath) as f:
            data = json.load(f)
        assert data[0]["date"] == "2026-03-09"

    def test_json_source(self):
        mapping = _make_mapping(
            [
                {"targetField": "account", "cel": "src.Account"},
                {"targetField": "cusip", "cel": "src.CUSIP"},
            ],
            source_format="JSON",
        )

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_positions.json"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.COMPLETED
        assert summary.rowsProcessed == 4

    def test_compilation_error(self):
        mapping = _make_mapping([
            {"targetField": "bad", "cel": "invalid @@@"},
        ])

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_nav.csv"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.FAILED
        assert summary.errorCount > 0


class TestTradeCsvToJson:
    """End-to-end test: Trade CSV → JSON mapping."""

    def setup_method(self):
        self.engine = MappingEngine()
        self.output_dir = tempfile.mkdtemp()

    def test_trade_csv_full_pipeline(self):
        mapping = _make_mapping(
            [
                {"targetField": "tradeReference", "cel": "src.Trade_Ref"},
                {"targetField": "account", "cel": "src.Account_ID"},
                {"targetField": "cusip", "cel": "src.CUSIP"},
                {"targetField": "ticker", "cel": "src.Ticker"},
                {"targetField": "side", "cel": "src.Buy_Sell == 'BUY' ? 'B' : 'S'"},
                {"targetField": "quantity", "cel": "parseDecimal(src.Quantity)"},
                {"targetField": "price", "cel": "parseDecimal(src.Price)"},
                {"targetField": "grossAmount", "cel": "parseDecimal(src.Gross_Amount)"},
                {"targetField": "commission", "cel": "parseDecimal(src.Commission)"},
                {"targetField": "netAmount", "cel": "parseDecimal(src.Net_Amount)"},
                {"targetField": "currency", "cel": "has(src.Currency) && src.Currency != '' ? src.Currency : 'USD'"},
                {"targetField": "tradeStatus", "cel": "src.Status"},
                {"targetField": "signedQuantity",
                 "cel": "src.Buy_Sell == 'SELL' ? parseDecimal(src.Quantity) * -1.0 : parseDecimal(src.Quantity)"},
            ],
            filters=[{"cel": "src.Trade_Ref != '' && src.Status != 'CANCELLED'"}],
            error_handling=ErrorHandling(
                onFieldError=ErrorStrategy.USE_DEFAULT,
                onRowError=ErrorStrategy.SKIP_AND_LOG,
                maxErrorCount=100,
                defaults={"currency": "USD"},
            ),
        )

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_trades.csv"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.COMPLETED
        # 10 rows total, 1 blank/cancelled row should be filtered
        assert summary.rowsProcessed >= 8
        assert summary.rowsSkipped >= 1

        with open(summary.outputPath) as f:
            data = json.load(f)

        # Verify first trade
        buy_trades = [t for t in data if t.get("side") == "B"]
        sell_trades = [t for t in data if t.get("side") == "S"]
        assert len(buy_trades) > 0
        assert len(sell_trades) > 0

        # Verify signed quantity: sells are negative
        for t in sell_trades:
            assert t["signedQuantity"] < 0
        for t in buy_trades:
            assert t["signedQuantity"] > 0


class TestCashFlowJsonToJson:
    """End-to-end test: Cash Flow JSON → JSON mapping."""

    def setup_method(self):
        self.engine = MappingEngine()
        self.output_dir = tempfile.mkdtemp()

    def test_cashflow_json_full_pipeline(self):
        mapping = _make_mapping(
            [
                {"targetField": "incomeReference", "cel": "src.ref"},
                {"targetField": "account", "cel": "src.account_id"},
                {"targetField": "incomeType",
                 "cel": "src.flow_type == 'DIVIDEND' ? 'DIV' : src.flow_type == 'INTEREST' ? 'INT' : src.flow_type"},
                {"targetField": "cusip", "cel": "src.security_cusip"},
                {"targetField": "securityName", "cel": "src.security_name"},
                {"targetField": "grossIncome", "cel": "src.gross_amount"},
                {"targetField": "withholdingTax", "cel": "src.tax_withheld"},
                {"targetField": "netIncome", "cel": "src.net_amount"},
                {"targetField": "taxRate",
                 "cel": "src.gross_amount > 0 ? src.tax_withheld / src.gross_amount : 0.0"},
                {"targetField": "incomeStatus", "cel": "src.status"},
                {"targetField": "isAccrued", "cel": "src.status == 'ACCRUED'"},
            ],
            filters=[{"cel": "src.ref != '' && src.account_id != ''"}],
            source_format="JSON",
        )

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_cashflows.json"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.COMPLETED
        assert summary.rowsProcessed == 7

        with open(summary.outputPath) as f:
            data = json.load(f)

        assert len(data) == 7

        # Verify income type mapping
        div_rows = [r for r in data if r["incomeType"] == "DIV"]
        int_rows = [r for r in data if r["incomeType"] == "INT"]
        assert len(div_rows) == 5
        assert len(int_rows) == 2

        # Verify tax rate computation for first dividend (Apple: 18750/125000 = 0.15)
        apple = next(r for r in data if r["incomeReference"] == "CF-2026030901")
        assert abs(apple["taxRate"] - 0.15) < 0.001

        # Verify interest has 0 tax rate
        treasury = next(r for r in data if r["incomeReference"] == "CF-2026030902")
        assert treasury["taxRate"] == 0.0

        # Verify isAccrued flag
        accrued = [r for r in data if r["isAccrued"] is True]
        paid = [r for r in data if r["isAccrued"] is False]
        assert len(accrued) == 2
        assert len(paid) == 5


class TestErrorHandlingStrategies:
    def setup_method(self):
        self.engine = MappingEngine()
        self.output_dir = tempfile.mkdtemp()

    def test_skip_and_log(self):
        mapping = _make_mapping(
            [
                {"targetField": "account", "cel": "src.Fund_ID"},
                # This will fail on rows where Net_Assets is None/N/A
                {"targetField": "amount", "cel": "parseDecimal(src.Net_Assets)"},
            ],
            error_handling=ErrorHandling(
                onFieldError=ErrorStrategy.SKIP_AND_LOG,
                onRowError=ErrorStrategy.SKIP_AND_LOG,
                maxErrorCount=100,
            ),
        )

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_nav.csv"),
            output_dir=self.output_dir,
        )

        # Should complete despite errors on some rows
        assert summary.status == JobStatus.COMPLETED

    def test_use_default(self):
        mapping = _make_mapping(
            [
                {"targetField": "account", "cel": "src.Fund_ID"},
                {"targetField": "amount", "cel": "parseDecimal(src.Net_Assets)"},
            ],
            error_handling=ErrorHandling(
                onFieldError=ErrorStrategy.USE_DEFAULT,
                onRowError=ErrorStrategy.SKIP_AND_LOG,
                maxErrorCount=100,
                defaults={"amount": 0.0},
            ),
        )

        summary = self.engine.execute(
            mapping,
            os.path.join(FIXTURES, "sample_nav.csv"),
            output_dir=self.output_dir,
        )

        assert summary.status == JobStatus.COMPLETED


class TestPreview:
    def setup_method(self):
        self.engine = MappingEngine()

    def test_preview_basic(self):
        mapping = _make_mapping([
            {"targetField": "account", "cel": "src.Fund_ID"},
            {"targetField": "nav", "cel": "parseDecimal(src.NAV_Per_Share)"},
        ])

        sample = [
            {"Fund_ID": "VGD-500", "NAV_Per_Share": "27.03"},
            {"Fund_ID": "FID-CONTRA", "NAV_Per_Share": "29.73"},
        ]

        results = self.engine.preview(mapping, sample)
        assert len(results) == 2
        assert results[0]["targetRow"]["account"] == "VGD-500"
        assert abs(results[0]["targetRow"]["nav"] - 27.03) < 0.01

    def test_preview_trade_csv(self):
        """Preview trade CSV mapping with buy/sell sign flipping."""
        mapping = _make_mapping([
            {"targetField": "tradeReference", "cel": "src.Trade_Ref"},
            {"targetField": "side", "cel": "src.Buy_Sell == 'BUY' ? 'B' : 'S'"},
            {"targetField": "quantity", "cel": "parseDecimal(src.Quantity)"},
            {"targetField": "signedQuantity",
             "cel": "src.Buy_Sell == 'SELL' ? parseDecimal(src.Quantity) * -1.0 : parseDecimal(src.Quantity)"},
        ])

        sample = [
            {"Trade_Ref": "TRD-001", "Buy_Sell": "BUY", "Quantity": "10000"},
            {"Trade_Ref": "TRD-002", "Buy_Sell": "SELL", "Quantity": "8000"},
        ]

        results = self.engine.preview(mapping, sample)
        assert len(results) == 2
        assert results[0]["targetRow"]["side"] == "B"
        assert results[0]["targetRow"]["signedQuantity"] == 10000.0
        assert results[1]["targetRow"]["side"] == "S"
        assert results[1]["targetRow"]["signedQuantity"] == -8000.0

    def test_preview_with_filter(self):
        mapping = _make_mapping(
            [{"targetField": "account", "cel": "src.Fund_ID"}],
            filters=[{"cel": "src.Fund_ID != ''"}],
        )

        sample = [
            {"Fund_ID": "VGD-500"},
            {"Fund_ID": ""},
        ]

        results = self.engine.preview(mapping, sample)
        assert results[0]["filtered"] is False
        assert results[1]["filtered"] is True
