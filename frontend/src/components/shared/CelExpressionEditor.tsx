import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export interface CelFunctionDoc {
  name: string;
  signature: string;
  description: string;
  example: string;
  category: string;
}

interface CelExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  functions?: CelFunctionDoc[];
  height?: number;
  readOnly?: boolean;
  onValidationChange?: (isValid: boolean, error: string | null) => void;
  validateExpression?: (expr: string) => Promise<{ isValid: boolean; error: string | null }>;
}

const CEL_KEYWORDS = [
  'true', 'false', 'null', 'in', 'has', 'size', 'type', 'int', 'uint',
  'double', 'bool', 'string', 'bytes', 'list', 'map', 'timestamp', 'duration',
];

const CEL_OPERATORS = ['&&', '||', '!', '==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '%', '?', ':'];

export default function CelExpressionEditor({
  value,
  onChange,
  label,
  functions = [],
  height = 120,
  readOnly = false,
  onValidationChange,
  validateExpression,
}: CelExpressionEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [validationState, setValidationState] = useState<{
    isValid: boolean | null;
    error: string | null;
    checking: boolean;
  }>({ isValid: null, error: null, checking: false });

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register CEL language if not already registered
      if (!monaco.languages.getLanguages().some((l: any) => l.id === 'cel')) {
        monaco.languages.register({ id: 'cel' });

        monaco.languages.setMonarchTokensProvider('cel', {
          keywords: CEL_KEYWORDS,
          operators: CEL_OPERATORS.map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          customFunctions: functions.map((f) => f.name),
          tokenizer: {
            root: [
              // Strings
              [/"([^"\\]|\\.)*$/, 'string.invalid'],
              [/"/, 'string', '@string_double'],
              [/'([^'\\]|\\.)*$/, 'string.invalid'],
              [/'/, 'string', '@string_single'],
              // Numbers
              [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
              [/\d+/, 'number'],
              // Identifiers and keywords
              [
                /[a-zA-Z_]\w*/,
                {
                  cases: {
                    '@keywords': 'keyword',
                    '@customFunctions': 'support.function',
                    '@default': 'identifier',
                  },
                },
              ],
              // Comments
              [/\/\/.*$/, 'comment'],
              // Operators
              [/[{}()[\]]/, '@brackets'],
              [/[<>]=?|[!=]=|&&|\|\||[+\-*/%?:]/, 'operator'],
              // Delimiters
              [/[,.]/, 'delimiter'],
            ],
            string_double: [
              [/[^\\"]+/, 'string'],
              [/\\./, 'string.escape'],
              [/"/, 'string', '@pop'],
            ],
            string_single: [
              [/[^\\']+/, 'string'],
              [/\\./, 'string.escape'],
              [/'/, 'string', '@pop'],
            ],
          },
        } as any);
      }

      // Register completions
      if (functions.length > 0) {
        monaco.languages.registerCompletionItemProvider('cel', {
          provideCompletionItems: (model: any, position: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const suggestions = functions.map((fn) => ({
              label: fn.name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: fn.name + '(${1})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: fn.signature,
              documentation: {
                value: `**${fn.name}**\n\n${fn.description}\n\n\`\`\`\n${fn.example}\n\`\`\``,
              },
              range,
            }));

            // Add variable roots
            const roots = [
              { label: 'ledger', detail: 'Ledger data rows', insertText: 'ledger' },
              { label: 'sample', detail: 'Sample data rows', insertText: 'sample' },
              { label: 'meta', detail: 'Metadata (account, filingPeriod)', insertText: 'meta' },
            ];
            for (const root of roots) {
              suggestions.push({
                label: root.label,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: root.insertText,
                insertTextRules: 0,
                detail: root.detail,
                documentation: { value: root.detail },
                range,
              });
            }

            return { suggestions };
          },
        });
      }
    },
    [functions]
  );

  // Debounced validation
  useEffect(() => {
    if (!validateExpression || !value.trim()) {
      setValidationState({ isValid: null, error: null, checking: false });
      onValidationChange?.(true, null);
      return;
    }

    setValidationState((prev) => ({ ...prev, checking: true }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await validateExpression(value);
        setValidationState({ isValid: result.isValid, error: result.error, checking: false });
        onValidationChange?.(result.isValid, result.error);
      } catch {
        setValidationState({ isValid: false, error: 'Validation service unavailable', checking: false });
        onValidationChange?.(false, 'Validation service unavailable');
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, validateExpression, onValidationChange]);

  const borderColor =
    validationState.isValid === null
      ? 'divider'
      : validationState.isValid
      ? 'success.main'
      : 'error.main';

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          border: 2,
          borderColor,
          borderRadius: 1,
          overflow: 'hidden',
          transition: 'border-color 0.2s',
        }}
      >
        <Editor
          height={height}
          language="cel"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 0,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            readOnly,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
          }}
          loading={<CircularProgress size={20} />}
        />
      </Box>
      {/* Validation indicator */}
      {value.trim() && (
        <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {validationState.checking ? (
            <Chip
              size="small"
              label="Validating..."
              icon={<CircularProgress size={12} />}
              variant="outlined"
            />
          ) : validationState.isValid === true ? (
            <Chip
              size="small"
              label="Valid expression"
              color="success"
              icon={<CheckCircleOutlineIcon />}
              variant="outlined"
            />
          ) : validationState.isValid === false ? (
            <Chip
              size="small"
              label={validationState.error || 'Invalid expression'}
              color="error"
              icon={<ErrorOutlineIcon />}
              variant="outlined"
              sx={{ maxWidth: '100%' }}
            />
          ) : null}
        </Box>
      )}
    </Box>
  );
}
