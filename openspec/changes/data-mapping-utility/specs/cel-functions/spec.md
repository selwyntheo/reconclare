## ADDED Requirements

### Requirement: Date/time custom CEL functions
The CEL environment SHALL register date/time functions for financial data transformation.

#### Scenario: parseDate parses date string
- **WHEN** `parseDate(src.Val_Date, 'MM/dd/yyyy')` is evaluated with `src.Val_Date = "03/09/2026"`
- **THEN** the result is a datetime object representing March 9, 2026

#### Scenario: formatDate formats timestamp to string
- **WHEN** `formatDate(parseDate('2026-03-09', 'yyyy-MM-dd'), 'MM/dd/yyyy')` is evaluated
- **THEN** the result is `"03/09/2026"`

#### Scenario: today returns current date
- **WHEN** `today()` is evaluated
- **THEN** the result is the current UTC date as a datetime object

#### Scenario: dateDiff calculates difference
- **WHEN** `dateDiff(parseDate('2026-03-09', 'yyyy-MM-dd'), parseDate('2026-03-01', 'yyyy-MM-dd'), 'DAYS')` is evaluated
- **THEN** the result is `8`

### Requirement: Numeric custom CEL functions
The CEL environment SHALL register numeric functions for financial amount parsing and formatting.

#### Scenario: parseDecimal handles comma-formatted numbers
- **WHEN** `parseDecimal('1,234,567.89')` is evaluated
- **THEN** the result is `1234567.89`

#### Scenario: parseDecimal handles parenthetical negatives
- **WHEN** `parseDecimal('(1,234.56)')` is evaluated
- **THEN** the result is `-1234.56`

#### Scenario: round to decimal places
- **WHEN** `round(3.14159, 2)` is evaluated
- **THEN** the result is `3.14`

#### Scenario: abs returns absolute value
- **WHEN** `abs(-42.5)` is evaluated
- **THEN** the result is `42.5`

#### Scenario: toInt parses string to integer
- **WHEN** `toInt('42')` is evaluated
- **THEN** the result is `42`

#### Scenario: formatNumber formats with pattern
- **WHEN** `formatNumber(1234567.89, '#,##0.00')` is evaluated
- **THEN** the result is `"1,234,567.89"`

### Requirement: String custom CEL functions
The CEL environment SHALL register string manipulation functions beyond standard CEL.

#### Scenario: padLeft pads string
- **WHEN** `padLeft('42', 5, '0')` is evaluated
- **THEN** the result is `"00042"`

#### Scenario: padRight pads string
- **WHEN** `padRight('ABC', 6, ' ')` is evaluated
- **THEN** the result is `"ABC   "`

#### Scenario: split splits string by delimiter
- **WHEN** `split('a|b|c', '|')` is evaluated
- **THEN** the result is `["a", "b", "c"]`

#### Scenario: join joins list with delimiter
- **WHEN** `join(['a', 'b', 'c'], ', ')` is evaluated
- **THEN** the result is `"a, b, c"`

#### Scenario: regexExtract extracts first group
- **WHEN** `regexExtract('Fund-ABC-123', 'Fund-(\\w+)-(\\d+)')` is evaluated
- **THEN** the result is `"ABC"`

#### Scenario: regexReplace replaces matches
- **WHEN** `regexReplace('$1,234.56', '[\\$,]', '')` is evaluated
- **THEN** the result is `"1234.56"`

### Requirement: Lookup custom CEL functions
The CEL environment SHALL register lookup functions for cross-reference resolution.

#### Scenario: lookup retrieves value from reference table
- **WHEN** `lookup('xrefAccount', 'ACC001', 'eagleActBasis')` is evaluated and the xrefAccount table contains a row with key `ACC001` and field `eagleActBasis = "TRADE"`
- **THEN** the result is `"TRADE"`

#### Scenario: lookupOrDefault returns fallback
- **WHEN** `lookupOrDefault('xrefBrokerCode', 'UNKNOWN_BROKER', 'eagleBrokerCode', 'DEFAULT')` is evaluated and no match exists
- **THEN** the result is `"DEFAULT"`

#### Scenario: crossRef returns entire record
- **WHEN** `crossRef('xrefAccount', 'ACC001')` is evaluated
- **THEN** the result is a map containing all fields from the matching xrefAccount row

### Requirement: Coercion custom CEL functions
The CEL environment SHALL register coercion and null-handling functions.

#### Scenario: coalesce returns first non-null
- **WHEN** `coalesce(src.currency, src.defaultCurrency, 'USD')` is evaluated with `src.currency = None` and `src.defaultCurrency = "EUR"`
- **THEN** the result is `"EUR"`

#### Scenario: ifEmpty provides fallback for empty strings
- **WHEN** `ifEmpty(src.notes, 'No notes')` is evaluated with `src.notes = ""`
- **THEN** the result is `"No notes"`

#### Scenario: nullIf converts sentinel to null
- **WHEN** `nullIf(src.amount, 'N/A')` is evaluated with `src.amount = "N/A"`
- **THEN** the result is `None`

#### Scenario: toList wraps scalar in list
- **WHEN** `toList('single')` is evaluated
- **THEN** the result is `["single"]`

#### Scenario: flatten flattens nested lists
- **WHEN** `flatten([['a', 'b'], ['c']])` is evaluated
- **THEN** the result is `["a", "b", "c"]`

### Requirement: Custom functions are type-safe
All custom CEL functions SHALL validate argument types and raise clear error messages for type mismatches.

#### Scenario: parseDecimal rejects non-string input
- **WHEN** `parseDecimal(42)` is evaluated (integer instead of string)
- **THEN** a clear error message indicates that parseDecimal expects a string argument

#### Scenario: parseDate rejects invalid format
- **WHEN** `parseDate('not-a-date', 'yyyy-MM-dd')` is evaluated
- **THEN** a clear error message indicates the date string does not match the format pattern
