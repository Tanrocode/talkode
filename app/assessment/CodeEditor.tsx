"use client";

import { useEffect, useMemo, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-json";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-markup-templating"; // required by prism-php
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-java";

export type LineRange = { startLine: number; endLine: number };

export type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  filePath: string;
  highlightRange?: LineRange | null;
  onSelectionLinesChange?: (range: LineRange | null) => void;
  // Overrides file-extension-based grammar detection (e.g. for the coding
  // challenge editor, where the "file" is just a language picked from a list).
  language?: string;
  autoFocus?: boolean;
};

const LANGUAGE_GRAMMARS: Record<string, [Prism.Grammar, string]> = {
  python: [Prism.languages.python, "python"],
  json: [Prism.languages.json, "json"],
  typescript: [Prism.languages.typescript, "typescript"],
  tsx: [Prism.languages.tsx, "tsx"],
  javascript: [Prism.languages.javascript, "javascript"],
  jsx: [Prism.languages.jsx, "jsx"],
  css: [Prism.languages.css, "css"],
  markup: [Prism.languages.markup, "markup"],
  c: [Prism.languages.c, "c"],
  cpp: [Prism.languages.cpp, "cpp"],
  csharp: [Prism.languages.csharp, "csharp"],
  go: [Prism.languages.go, "go"],
  rust: [Prism.languages.rust, "rust"],
  php: [Prism.languages.php, "php"],
  ruby: [Prism.languages.ruby, "ruby"],
  java: [Prism.languages.java, "java"],
};

function grammarForPath(path: string): [Prism.Grammar, string] {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, [Prism.Grammar, string]> = {
    py: LANGUAGE_GRAMMARS.python,
    json: LANGUAGE_GRAMMARS.json,
    ts: LANGUAGE_GRAMMARS.typescript,
    tsx: LANGUAGE_GRAMMARS.tsx,
    js: LANGUAGE_GRAMMARS.javascript,
    jsx: LANGUAGE_GRAMMARS.jsx,
    css: LANGUAGE_GRAMMARS.css,
    md: LANGUAGE_GRAMMARS.markup,
  };
  return map[ext] ?? [Prism.languages.clike, "clike"];
}

function countNewlinesBefore(text: string, offset: number) {
  let count = 0;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

function applyValue(
  ta: HTMLTextAreaElement,
  next: string,
  selStart: number,
  selEnd: number,
) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(ta, next);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  requestAnimationFrame(() => ta.setSelectionRange(selStart, selEnd));
}

export function CodeEditor({
  value,
  onChange,
  filePath,
  highlightRange,
  onSelectionLinesChange,
  language,
  autoFocus,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  const [grammar, grammarName] = useMemo(
    () => (language ? LANGUAGE_GRAMMARS[language] ?? [Prism.languages.clike, "clike"] : grammarForPath(filePath)),
    [language, filePath],
  );

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const highlightedHtml = useMemo(
    () => Prism.highlight(value, grammar, grammarName),
    [value, grammar, grammarName],
  );

  function syncScroll() {
    if (!textareaRef.current || !preRef.current) return;
    preRef.current.scrollTop = textareaRef.current.scrollTop;
    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  function reportSelection() {
    const ta = textareaRef.current;
    if (!ta || !onSelectionLinesChange) return;
    if (ta.selectionStart === ta.selectionEnd) {
      onSelectionLinesChange(null);
      return;
    }
    const startLine = countNewlinesBefore(value, ta.selectionStart) + 1;
    const endLine = countNewlinesBefore(value, ta.selectionEnd) + 1;
    onSelectionLinesChange({ startLine, endLine });
  }

  function handleIndentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd } = ta;
    const text = ta.value;

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
        const block = text.slice(lineStart, selectionEnd);
        const dedented = block.replace(/^ {1,2}/gm, "");
        const next = text.slice(0, lineStart) + dedented + text.slice(selectionEnd);
        applyValue(ta, next, lineStart, lineStart + dedented.length);
      } else if (selectionStart === selectionEnd) {
        const next = text.slice(0, selectionStart) + "  " + text.slice(selectionEnd);
        applyValue(ta, next, selectionStart + 2, selectionStart + 2);
      } else {
        const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
        const block = text.slice(lineStart, selectionEnd);
        const indented = block.replace(/^/gm, "  ");
        const next = text.slice(0, lineStart) + indented + text.slice(selectionEnd);
        applyValue(
          ta,
          next,
          selectionStart + 2,
          selectionEnd + indented.length - block.length + 2,
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
      const currentLine = text.slice(lineStart, selectionStart);
      const baseIndentMatch = currentLine.match(/^[ \t]*/);
      let indent = baseIndentMatch ? baseIndentMatch[0] : "";
      const trimmedEnd = currentLine.trimEnd();
      if (/[{([]$/.test(trimmedEnd)) indent += "  ";
      const next = text.slice(0, selectionStart) + "\n" + indent + text.slice(selectionEnd);
      const cursor = selectionStart + 1 + indent.length;
      applyValue(ta, next, cursor, cursor);
    }
  }

  // Jump the editor to an externally-requested line range (e.g. clicking a saved note).
  useEffect(() => {
    if (!highlightRange || !textareaRef.current) return;
    const lines = value.split("\n");
    const charOffset = lines.slice(0, highlightRange.startLine - 1).join("\n").length + 1;
    const ta = textareaRef.current;
    ta.focus();
    ta.setSelectionRange(
      charOffset,
      charOffset + (lines[highlightRange.startLine - 1]?.length ?? 0),
    );
    const lineHeight = parseFloat(window.getComputedStyle(ta).lineHeight || "20") || 20;
    ta.scrollTop = Math.max(0, (highlightRange.startLine - 3) * lineHeight);
    syncScroll();
  }, [highlightRange, value]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <pre
        ref={preRef}
        aria-hidden
        className="tk-mono pointer-events-none absolute inset-0 overflow-auto whitespace-pre p-6 text-[15px] leading-relaxed text-[var(--tk-text-muted)]"
        style={{ tabSize: 2 }}
        dangerouslySetInnerHTML={{ __html: highlightedHtml + "\n" }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
        onSelect={reportSelection}
        onKeyUp={reportSelection}
        onMouseUp={reportSelection}
        onKeyDown={handleIndentKeyDown}
        spellCheck={false}
        wrap="off"
        style={{ tabSize: 2 }}
        className="tk-mono absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent p-6 text-[15px] leading-relaxed text-transparent caret-[var(--tk-text)] outline-none"
      />
    </div>
  );
}
