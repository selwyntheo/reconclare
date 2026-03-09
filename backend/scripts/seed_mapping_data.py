"""
Seed script for mapping definitions and lookup tables.
Creates sample State Street NAV and Northern Trust Position mappings.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from pymongo import MongoClient
from config.settings import settings


def seed_mapping_data():
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]

    # ── Sample Mapping: State Street NAV CSV → dataNav JSON ───────

    stt_nav_mapping = {
        "mappingId": "map_stt_nav_csv",
        "version": "1.0.0",
        "name": "State Street NAV CSV to Canonical dataNav",
        "description": "Maps State Street daily NAV extract (CSV) to RECON-AI canonical dataNav JSON format",
        "createdBy": "seed-script",
        "reviewedBy": "admin@reconai.com",
        "status": "APPROVED",
        "tags": ["state-street", "nav", "csv-to-json", "seed"],
        "source": {
            "format": "CSV",
            "encoding": "UTF-8",
            "options": {
                "delimiter": ",",
                "quoteChar": "\"",
                "hasHeader": True,
                "skipRows": 0,
                "nullValues": ["", "N/A", "NULL"],
                "dateFormats": ["MM/dd/yyyy", "yyyy-MM-dd"],
                "trimValues": True,
            },
            "schema": [
                {"name": "Fund_ID", "type": "STRING"},
                {"name": "Val_Date", "type": "STRING"},
                {"name": "Net_Assets", "type": "STRING"},
                {"name": "Shares_Outstanding", "type": "STRING"},
                {"name": "NAV_Per_Share", "type": "STRING"},
                {"name": "Currency", "type": "STRING"},
                {"name": "Share_Class", "type": "STRING"},
            ],
        },
        "target": {
            "format": "JSON",
            "encoding": "UTF-8",
            "options": {"prettyPrint": True, "arrayWrapper": True},
            "schema": [
                {"name": "account", "type": "STRING", "required": True},
                {"name": "valuationDate", "type": "STRING", "required": True},
                {"name": "totalNetAssets", "type": "DECIMAL", "required": True},
                {"name": "sharesOutstanding", "type": "DECIMAL", "required": True},
                {"name": "navPerShare", "type": "DECIMAL", "required": True},
                {"name": "currency", "type": "STRING", "required": False},
                {"name": "shareClass", "type": "STRING", "required": False},
            ],
        },
        "fieldMappings": [
            {
                "targetField": "account",
                "cel": "src.Fund_ID",
                "description": "Direct mapping of fund ID",
            },
            {
                "targetField": "valuationDate",
                "cel": "src.Val_Date",
                "description": "Date string passthrough (format: MM/dd/yyyy)",
            },
            {
                "targetField": "totalNetAssets",
                "cel": "parseDecimal(src.Net_Assets)",
                "description": "Parse formatted number to decimal",
            },
            {
                "targetField": "sharesOutstanding",
                "cel": "parseDecimal(src.Shares_Outstanding)",
                "description": "Parse formatted number to decimal",
            },
            {
                "targetField": "navPerShare",
                "cel": "parseDecimal(src.NAV_Per_Share)",
                "description": "Parse NAV per share to decimal",
            },
            {
                "targetField": "currency",
                "cel": "has(src.Currency) && src.Currency != '' ? src.Currency : 'USD'",
                "description": "Default to USD if currency absent",
            },
            {
                "targetField": "shareClass",
                "cel": "has(src.Share_Class) ? src.Share_Class : 'DEFAULT'",
                "description": "Share class with default fallback",
            },
        ],
        "filters": [
            {
                "cel": "src.Fund_ID != '' && src.Net_Assets != 'N/A'",
                "description": "Skip empty or placeholder rows",
            }
        ],
        "errorHandling": {
            "onFieldError": "USE_DEFAULT",
            "onRowError": "SKIP_AND_LOG",
            "maxErrorCount": 1000,
            "defaults": {"currency": "USD", "shareClass": "DEFAULT"},
        },
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "approvedAt": datetime.now(timezone.utc),
    }

    # ── Sample Mapping: Northern Trust Position Excel → dataSubLedgerPosition ──

    nt_position_mapping = {
        "mappingId": "map_nt_pos_xlsx",
        "version": "1.0.0",
        "name": "Northern Trust Position Excel to Canonical dataSubLedgerPosition",
        "description": "Maps Northern Trust daily position file (XLSX) to RECON-AI position format",
        "createdBy": "seed-script",
        "reviewedBy": None,
        "status": "DRAFT",
        "tags": ["northern-trust", "position", "excel-to-json", "seed"],
        "source": {
            "format": "EXCEL",
            "encoding": "UTF-8",
            "options": {
                "sheetName": "Positions",
                "hasHeader": True,
                "headerRow": 0,
                "dataStartRow": 1,
            },
            "schema": [
                {"name": "Account", "type": "STRING"},
                {"name": "CUSIP", "type": "STRING"},
                {"name": "Security_Name", "type": "STRING"},
                {"name": "Quantity", "type": "STRING"},
                {"name": "Market_Value", "type": "STRING"},
                {"name": "Book_Value", "type": "STRING"},
                {"name": "Price", "type": "STRING"},
                {"name": "Val_Date", "type": "STRING"},
            ],
        },
        "target": {
            "format": "JSON",
            "encoding": "UTF-8",
            "options": {"prettyPrint": True, "arrayWrapper": True},
            "schema": [
                {"name": "account", "type": "STRING", "required": True},
                {"name": "cusip", "type": "STRING", "required": True},
                {"name": "securityName", "type": "STRING"},
                {"name": "posQuantity", "type": "DECIMAL", "required": True},
                {"name": "posMarketValueBase", "type": "DECIMAL", "required": True},
                {"name": "posBookValueBase", "type": "DECIMAL"},
                {"name": "posPrice", "type": "DECIMAL"},
                {"name": "valuationDate", "type": "STRING", "required": True},
                {"name": "unrealizedGainLoss", "type": "DECIMAL"},
            ],
        },
        "fieldMappings": [
            {"targetField": "account", "cel": "src.Account", "description": "Account ID"},
            {"targetField": "cusip", "cel": "src.CUSIP", "description": "Security CUSIP"},
            {"targetField": "securityName", "cel": "src.Security_Name", "description": "Security name"},
            {"targetField": "posQuantity", "cel": "parseDecimal(src.Quantity)", "description": "Position quantity"},
            {"targetField": "posMarketValueBase", "cel": "parseDecimal(src.Market_Value)", "description": "Market value"},
            {"targetField": "posBookValueBase", "cel": "parseDecimal(src.Book_Value)", "description": "Book value"},
            {"targetField": "posPrice", "cel": "parseDecimal(src.Price)", "description": "Security price"},
            {"targetField": "valuationDate", "cel": "src.Val_Date", "description": "Valuation date"},
            {
                "targetField": "unrealizedGainLoss",
                "cel": "parseDecimal(src.Market_Value) - parseDecimal(src.Book_Value)",
                "description": "Computed unrealized gain/loss",
            },
        ],
        "filters": [
            {"cel": "src.Account != '' && src.CUSIP != ''", "description": "Skip rows without account/CUSIP"}
        ],
        "errorHandling": {
            "onFieldError": "USE_DEFAULT",
            "onRowError": "SKIP_AND_LOG",
            "maxErrorCount": 500,
            "defaults": {},
        },
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # ── Sample Mapping: Trade CSV → Canonical dataTrade JSON ─────

    trade_csv_mapping = {
        "mappingId": "map_trade_csv_json",
        "version": "1.0.0",
        "name": "Trade CSV to Canonical dataTrade JSON",
        "description": "Maps BNY Mellon-style trade extract (CSV) to RECON-AI canonical trade JSON format. "
                       "Demonstrates buy/sell sign flipping, broker code lookup, commission calculation, and date reformatting.",
        "createdBy": "seed-script",
        "reviewedBy": "admin@reconai.com",
        "status": "APPROVED",
        "tags": ["bny-mellon", "trade", "csv-to-json", "seed"],
        "source": {
            "format": "CSV",
            "encoding": "UTF-8",
            "options": {
                "delimiter": ",",
                "quoteChar": "\"",
                "hasHeader": True,
                "skipRows": 0,
                "nullValues": ["", "N/A", "NULL"],
                "dateFormats": ["MM/dd/yyyy"],
                "trimValues": True,
            },
            "schema": [
                {"name": "Trade_Ref", "type": "STRING"},
                {"name": "Trade_Date", "type": "STRING"},
                {"name": "Settle_Date", "type": "STRING"},
                {"name": "Account_ID", "type": "STRING"},
                {"name": "CUSIP", "type": "STRING"},
                {"name": "Ticker", "type": "STRING"},
                {"name": "Security_Desc", "type": "STRING"},
                {"name": "Buy_Sell", "type": "STRING"},
                {"name": "Quantity", "type": "STRING"},
                {"name": "Price", "type": "STRING"},
                {"name": "Gross_Amount", "type": "STRING"},
                {"name": "Commission", "type": "STRING"},
                {"name": "Net_Amount", "type": "STRING"},
                {"name": "Currency", "type": "STRING"},
                {"name": "Broker", "type": "STRING"},
                {"name": "Status", "type": "STRING"},
            ],
        },
        "target": {
            "format": "JSON",
            "encoding": "UTF-8",
            "options": {"prettyPrint": True, "arrayWrapper": True},
            "schema": [
                {"name": "tradeReference", "type": "STRING", "required": True},
                {"name": "tradeDate", "type": "STRING", "required": True},
                {"name": "settlementDate", "type": "STRING", "required": True},
                {"name": "account", "type": "STRING", "required": True},
                {"name": "cusip", "type": "STRING", "required": True},
                {"name": "ticker", "type": "STRING"},
                {"name": "securityDescription", "type": "STRING"},
                {"name": "side", "type": "STRING", "required": True},
                {"name": "quantity", "type": "DECIMAL", "required": True},
                {"name": "price", "type": "DECIMAL", "required": True},
                {"name": "grossAmount", "type": "DECIMAL", "required": True},
                {"name": "commission", "type": "DECIMAL"},
                {"name": "netAmount", "type": "DECIMAL", "required": True},
                {"name": "currency", "type": "STRING"},
                {"name": "brokerCode", "type": "STRING"},
                {"name": "brokerName", "type": "STRING"},
                {"name": "tradeStatus", "type": "STRING"},
                {"name": "signedQuantity", "type": "DECIMAL", "description": "Negative for sells"},
            ],
        },
        "fieldMappings": [
            {
                "targetField": "tradeReference",
                "cel": "src.Trade_Ref",
                "description": "Direct mapping of trade reference ID",
            },
            {
                "targetField": "tradeDate",
                "cel": "src.Trade_Date",
                "description": "Trade date passthrough (MM/dd/yyyy)",
            },
            {
                "targetField": "settlementDate",
                "cel": "src.Settle_Date",
                "description": "Settlement date passthrough",
            },
            {
                "targetField": "account",
                "cel": "src.Account_ID",
                "description": "Account identifier",
            },
            {
                "targetField": "cusip",
                "cel": "src.CUSIP",
                "description": "Security CUSIP identifier",
            },
            {
                "targetField": "ticker",
                "cel": "src.Ticker",
                "description": "Ticker symbol",
            },
            {
                "targetField": "securityDescription",
                "cel": "src.Security_Desc",
                "description": "Security name/description",
            },
            {
                "targetField": "side",
                "cel": "src.Buy_Sell == 'BUY' ? 'B' : 'S'",
                "description": "Convert BUY/SELL to B/S code",
            },
            {
                "targetField": "quantity",
                "cel": "parseDecimal(src.Quantity)",
                "description": "Parse unsigned quantity",
            },
            {
                "targetField": "price",
                "cel": "parseDecimal(src.Price)",
                "description": "Parse trade price",
            },
            {
                "targetField": "grossAmount",
                "cel": "parseDecimal(src.Gross_Amount)",
                "description": "Parse gross trade amount",
            },
            {
                "targetField": "commission",
                "cel": "parseDecimal(src.Commission)",
                "description": "Parse commission amount",
            },
            {
                "targetField": "netAmount",
                "cel": "parseDecimal(src.Net_Amount)",
                "description": "Parse net amount (gross +/- commission)",
            },
            {
                "targetField": "currency",
                "cel": "has(src.Currency) && src.Currency != '' ? src.Currency : 'USD'",
                "description": "Currency with USD default",
            },
            {
                "targetField": "brokerCode",
                "cel": "lookupOrDefault(lookups, 'xrefBrokerCode', src.Broker, 'eagleBrokerCode', src.Broker)",
                "description": "Cross-reference broker code via lookup table, fallback to source code",
            },
            {
                "targetField": "brokerName",
                "cel": "lookupOrDefault(lookups, 'xrefBrokerCode', src.Broker, 'brokerName', '')",
                "description": "Resolve broker name from lookup table",
            },
            {
                "targetField": "tradeStatus",
                "cel": "src.Status",
                "description": "Trade status passthrough",
            },
            {
                "targetField": "signedQuantity",
                "cel": "src.Buy_Sell == 'SELL' ? parseDecimal(src.Quantity) * -1.0 : parseDecimal(src.Quantity)",
                "description": "Signed quantity: negative for sells, positive for buys",
            },
        ],
        "filters": [
            {
                "cel": "src.Trade_Ref != '' && src.Status != 'CANCELLED'",
                "description": "Skip blank rows and cancelled trades",
            },
        ],
        "errorHandling": {
            "onFieldError": "USE_DEFAULT",
            "onRowError": "SKIP_AND_LOG",
            "maxErrorCount": 1000,
            "defaults": {"currency": "USD", "brokerCode": "UNKNOWN", "brokerName": ""},
        },
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "approvedAt": datetime.now(timezone.utc),
    }

    # ── Sample Mapping: Cash Flow JSON → Canonical dataIncome JSON ─

    cashflow_json_mapping = {
        "mappingId": "map_cashflow_json_json",
        "version": "1.0.0",
        "name": "Cash Flow JSON to Canonical dataIncome JSON",
        "description": "Maps custodian cash flow records (JSON) to RECON-AI canonical income JSON format. "
                       "Demonstrates JSON-to-JSON transformation with conditional logic, computed fields, and null handling.",
        "createdBy": "seed-script",
        "reviewedBy": None,
        "status": "VALIDATED",
        "tags": ["multi-custodian", "income", "json-to-json", "seed"],
        "source": {
            "format": "JSON",
            "encoding": "UTF-8",
            "options": {},
            "schema": [
                {"name": "ref", "type": "STRING"},
                {"name": "account_id", "type": "STRING"},
                {"name": "flow_type", "type": "STRING"},
                {"name": "security_cusip", "type": "STRING"},
                {"name": "security_name", "type": "STRING"},
                {"name": "ex_date", "type": "STRING"},
                {"name": "pay_date", "type": "STRING"},
                {"name": "gross_amount", "type": "DOUBLE"},
                {"name": "tax_withheld", "type": "DOUBLE"},
                {"name": "net_amount", "type": "DOUBLE"},
                {"name": "currency", "type": "STRING"},
                {"name": "fx_rate", "type": "DOUBLE"},
                {"name": "local_amount", "type": "DOUBLE"},
                {"name": "shares_held", "type": "INT"},
                {"name": "rate_per_share", "type": "DOUBLE"},
                {"name": "status", "type": "STRING"},
                {"name": "custodian", "type": "STRING"},
            ],
        },
        "target": {
            "format": "JSON",
            "encoding": "UTF-8",
            "options": {"prettyPrint": True, "arrayWrapper": True},
            "schema": [
                {"name": "incomeReference", "type": "STRING", "required": True},
                {"name": "account", "type": "STRING", "required": True},
                {"name": "incomeType", "type": "STRING", "required": True},
                {"name": "cusip", "type": "STRING", "required": True},
                {"name": "securityName", "type": "STRING"},
                {"name": "exDate", "type": "STRING"},
                {"name": "payDate", "type": "STRING", "required": True},
                {"name": "grossIncome", "type": "DECIMAL", "required": True},
                {"name": "withholdingTax", "type": "DECIMAL"},
                {"name": "netIncome", "type": "DECIMAL", "required": True},
                {"name": "currency", "type": "STRING"},
                {"name": "fxRate", "type": "DECIMAL"},
                {"name": "localCurrencyAmount", "type": "DECIMAL"},
                {"name": "sharesHeld", "type": "INT"},
                {"name": "ratePerShare", "type": "DECIMAL"},
                {"name": "taxRate", "type": "DECIMAL", "description": "Computed: tax_withheld / gross_amount"},
                {"name": "incomeStatus", "type": "STRING"},
                {"name": "sourceSystem", "type": "STRING"},
                {"name": "isAccrued", "type": "BOOL", "description": "true if status is ACCRUED"},
            ],
        },
        "fieldMappings": [
            {
                "targetField": "incomeReference",
                "cel": "src.ref",
                "description": "Cash flow reference ID",
            },
            {
                "targetField": "account",
                "cel": "src.account_id",
                "description": "Account identifier",
            },
            {
                "targetField": "incomeType",
                "cel": "src.flow_type == 'DIVIDEND' ? 'DIV' : src.flow_type == 'INTEREST' ? 'INT' : src.flow_type",
                "description": "Map flow type to canonical income type code (DIV/INT)",
            },
            {
                "targetField": "cusip",
                "cel": "src.security_cusip",
                "description": "Security CUSIP",
            },
            {
                "targetField": "securityName",
                "cel": "src.security_name",
                "description": "Security name passthrough",
            },
            {
                "targetField": "exDate",
                "cel": "has(src.ex_date) && src.ex_date != '' ? src.ex_date : ''",
                "description": "Ex-dividend date (empty for interest payments)",
            },
            {
                "targetField": "payDate",
                "cel": "src.pay_date",
                "description": "Payment date",
            },
            {
                "targetField": "grossIncome",
                "cel": "src.gross_amount",
                "description": "Gross income amount (already numeric in JSON source)",
            },
            {
                "targetField": "withholdingTax",
                "cel": "src.tax_withheld",
                "description": "Tax withheld amount",
            },
            {
                "targetField": "netIncome",
                "cel": "src.net_amount",
                "description": "Net income after tax",
            },
            {
                "targetField": "currency",
                "cel": "src.currency",
                "description": "Currency code",
            },
            {
                "targetField": "fxRate",
                "cel": "src.fx_rate",
                "description": "FX rate to base currency",
            },
            {
                "targetField": "localCurrencyAmount",
                "cel": "src.local_amount",
                "description": "Amount in local currency",
            },
            {
                "targetField": "sharesHeld",
                "cel": "src.shares_held",
                "description": "Number of shares held at ex-date",
            },
            {
                "targetField": "ratePerShare",
                "cel": "src.rate_per_share",
                "description": "Income rate per share",
            },
            {
                "targetField": "taxRate",
                "cel": "src.gross_amount > 0 ? src.tax_withheld / src.gross_amount : 0.0",
                "description": "Computed withholding tax rate as a fraction",
            },
            {
                "targetField": "incomeStatus",
                "cel": "src.status",
                "description": "Payment status (PAID / ACCRUED)",
            },
            {
                "targetField": "sourceSystem",
                "cel": "src.custodian",
                "description": "Source custodian system identifier",
            },
            {
                "targetField": "isAccrued",
                "cel": "src.status == 'ACCRUED'",
                "description": "Boolean flag: true if income is accrued (not yet paid)",
            },
        ],
        "filters": [
            {
                "cel": "src.ref != '' && src.account_id != ''",
                "description": "Skip rows without reference or account",
            },
        ],
        "errorHandling": {
            "onFieldError": "SKIP_AND_LOG",
            "onRowError": "SKIP_AND_LOG",
            "maxErrorCount": 500,
            "defaults": {},
        },
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    # ── Sample Lookup Tables ──────────────────────────────────────

    xref_account = {
        "tableId": "lkp_xref_account",
        "name": "xrefAccount",
        "description": "Account cross-reference mapping between incumbent and Eagle",
        "keyField": "accountId",
        "data": [
            {"accountId": "ACC001", "eagleActBasis": "TRADE", "eagleSource": "STT", "chartOfAccounts": "US_GAAP"},
            {"accountId": "ACC002", "eagleActBasis": "SETTLE", "eagleSource": "STT", "chartOfAccounts": "US_GAAP"},
            {"accountId": "ACC003", "eagleActBasis": "TRADE", "eagleSource": "NT", "chartOfAccounts": "IFRS"},
            {"accountId": "VGD-500", "eagleActBasis": "TRADE", "eagleSource": "VGD", "chartOfAccounts": "US_GAAP"},
            {"accountId": "FID-CONTRA", "eagleActBasis": "TRADE", "eagleSource": "FID", "chartOfAccounts": "US_GAAP"},
        ],
        "rowCount": 5,
        "uploadedAt": datetime.now(timezone.utc),
        "uploadedBy": "seed-script",
    }

    xref_broker = {
        "tableId": "lkp_xref_broker",
        "name": "xrefBrokerCode",
        "description": "Broker code cross-reference",
        "keyField": "brokerCode",
        "data": [
            {"brokerCode": "GS", "eagleBrokerCode": "GSCO", "brokerName": "Goldman Sachs"},
            {"brokerCode": "MS", "eagleBrokerCode": "MORG", "brokerName": "Morgan Stanley"},
            {"brokerCode": "JPM", "eagleBrokerCode": "JPMC", "brokerName": "JP Morgan"},
            {"brokerCode": "BARC", "eagleBrokerCode": "BARC", "brokerName": "Barclays"},
        ],
        "rowCount": 4,
        "uploadedAt": datetime.now(timezone.utc),
        "uploadedBy": "seed-script",
    }

    # ── Insert into MongoDB ───────────────────────────────────────

    mappings_col = db["mappingDefinitions"]
    lookups_col = db["lookupTables"]

    # Clear existing seed data
    mappings_col.delete_many({"tags": "seed"})
    lookups_col.delete_many({"uploadedBy": "seed-script"})

    mappings_col.insert_one(stt_nav_mapping)
    mappings_col.insert_one(nt_position_mapping)
    mappings_col.insert_one(trade_csv_mapping)
    mappings_col.insert_one(cashflow_json_mapping)
    print(f"Inserted 4 mapping definitions")

    lookups_col.insert_one(xref_account)
    lookups_col.insert_one(xref_broker)
    print(f"Inserted 2 lookup tables")

    client.close()
    print("Mapping seed data complete.")


if __name__ == "__main__":
    seed_mapping_data()
