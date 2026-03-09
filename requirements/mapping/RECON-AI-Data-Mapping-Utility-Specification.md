# RECON-AI Data Mapping Utility — Technical Specification

**Version:** 1.0  
**Date:** March 2026  
**Author:** RECON-AI Platform Team  
**Status:** Draft

---

## 1. Executive Summary

The RECON-AI Data Mapping Utility is a configurable, CEL-powered data transformation engine that enables users to map any structured file format to any other structured file format. It provides a declarative approach where field-level transformations are expressed as standard Common Expression Language (CEL) expressions — a non-Turing-complete, safe, and auditable expression language already adopted within the RECON-AI platform for reconciliation rule generation.

The utility addresses a critical bottleneck in the fund administration domain: the need to ingest files from dozens of incumbent providers (State Street, Northern Trust, JP Morgan, etc.), each delivering data in bespoke CSV, TSV, fixed-width, JSON, XML, and Excel formats, and normalize them into the RECON-AI canonical data model for reconciliation processing.

By expressing all mappings as CEL, the platform gains a uniform, version-controlled, AI-generable, and human-reviewable transformation layer that can be applied at ingestion time with nanosecond-to-microsecond evaluation performance.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Provide a universal file-to-file mapping engine supporting CSV, TSV, fixed-width text, JSON, XML, YAML, Excel (XLSX/XLS), and Parquet as both source and target formats.
- Express all field-level transformations, type coercions, conditional logic, and derived fields as standard CEL expressions.
- Enable AI agents (Claude) to generate mapping configurations that are safe to execute without code review of imperative logic, leveraging CEL's non-Turing-complete guarantees.
- Support template-based mapping reuse so that common incumbent file layouts can be mapped once and applied across hundreds of similar funds.
- Integrate with the existing RECON-AI canonical data model (`dataDailyTransactions`, `dataSubLedgerPosition`, `dataNav`, `dataLedger`, `refSecurity`, cross-reference tables, etc.).
- Provide a visual mapping interface (React-based) for human review, editing, and approval of AI-generated mappings.
- Deliver batch and streaming execution modes with performance targets of <1 second for files up to 100K rows.

### 2.2 Non-Goals

- General-purpose ETL orchestration (use Airflow, Prefect, or similar for DAG scheduling).
- Database-to-database replication or CDC (Change Data Capture).
- Unstructured document parsing (PDFs, scanned images) — this is handled by the separate Document Intelligence module.
- Complex multi-pass transformations requiring Turing-complete logic — these remain in human-reviewed Lua scripts per the existing CEL + Lua hybrid architecture.

---

## 3. Open Source Landscape and Technology Choices

### 3.1 CEL Runtime Libraries

The following CEL implementations were evaluated for the mapping engine:

| Library | Language | Maintainer | License | Suitability |
|---------|----------|------------|---------|-------------|
| **cel-java (Google)** | Java | Google | Apache 2.0 | Primary choice. Official Google implementation with canonical extensions (string manipulation, math, proto, bindings). Integrates directly with the Spring Boot backend. |
| **cel-java (Project Nessie)** | Java | Dremio/Nessie | Apache 2.0 | Alternative. Port of cel-go, supports Jackson integration for POJO-based evaluation via `Jackson3Registry`. Custom function registration via `Library` interface. |
| **cel-go** | Go | Google | Apache 2.0 | Reference implementation. Not directly usable in JVM stack but serves as the specification baseline. |
| **cel-python** | Python | Community | Apache 2.0 | Wraps Rust `cel-interpreter`. Useful for AI agent-side expression validation and testing before committing to the mapping configuration. Microsecond-level evaluation. |

**Decision:** Use **Google's cel-java** as the primary runtime within the Spring Boot mapping service, with **Project Nessie's cel-java** as a fallback option if Jackson-native POJO evaluation proves more ergonomic for the canonical data model. Use **cel-python** in the AI agent pipeline for pre-validation of generated expressions.

### 3.2 File Format Libraries

| Format | Library | Notes |
|--------|---------|-------|
| CSV/TSV | **Apache Commons CSV** | Industry standard for Java CSV handling. Supports RFC 4180, Excel, TDF dialects. Handles quoted fields, embedded commas, multi-line values. |
| JSON | **Jackson Databind + Streaming** | Core JSON processing. `ObjectMapper` for tree/POJO binding, streaming API for large files. Also provides `jackson-dataformat-csv` for unified CSV/JSON handling under the same API. |
| XML | **Jackson XML (`jackson-dataformat-xml`)** | Unified Jackson API across JSON and XML. Also consider **JAXB** for schema-driven XML with XSD validation. |
| YAML | **Jackson YAML (`jackson-dataformat-yaml`)** | YAML support through the Jackson ecosystem for configuration files and some data interchange. |
| Excel | **Apache POI** | HSSF (XLS) and XSSF (XLSX) support. Streaming SXSSF writer for large files. `poi-ooxml` for modern XLSX. |
| Parquet | **Apache Parquet (parquet-mr)** | Columnar format for high-performance analytics. Integrates with Hadoop ecosystem but usable standalone. |
| Fixed-Width | **Custom parser** | No dominant library; implement using configurable column position definitions (start, length, padding). |

### 3.3 JSON-to-JSON Transformation Reference

| Tool | Approach | Relevance |
|------|----------|-----------|
| **JOLT** (Bazaarvoice) | Declarative JSON-to-JSON transform with a JSON-based DSL (shift, default, remove, sort, cardinality). Open source, Java, Apache 2.0. | Inspiration for the structural mapping layer. JOLT handles structure reshaping but not value computation — CEL fills that gap. |
| **jq** | Command-line JSON processor. | Excellent for ad-hoc transformations but not embeddable in JVM services. |
| **JsonPath** | XPath-like JSON navigation. | Useful for source field addressing within the mapping DSL but not a complete transformation engine. |

### 3.4 Rationale: Why CEL Over Alternatives

Several expression and scripting languages were considered for the mapping layer:

- **JavaScript/Lua:** Turing-complete, require sandboxing, non-deterministic execution time. The existing RECON-AI architecture already reserves Lua for complex derived sub-ledger calculations that require loops and mutable state — the mapping layer should be simpler and safer.
- **JOLT DSL:** Powerful for structural transformations but has no computation model (cannot do arithmetic, date parsing, conditional coercion). Works well for JSON-to-JSON but cannot handle CSV/XML source addressing.
- **SpEL (Spring Expression Language):** Tightly coupled to Spring, allows method invocation on arbitrary Java objects (security risk for AI-generated expressions), not portable outside JVM.
- **JSONata:** Elegant for JSON transformations but limited ecosystem, no Java-native implementation, not designed for non-JSON inputs.
- **CEL:** Non-Turing-complete by design, linear evaluation time, safe for AI-generated code, portable across Go/Java/Python/Rust, rich type system with strings/numbers/lists/maps/timestamps/durations, extensible with custom functions, and already adopted in the RECON-AI platform.

---

## 4. Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mapping Configuration                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ Source    │  │ Mapping      │  │ Target             │    │
│  │ Schema   │  │ Rules (CEL)  │  │ Schema             │    │
│  └──────────┘  └──────────────┘  └────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Mapping Engine Service                      │
│                                                               │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐     │
│  │ Source    │──▶│ Row-Level    │──▶│ Target          │     │
│  │ Reader   │   │ CEL Evaluator│   │ Writer          │     │
│  │          │   │              │   │                 │     │
│  │ CSV      │   │ • Parse CEL  │   │ CSV             │     │
│  │ JSON     │   │ • Compile AST│   │ JSON            │     │
│  │ XML      │   │ • Evaluate   │   │ XML             │     │
│  │ Excel    │   │ • Type coerce│   │ Excel           │     │
│  │ Fixed    │   │              │   │ Fixed           │     │
│  │ Parquet  │   │              │   │ Parquet         │     │
│  └──────────┘   └──────────────┘   └─────────────────┘     │
│                        │                                     │
│                        ▼                                     │
│              ┌──────────────────┐                            │
│              │ Validation &     │                            │
│              │ Error Handling   │                            │
│              └──────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Component Breakdown

**Source Reader:** Format-specific parsers that normalize each input row into a `Map<String, Object>` (the CEL evaluation context). Column names become map keys; values are coerced to CEL-compatible types (string, int, double, bool, timestamp, bytes, list, map).

**CEL Evaluator:** Pre-compiled CEL ASTs are evaluated per-row against the source context. Each target field has its own CEL expression. Expressions are compiled once at configuration load time and reused across all rows, following the CEL best practice of compile-once-evaluate-many.

**Target Writer:** Format-specific serializers that take the evaluated output map and write rows/records to the target format.

**Validation Layer:** Pre-execution schema validation (source file matches expected schema), per-row evaluation error capture (with configurable skip/fail/default behavior), and post-execution summary reporting.

### 4.3 Integration Points

- **Document Intelligence Module:** Provides structural extraction from incumbent PDFs/Excel files, producing intermediate JSON or CSV that feeds into the mapping utility.
- **ReconClare Matching Engine:** Consumes the canonically mapped output for reconciliation rule evaluation.
- **RECON-AI Control Center:** Displays mapping execution status, error summaries, and allows drill-down into row-level failures.
- **AI Agent Pipeline:** Claude generates CEL mapping expressions from sample data and target schema definitions; the utility validates and executes them.

---

## 5. Mapping Configuration Data Model

### 5.1 MappingDefinition (Top-Level)

```json
{
  "mappingId": "map_001_stt_nav_to_canonical",
  "version": "1.0.0",
  "name": "State Street NAV File to Canonical dataNav",
  "description": "Maps State Street daily NAV extract (CSV) to RECON-AI canonical dataNav format",
  "createdBy": "ai-agent-claude",
  "reviewedBy": "john.doe@bny.com",
  "status": "APPROVED",
  "tags": ["state-street", "nav", "csv-to-json"],
  
  "source": {
    "format": "CSV",
    "encoding": "UTF-8",
    "options": {
      "delimiter": ",",
      "quoteChar": "\"",
      "hasHeader": true,
      "skipRows": 0,
      "dateFormats": ["MM/dd/yyyy", "yyyy-MM-dd"],
      "nullValues": ["", "N/A", "NULL"]
    },
    "schema": {
      "fields": [
        { "name": "Fund_ID", "type": "STRING" },
        { "name": "Val_Date", "type": "STRING" },
        { "name": "Net_Assets", "type": "STRING" },
        { "name": "Shares_Outstanding", "type": "STRING" },
        { "name": "NAV_Per_Share", "type": "STRING" }
      ]
    }
  },

  "target": {
    "format": "JSON",
    "encoding": "UTF-8",
    "options": {
      "prettyPrint": false,
      "arrayWrapper": true
    },
    "schema": {
      "fields": [
        { "name": "account", "type": "STRING", "required": true },
        { "name": "valuationDate", "type": "DATE", "required": true },
        { "name": "totalNetAssets", "type": "DECIMAL", "required": true },
        { "name": "sharesOutstanding", "type": "DECIMAL", "required": true },
        { "name": "navPerShare", "type": "DECIMAL", "required": true },
        { "name": "currency", "type": "STRING", "required": false }
      ]
    }
  },

  "fieldMappings": [
    {
      "targetField": "account",
      "cel": "src.Fund_ID.trim()",
      "description": "Direct mapping with whitespace cleanup"
    },
    {
      "targetField": "valuationDate",
      "cel": "parseDate(src.Val_Date, 'MM/dd/yyyy')",
      "description": "Parse State Street date format to ISO date"
    },
    {
      "targetField": "totalNetAssets",
      "cel": "parseDecimal(src.Net_Assets.replace(',', ''))",
      "description": "Strip comma formatting and parse to decimal"
    },
    {
      "targetField": "sharesOutstanding",
      "cel": "parseDecimal(src.Shares_Outstanding.replace(',', ''))",
      "description": "Strip comma formatting and parse to decimal"
    },
    {
      "targetField": "navPerShare",
      "cel": "parseDecimal(src.NAV_Per_Share)",
      "description": "Parse NAV per share to decimal"
    },
    {
      "targetField": "currency",
      "cel": "has(src.Currency) ? src.Currency : 'USD'",
      "description": "Default to USD if currency column is absent"
    }
  ],

  "filters": [
    {
      "cel": "src.Fund_ID != '' && src.Net_Assets != 'N/A'",
      "description": "Skip empty or placeholder rows"
    }
  ],

  "errorHandling": {
    "onFieldError": "USE_DEFAULT",
    "onRowError": "SKIP_AND_LOG",
    "maxErrorCount": 1000,
    "defaults": {
      "currency": "USD"
    }
  }
}
```

### 5.2 Field Type Enumeration

| Type | CEL Type | Java Type | Description |
|------|----------|-----------|-------------|
| `STRING` | `string` | `String` | Text value |
| `INT` | `int` | `Long` | 64-bit signed integer |
| `DOUBLE` | `double` | `Double` | 64-bit floating point |
| `DECIMAL` | `string` (custom) | `BigDecimal` | Arbitrary-precision decimal for financial values |
| `BOOL` | `bool` | `Boolean` | Boolean flag |
| `DATE` | `timestamp` | `LocalDate` | Calendar date (no time) |
| `DATETIME` | `timestamp` | `LocalDateTime` | Date with time |
| `TIMESTAMP` | `timestamp` | `Instant` | UTC instant |
| `LIST` | `list` | `List<Object>` | Ordered collection |
| `MAP` | `map` | `Map<String, Object>` | Key-value pairs |

### 5.3 Supported Format Options

#### CSV/TSV Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `string` | `,` | Field separator character |
| `quoteChar` | `string` | `"` | Quote character for enclosed fields |
| `escapeChar` | `string` | `\` | Escape character |
| `hasHeader` | `bool` | `true` | Whether first row contains column names |
| `skipRows` | `int` | `0` | Number of leading rows to skip before header |
| `commentChar` | `string` | (none) | Line comment prefix |
| `nullValues` | `list<string>` | `[""]` | Strings treated as null |
| `dateFormats` | `list<string>` | `["yyyy-MM-dd"]` | Date parse patterns (tried in order) |
| `trimValues` | `bool` | `true` | Trim whitespace from values |
| `encoding` | `string` | `UTF-8` | File character encoding |

#### Fixed-Width Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `columns` | `list<ColumnDef>` | (required) | Column definitions: `{ name, start, length, padding }` |
| `skipRows` | `int` | `0` | Header/preamble rows to skip |
| `recordLength` | `int` | (auto) | Expected record length for validation |

#### JSON Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rootPath` | `string` | `$` | JSONPath to the array of records |
| `prettyPrint` | `bool` | `false` | Format output with indentation |
| `arrayWrapper` | `bool` | `true` | Wrap output records in a JSON array |

#### XML Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rootElement` | `string` | (required) | Root element tag name |
| `recordElement` | `string` | (required) | Repeating record element tag name |
| `namespaces` | `map<string,string>` | `{}` | Namespace prefix-to-URI bindings |
| `attributePrefix` | `string` | `@` | Prefix for attribute access in field paths |

#### Excel Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sheetName` | `string` | (first sheet) | Target sheet name |
| `sheetIndex` | `int` | `0` | Target sheet by zero-based index |
| `hasHeader` | `bool` | `true` | Whether first row contains column names |
| `headerRow` | `int` | `0` | Row index of header (if not row 0) |
| `dataStartRow` | `int` | `1` | Row where data begins |
| `dateFormats` | `list<string>` | `["yyyy-MM-dd"]` | Date parse patterns |

---

## 6. CEL Expression Environment

### 6.1 Evaluation Context Variables

Every CEL expression in the mapping configuration has access to the following variables:

| Variable | Type | Description |
|----------|------|-------------|
| `src` | `map<string, dyn>` | The current source row as a string-keyed map. Access fields via `src.fieldName` or `src["field name"]` for names with spaces/special characters. |
| `rowIndex` | `int` | Zero-based index of the current row in the source file. |
| `meta` | `map<string, string>` | Metadata about the source file: `meta.fileName`, `meta.fileDate`, `meta.encoding`, `meta.totalRows` (if known). |
| `params` | `map<string, dyn>` | User-supplied parameters passed at execution time (e.g., `params.valuationDate`, `params.fundFamily`). |
| `lookups` | `map<string, map<string, dyn>>` | Reference data lookup tables loaded at startup (e.g., `lookups.xrefAccount`, `lookups.xrefBrokerCode`). |

### 6.2 Standard CEL Functions

All standard CEL functions are available (see [cel-spec](https://github.com/google/cel-spec)):

- **Arithmetic:** `+`, `-`, `*`, `/`, `%`
- **Comparison:** `==`, `!=`, `<`, `<=`, `>`, `>=`
- **Logical:** `&&`, `||`, `!`
- **String:** `contains`, `startsWith`, `endsWith`, `matches` (regex), `size`, `trim` (extension)
- **List:** `size`, `all`, `exists`, `exists_one`, `filter`, `map`
- **Map:** `size`, `has`
- **Type:** `type`, `int`, `uint`, `double`, `string`, `bool`, `dyn`
- **Conditional:** ternary `condition ? trueVal : falseVal`
- **Null-safe:** `has(src.field)` for field existence checks

### 6.3 Custom Extension Functions

The mapping engine registers the following custom CEL functions to handle financial data transformation patterns:

#### Date/Time Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseDate` | `(string, string) -> timestamp` | Parse date string using given pattern (e.g., `parseDate(src.date, 'MM/dd/yyyy')`) |
| `formatDate` | `(timestamp, string) -> string` | Format timestamp to string pattern |
| `today` | `() -> timestamp` | Current date (UTC) |
| `dateDiff` | `(timestamp, timestamp, string) -> int` | Difference between dates in given unit (`'DAYS'`, `'MONTHS'`, `'YEARS'`) |
| `businessDaysBetween` | `(timestamp, timestamp) -> int` | Count business days between two dates (excluding weekends) |

#### Numeric Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `parseDecimal` | `(string) -> double` | Parse string to decimal, handling commas and parenthetical negatives |
| `round` | `(double, int) -> double` | Round to N decimal places |
| `abs` | `(double) -> double` | Absolute value |
| `toInt` | `(string) -> int` | Parse string to integer |
| `formatNumber` | `(double, string) -> string` | Format number with pattern (e.g., `'#,##0.00'`) |

#### String Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `trim` | `(string) -> string` | Remove leading/trailing whitespace |
| `upper` | `(string) -> string` | Convert to uppercase |
| `lower` | `(string) -> string` | Convert to lowercase |
| `padLeft` | `(string, int, string) -> string` | Left-pad string to length with character |
| `padRight` | `(string, int, string) -> string` | Right-pad string to length with character |
| `substring` | `(string, int, int) -> string` | Extract substring (start, length) |
| `split` | `(string, string) -> list<string>` | Split string by delimiter |
| `join` | `(list<string>, string) -> string` | Join list with delimiter |
| `replace` | `(string, string, string) -> string` | Replace all occurrences |
| `regexExtract` | `(string, string) -> string` | Extract first regex capture group |
| `regexReplace` | `(string, string, string) -> string` | Regex-based replacement |

#### Lookup Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `lookup` | `(string, string, string) -> dyn` | Look up value: `lookup('xrefAccount', src.accountId, 'eagleActBasis')` |
| `lookupOrDefault` | `(string, string, string, dyn) -> dyn` | Look up with fallback default |
| `crossRef` | `(string, string) -> map<string, dyn>` | Get entire cross-reference row |

#### Coercion Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `coalesce` | `(dyn...) -> dyn` | Return first non-null argument |
| `ifEmpty` | `(string, string) -> string` | Return fallback if string is empty |
| `nullIf` | `(dyn, dyn) -> dyn` | Return null if value equals sentinel |
| `toList` | `(dyn) -> list` | Wrap scalar in single-element list |
| `flatten` | `(list<list>) -> list` | Flatten nested lists |

### 6.4 Expression Validation Rules

Before a mapping configuration is accepted, all CEL expressions are validated:

1. **Parse check:** Expression must parse into a valid CEL AST.
2. **Type check:** Expression is type-checked against the declared source schema and custom function signatures. Warnings are issued for `dyn` (dynamic) types that cannot be statically verified.
3. **Safety check:** Expression must not reference undeclared variables. The `src`, `rowIndex`, `meta`, `params`, and `lookups` bindings are the only permitted roots.
4. **Cost check:** CEL's built-in cost estimation is evaluated. Expressions exceeding a configurable cost threshold (default: 10,000 cost units) are rejected to prevent expensive regex or deeply nested list operations.
5. **Determinism check:** Expressions must be deterministic (same input → same output). Functions with side effects are not registered in the CEL environment.

---

## 7. CEL Expression Examples

### 7.1 Basic Field Mapping

```javascript
// Direct field copy
src.Fund_ID

// Rename with trim
src["Fund Name"].trim()

// Concatenate fields
src.firstName + ' ' + src.lastName

// Conditional mapping
src.status == 'A' ? 'ACTIVE' : 'INACTIVE'
```

### 7.2 Type Coercion

```javascript
// String to decimal (financial amount)
parseDecimal(src.amount.replace(',', '').replace('$', ''))

// Parenthetical negatives: (1,234.56) → -1234.56
src.amount.startsWith('(')
  ? parseDecimal('-' + src.amount.replace('(', '').replace(')', '').replace(',', ''))
  : parseDecimal(src.amount.replace(',', ''))

// Date parsing from multiple possible formats
parseDate(src.valDate, has(src.valDate) && src.valDate.contains('/') ? 'MM/dd/yyyy' : 'yyyy-MM-dd')

// Boolean from various representations
src.isActive == 'Y' || src.isActive == 'Yes' || src.isActive == '1' || src.isActive == 'true'
```

### 7.3 Cross-Reference Lookups

```javascript
// Look up Eagle accounting basis from account cross-reference
lookup('xrefAccount', src.accountId, 'eagleActBasis')

// Look up with default fallback
lookupOrDefault('xrefBrokerCode', src.broker, 'eagleBrokerCode', 'UNKNOWN')

// Chained lookup: get security type, then map to canonical classification
lookup('refSecType', lookup('refSecurity', src.cusip, 'secType'), 'secTypeDescription')
```

### 7.4 Derived and Computed Fields

```javascript
// Calculate NAV per share
parseDecimal(src.totalNetAssets) / parseDecimal(src.sharesOutstanding)

// Round to 6 decimal places
round(parseDecimal(src.marketValue) - parseDecimal(src.bookValue), 6)

// Unrealized gain/loss sign convention
(parseDecimal(src.marketValue) - parseDecimal(src.bookValue)) * -1.0

// Percentage calculation
round((parseDecimal(src.variance) / parseDecimal(src.expected)) * 100.0, 2)
```

### 7.5 List and Map Operations

```javascript
// Split pipe-delimited values into list
split(src.tags, '|')

// Filter and transform list elements
split(src.categories, ',').map(c, c.trim()).filter(c, c != '')

// Build nested object for JSON target
{
  'account': src.accountId,
  'position': {
    'assetId': src.cusip,
    'quantity': parseDecimal(src.units),
    'marketValue': parseDecimal(src.mktVal)
  }
}
```

### 7.6 Row Filtering

```javascript
// Skip header/trailer rows in fixed-width files
src.recordType == 'D'

// Skip placeholder rows
src.Fund_ID != '' && src.Net_Assets != 'N/A' && src.Net_Assets != '0'

// Date range filter using execution parameters
parseDate(src.valDate, 'yyyy-MM-dd') >= params.startDate
  && parseDate(src.valDate, 'yyyy-MM-dd') <= params.endDate
```

---

## 8. Mapping Execution Engine

### 8.1 Execution Pipeline

```
Source File
    │
    ▼
┌──────────────────┐
│ 1. Format        │  Detect file format from extension/content
│    Detection     │  Validate against declared source format
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. Schema        │  Read headers / infer schema
│    Inference     │  Validate against declared source schema
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. CEL           │  Compile all field mapping expressions
│    Compilation   │  Compile all filter expressions
│                  │  Cache compiled ASTs for reuse
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. Lookup        │  Load cross-reference tables into memory
│    Loading       │  Build hash-indexed lookup maps
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 5. Row-by-Row    │  For each source row:
│    Processing    │    a. Parse row into Map<String, Object>
│                  │    b. Apply filter expressions (skip if false)
│                  │    c. Evaluate each field mapping CEL expr
│                  │    d. Validate output types/constraints
│                  │    e. Handle errors per error policy
│                  │    f. Write to output buffer
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 6. Output        │  Flush output buffer to target format
│    Serialization │  Generate execution summary report
└──────────────────┘
```

### 8.2 Performance Optimization

- **Compile once, evaluate many:** CEL ASTs are compiled at step 3 and reused for every row. This follows the standard CEL pattern where compilation cost is amortized across millions of evaluations.
- **Lookup table indexing:** Cross-reference tables are loaded into `HashMap<String, Map<String, Object>>` structures with O(1) key lookup, avoiding per-row database queries.
- **Streaming reads:** Source files are read in streaming fashion (Jackson streaming parser for JSON/XML, Apache Commons CSV iterator for CSV, Apache POI streaming reader for Excel) to keep memory usage proportional to row size, not file size.
- **Parallel evaluation:** For large files (>10K rows), rows are partitioned and evaluated in parallel using Java's `ForkJoinPool`. CEL evaluation is stateless and thread-safe by design.
- **Output buffering:** Target writes are batched (configurable batch size, default 1000 rows) to minimize I/O operations.

### 8.3 Error Handling Strategies

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `FAIL_FAST` | Abort entire mapping on first error | Production runs where data integrity is critical |
| `SKIP_AND_LOG` | Skip errored row, continue processing, log details | Initial data exploration and testing |
| `USE_DEFAULT` | Replace errored field with configured default value | Tolerant ingestion where partial data is acceptable |
| `COLLECT_ERRORS` | Process all rows, collect all errors, return comprehensive error report | Validation/dry-run mode |

Error details captured per failure:

```json
{
  "rowIndex": 42,
  "sourceRow": { "Fund_ID": "ABC123", "Val_Date": "13/31/2026" },
  "targetField": "valuationDate",
  "celExpression": "parseDate(src.Val_Date, 'MM/dd/yyyy')",
  "errorType": "EVALUATION_ERROR",
  "errorMessage": "Invalid date: month 13 is out of range",
  "timestamp": "2026-03-09T14:30:00Z"
}
```

---

## 9. API Specification

### 9.1 Mapping Management APIs

```
POST   /api/v1/mappings                    Create new mapping definition
GET    /api/v1/mappings                    List all mapping definitions
GET    /api/v1/mappings/{mappingId}        Get mapping definition by ID
PUT    /api/v1/mappings/{mappingId}        Update mapping definition
DELETE /api/v1/mappings/{mappingId}        Delete mapping definition
POST   /api/v1/mappings/{mappingId}/clone  Clone mapping definition
```

### 9.2 Mapping Validation APIs

```
POST   /api/v1/mappings/validate           Validate mapping config (CEL parse + type check)
POST   /api/v1/mappings/preview            Preview mapping: apply to sample rows, return results
POST   /api/v1/mappings/infer-schema       Infer source schema from uploaded sample file
```

### 9.3 Mapping Execution APIs

```
POST   /api/v1/mappings/{mappingId}/execute           Execute mapping (sync, small files <10MB)
POST   /api/v1/mappings/{mappingId}/execute-async      Execute mapping (async, returns jobId)
GET    /api/v1/jobs/{jobId}                            Get job status and progress
GET    /api/v1/jobs/{jobId}/errors                     Get error details for a job
GET    /api/v1/jobs/{jobId}/output                     Download output file
DELETE /api/v1/jobs/{jobId}                            Cancel running job
```

### 9.4 CEL Utility APIs

```
POST   /api/v1/cel/validate                Validate a CEL expression against a schema
POST   /api/v1/cel/evaluate                Evaluate a CEL expression against sample data
GET    /api/v1/cel/functions                List all available CEL functions with signatures
POST   /api/v1/cel/suggest                  AI-powered: suggest CEL expression for a field mapping
```

### 9.5 Lookup Table APIs

```
POST   /api/v1/lookups                     Upload/register a lookup table
GET    /api/v1/lookups                     List available lookup tables
GET    /api/v1/lookups/{tableId}           Get lookup table metadata
DELETE /api/v1/lookups/{tableId}           Remove lookup table
```

---

## 10. User Interface Specification

### 10.1 Mapping Designer (React Component)

The mapping designer provides a two-panel visual interface:

**Left Panel — Source Schema:**
- Displays inferred or declared source fields as a tree/list.
- Shows sample values from the first N rows of an uploaded sample file.
- Fields are draggable for visual mapping.

**Right Panel — Target Schema:**
- Displays the target schema fields with types and required indicators.
- Each field has an editable CEL expression input with syntax highlighting.
- Inline validation indicators (green check / red X) show CEL parse status.

**Bottom Panel — Preview Grid:**
- AG-Grid table showing source-to-target mapping results for sample rows.
- Source columns on the left, target columns on the right, with color-coded cells for type mismatches or evaluation errors.
- Toggle between "Mapped Values" and "Raw CEL" views.

### 10.2 CEL Expression Editor

The inline CEL editor provides:

- **Syntax highlighting** using CodeMirror or Monaco editor with a custom CEL grammar.
- **Autocomplete** for `src.` field names, custom function names, and `lookups.` table names.
- **Inline type information** showing the inferred return type of the expression.
- **Error tooltips** displaying CEL parse/type-check errors on hover.
- **Function reference** sidebar with searchable documentation of all available CEL functions and their signatures.
- **Expression templates** for common patterns (date parsing, decimal conversion, conditional mapping, cross-reference lookup).

### 10.3 Mapping Template Library

A searchable library of reusable mapping templates:

- Filter by incumbent provider, file type, target canonical table.
- Clone and customize templates for new funds.
- Version history with diff view showing changes between template versions.
- AI-generated templates from sample file uploads with human review workflow.

---

## 11. AI Agent Integration

### 11.1 Mapping Generation Workflow

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│ User uploads │───▶│ AI Agent     │───▶│ Human Review │───▶│ Approved    │
│ sample file  │    │ generates    │    │ & edit       │    │ mapping     │
│ + target     │    │ CEL mappings │    │ expressions  │    │ deployed    │
│ schema       │    │              │    │              │    │             │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
```

1. User uploads a sample source file and selects the target canonical table.
2. The AI agent (Claude) analyzes the source columns, sample values, and target schema.
3. For each target field, the agent generates a CEL expression with a confidence score and explanation.
4. The `cel-python` library validates each generated expression against the source schema.
5. The human reviewer sees the AI-generated mapping with highlighted confidence levels, edits as needed, and approves.
6. The approved mapping is stored and version-controlled.

### 11.2 AI Prompt Template (for CEL Generation)

```
You are a data mapping specialist. Given the following source file schema 
and sample data, generate CEL expressions to map each source field to the 
target canonical schema.

Source Schema: {source_schema}
Sample Data (first 5 rows): {sample_rows}
Target Schema: {target_schema}
Available Lookup Tables: {lookup_tables}
Available Custom Functions: {custom_functions}

For each target field, provide:
1. The CEL expression
2. A confidence score (HIGH / MEDIUM / LOW)
3. A brief explanation of the mapping logic
4. Any assumptions made

Rules:
- Use only the declared custom functions and standard CEL operations
- Handle null/empty values with has() checks or coalesce()
- Use parseDecimal() for all financial amounts
- Use parseDate() with explicit format patterns for dates
- Reference lookup tables for cross-reference mappings
- Prefer explicit type handling over implicit coercion
```

### 11.3 Safety Guarantees

Because CEL is non-Turing-complete:

- AI-generated expressions cannot contain infinite loops, recursion, or unbounded computation.
- Evaluation time is linear with respect to expression size and input size.
- No file system access, network calls, or side effects are possible from within CEL.
- The human reviewer validates business logic correctness, not execution safety.
- All expressions are stored as auditable configuration, not compiled code.

---

## 12. Template Reuse and Inheritance

### 12.1 Template Hierarchy

```
Provider Template (e.g., "State Street CSV")
    │
    ├── File Type Template (e.g., "State Street NAV CSV")
    │       │
    │       ├── Fund Family Override (e.g., "STT NAV — Equity Funds")
    │       │
    │       └── Fund Family Override (e.g., "STT NAV — Fixed Income Funds")
    │
    └── File Type Template (e.g., "State Street Position CSV")
```

### 12.2 Inheritance Rules

- Child mappings inherit all field mappings from the parent template.
- Child mappings can override individual field CEL expressions.
- Child mappings can add new field mappings not present in the parent.
- Child mappings cannot remove required target fields.
- Overrides are tracked with full audit trail (who, when, why).

### 12.3 Template Versioning

- Templates use semantic versioning (`MAJOR.MINOR.PATCH`).
- Breaking changes (removing fields, changing types) increment MAJOR.
- New field additions increment MINOR.
- CEL expression refinements increment PATCH.
- Active mappings pin to a specific template version.
- Upgrade notifications are surfaced in the Control Center when new template versions are available.

---

## 13. Audit and Compliance

### 13.1 Audit Trail

Every mapping configuration change and execution is logged:

| Event | Captured Data |
|-------|---------------|
| Mapping created | User, timestamp, full configuration snapshot |
| Mapping modified | User, timestamp, field-level diff of changes |
| Mapping approved | Reviewer, timestamp, approval notes |
| Mapping executed | Job ID, input file hash, output file hash, row counts, error counts, duration |
| CEL expression changed | Before/after expression text, user, timestamp |

### 13.2 Compliance Controls

- **Segregation of duties:** Mapping creators cannot self-approve. A different reviewer must approve the mapping before it can be used in production reconciliation runs.
- **Immutable execution logs:** Job execution records are append-only and cannot be modified or deleted.
- **Data lineage:** Each output field carries metadata linking back to the source field(s), CEL expression, and mapping version used to produce it.
- **Reproducibility:** Given the same input file, mapping configuration, and lookup table versions, the engine must produce byte-identical output.

---

## 14. Implementation Roadmap

### Phase 1 — Foundation (Weeks 1–5)

- Core mapping engine with CEL evaluation pipeline.
- CSV source reader and JSON target writer.
- Custom CEL function library (date, numeric, string, coercion).
- REST API for mapping CRUD and synchronous execution.
- Unit test suite with >90% coverage on CEL evaluation paths.

### Phase 2 — Format Expansion (Weeks 6–10)

- Additional source readers: JSON, XML, Excel, fixed-width.
- Additional target writers: CSV, XML, Excel.
- Lookup table loading and cross-reference function integration.
- Async job execution with progress tracking.
- Error handling strategy configuration.

### Phase 3 — UI and AI Integration (Weeks 11–16)

- React mapping designer component with two-panel layout.
- CEL expression editor with syntax highlighting and autocomplete.
- AI agent CEL generation pipeline with `cel-python` validation.
- Template library UI with search, clone, and versioning.
- Preview grid with AG-Grid Enterprise.

### Phase 4 — Enterprise Features (Weeks 17–20)

- Template inheritance and override mechanism.
- Full audit trail and compliance reporting.
- Role-based access control aligned with RECON-AI RBAC.
- Performance optimization: parallel evaluation, streaming I/O.
- Integration with Document Intelligence module output.
- Production load testing (target: 100K rows in <1 second).

---

## 15. Appendices

### A. CEL Quick Reference Card

```
// Variables
src.fieldName              // Access source field
src["field with spaces"]   // Bracket notation for special names
rowIndex                   // Current row number (0-based)
meta.fileName              // Source file metadata
params.valuationDate       // Runtime parameters
lookups.tableName          // Lookup table access

// Operators
+  -  *  /  %             // Arithmetic
== != < <= > >=           // Comparison
&& || !                   // Logical
? :                        // Ternary conditional
in                         // Membership test

// Core Functions
size(x)                    // Length of string, list, or map
has(src.field)             // Check if field exists
type(x)                    // Get runtime type

// String
x.contains(y)             // Substring test
x.startsWith(y)           // Prefix test
x.endsWith(y)             // Suffix test
x.matches(regex)          // Regex match

// List Macros
list.all(x, predicate)    // All elements satisfy predicate
list.exists(x, predicate) // At least one satisfies
list.filter(x, predicate) // Filter elements
list.map(x, transform)    // Transform elements

// Custom (Mapping Engine)
parseDate(str, pattern)    // Parse date string
parseDecimal(str)          // Parse financial decimal
round(val, places)         // Round decimal
trim(str)                  // Trim whitespace
lookup(table, key, field)  // Cross-reference lookup
coalesce(a, b, c)         // First non-null value
```

### B. Canonical Data Model Target Tables

The mapping utility's primary target schemas align with the RECON-AI canonical data model:

- `dataNav` — Fund-level NAV data (totalNetAssets, sharesOutstanding, navPerShare, etc.)
- `dataDailyTransactions` — Transaction-level data (transCode, units, amountLocal, amountBase, tradeDate, settleDate)
- `dataSubLedgerPosition` — Position-level holdings (posBookValueBase, posMarketValueBase, posIncomeBase)
- `dataLedger` — General ledger balances (glAccountNumber, beginningBalance, endingBalance)
- `refSecurity` — Security master reference data (cusip, isin, sedol, secType, couponRate, maturityDate)
- `xrefAccount` — Account cross-reference mappings (eagleActBasis, eagleSource, chartOfAccounts)
- `xrefBrokerCode` — Broker code cross-reference
- `xrefTransaction` — Transaction code cross-reference

### C. Related Documents

- RECON-AI Architecture Specification v1.0
- RECON-AI Control Center UX Specification v1.0
- RECON-AI Process Flow Specification v1.0
- Fund Administration Canonical Data Model v2.0
- Data Validation Rules Specification

---

*RECON-AI Data Mapping Utility Specification v1.0 — March 2026*
