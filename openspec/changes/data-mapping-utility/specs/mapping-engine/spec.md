## ADDED Requirements

### Requirement: Mapping engine executes file-to-file transformations
The mapping engine SHALL read a source file, evaluate CEL expressions per-field per-row, and write results to a target file. The engine SHALL support CSV, JSON, and Excel (XLSX) as both source and target formats.

#### Scenario: CSV to JSON mapping execution
- **WHEN** a mapping definition specifies CSV source and JSON target with field-level CEL expressions
- **THEN** the engine reads each CSV row into a `src` map, evaluates all field mapping CEL expressions, and writes the results as a JSON array of objects

#### Scenario: Excel to CSV mapping execution
- **WHEN** a mapping definition specifies Excel source and CSV target
- **THEN** the engine reads each Excel row from the configured sheet, evaluates CEL expressions, and writes CSV output with headers

#### Scenario: JSON to JSON mapping execution
- **WHEN** a mapping definition specifies JSON source (array of objects) and JSON target
- **THEN** the engine reads each JSON object as a `src` map and produces transformed JSON output

### Requirement: Source readers normalize rows to key-value maps
Each source reader SHALL parse input rows into `dict[str, Any]` where keys are column/field names and values are Python objects. The `src` variable in CEL evaluation SHALL reference this map.

#### Scenario: CSV reader with headers
- **WHEN** a CSV file has `hasHeader: true` and columns `["Fund_ID", "Val_Date", "Amount"]`
- **THEN** each row produces a dict like `{"Fund_ID": "ABC", "Val_Date": "03/09/2026", "Amount": "1,234.56"}`

#### Scenario: CSV reader with custom delimiter and null values
- **WHEN** source options specify `delimiter: "|"` and `nullValues: ["", "N/A", "NULL"]`
- **THEN** the reader splits on pipe and converts matching values to `None`

#### Scenario: Excel reader with sheet selection
- **WHEN** source options specify `sheetName: "NAV Data"` and `headerRow: 0` and `dataStartRow: 1`
- **THEN** the reader extracts data from the named sheet starting at the configured row

#### Scenario: JSON reader with root path
- **WHEN** source options specify `rootPath: "$.data.records"`
- **THEN** the reader navigates to the nested array and iterates its elements

### Requirement: Target writers serialize evaluated results
Each target writer SHALL take evaluated row dicts and serialize them to the target format with configured options.

#### Scenario: JSON writer with array wrapper
- **WHEN** target options specify `arrayWrapper: true` and `prettyPrint: false`
- **THEN** output is a compact JSON array of objects

#### Scenario: CSV writer with headers
- **WHEN** target format is CSV
- **THEN** output includes a header row with target field names followed by data rows

#### Scenario: Excel writer
- **WHEN** target format is Excel
- **THEN** output is an XLSX file with headers in row 1 and data starting at row 2

### Requirement: Row filtering before mapping
The engine SHALL evaluate filter expressions (CEL returning bool) before processing field mappings. Rows where any filter evaluates to `false` SHALL be skipped.

#### Scenario: Filter skips empty rows
- **WHEN** a filter expression is `src.Fund_ID != '' && src.Net_Assets != 'N/A'` and a row has `Fund_ID = ""`
- **THEN** that row is skipped and not included in the output

#### Scenario: No filters configured
- **WHEN** the mapping definition has an empty filters array
- **THEN** all source rows are processed

### Requirement: Row-level error handling
The engine SHALL handle per-row and per-field errors according to the configured error handling strategy.

#### Scenario: FAIL_FAST aborts on first error
- **WHEN** errorHandling.onRowError is `FAIL_FAST` and a CEL expression fails on row 42
- **THEN** execution stops, the job status is set to `FAILED`, and the error detail includes row index, expression, and error message

#### Scenario: SKIP_AND_LOG continues past errors
- **WHEN** errorHandling.onRowError is `SKIP_AND_LOG` and a row fails
- **THEN** the row is excluded from output, the error is logged in the job's error list, and processing continues

#### Scenario: USE_DEFAULT substitutes defaults for failed fields
- **WHEN** errorHandling.onFieldError is `USE_DEFAULT` and field `currency` fails with a configured default of `"USD"`
- **THEN** the output row uses `"USD"` for that field and processing continues

#### Scenario: Max error count exceeded
- **WHEN** the accumulated error count exceeds `errorHandling.maxErrorCount`
- **THEN** execution stops regardless of the error strategy and the job is marked `FAILED`

### Requirement: CEL expressions are compiled once and reused
The engine SHALL compile all CEL expressions (field mappings + filters) into ASTs at initialization time and reuse them for every row evaluation.

#### Scenario: Expression compilation at startup
- **WHEN** a mapping execution starts
- **THEN** all CEL expressions are compiled before any rows are read, and compilation errors are reported immediately without processing any data

### Requirement: Execution context variables
Each CEL expression SHALL have access to `src` (current row), `rowIndex` (zero-based row number), `meta` (file metadata), `params` (user-supplied parameters), and `lookups` (reference data tables).

#### Scenario: Row index available in expression
- **WHEN** a CEL expression references `rowIndex` and the current row is the 5th data row
- **THEN** `rowIndex` evaluates to `4`

#### Scenario: Meta provides file information
- **WHEN** a CEL expression references `meta.fileName`
- **THEN** it returns the name of the source file being processed

#### Scenario: Params passed at execution time
- **WHEN** execution is invoked with `params: {"valuationDate": "2026-03-09"}` and a CEL expression uses `params.valuationDate`
- **THEN** it resolves to `"2026-03-09"`
