"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bot,
  ChevronDown,
  Clock,
  FileText,
  Folder,
  Loader2,
  LogOut,
  MessageSquare,
  Mic,
  Moon,
  Sun,
  X,
} from "lucide-react";
import type { CandidateAssessmentSession } from "@/app/assessment/actions";
import { useInterviewSession } from "@/app/assessment/useInterviewSession";
import type { CodebaseFile } from "@/app/dashboard/data";

type WorkspaceTheme = "dark" | "light";

type TreeNode = {
  children: TreeNode[];
  isDir: boolean;
  name: string;
  path: string;
};

type SyntaxPalette = {
  base: string;
  comment: string;
  functionName: string;
  keyword: string;
  literal: string;
  number: string;
  punctuation: string;
  string: string;
};

type LineReference = {
  content: string;
  line: number;
  path: string;
};

type CodeNote = LineReference & {
  id: string;
  note: string;
};

const workspaceCss = `
.ch-workspace { font-family: var(--font-plus-jakarta), Arial, Helvetica, sans-serif; }
.ch-mono { font-family: var(--font-plus-jakarta), Arial, Helvetica, sans-serif; }
.ch-workspace ::-webkit-scrollbar { width: 9px; height: 9px; }
.ch-workspace ::-webkit-scrollbar-track { background: transparent; }
.ch-workspace ::-webkit-scrollbar-thumb { background: var(--ch-scrollbar); border-radius: 3px; }
.ch-workspace ::-webkit-scrollbar-thumb:hover { background: var(--ch-scrollbar-hover); }
`;

const themeTokens = {
  dark: {
    root:
      "bg-[#0f1110] text-[#e8ebe3] selection:bg-white selection:text-[#111510]",
    header: "border-[#2d312b] bg-[#141715]",
    panel: "border-[#2d312b] bg-[#1a1d1a]",
    panelSoft: "border-[#2d312b] bg-[#131613]",
    canvas: "bg-[#0c0e0d]",
    canvasSoft: "bg-[#111410]",
    text: "text-[#e8ebe3]",
    muted: "text-[#a7aca1]",
    faint: "text-[#73786f]",
    hover: "hover:bg-[#252a23]",
    active: "bg-white/10 text-white",
    line: "border-[#2d312b]",
    button:
      "border-[#3b4237] text-[#e8ebe3] hover:border-[#596150] hover:bg-[#242922]",
    buttonActive: "border-white bg-white text-[#111510]",
    danger: "text-[#ffb4ab] hover:bg-[#93000a]/12 hover:text-[#ffdad6]",
    tab: "border-[#2d312b] bg-[#171a17] text-[#a7aca1]",
    tabActive: "border-white bg-[#0c0e0d] text-white",
    codeLine: "border-[#252a23] text-[#65705d]",
    mdSurface: "bg-[#111410]",
    agentBubble: "border-[#333830] bg-[#1a1d1a] text-[#e8ebe3]",
    userBubble: "bg-white/10 text-white",
    error: "border-[#93000a]/40 bg-[#93000a]/10 text-[#ffb4ab]",
    lineActive: "bg-white/[0.08] shadow-[inset_2px_0_0_white]",
    lineHover: "hover:bg-white/[0.04]",
    lineNoted: "bg-white/[0.05]",
    notePanel: "border-[#2d312b] bg-[#161916]",
    liveDot: "bg-white",
    idleDot: "bg-[#e5c07b]",
    scrollbar: "#3d4339",
    scrollbarHover: "#656d5e",
  },
  light: {
    root:
      "bg-[#fbfaf7] text-[#202322] selection:bg-white selection:text-[#111510]",
    header: "border-[#dedbd5] bg-white",
    panel: "border-[#dedbd5] bg-white",
    panelSoft: "border-[#e7e4de] bg-[#f5f3ef]",
    canvas: "bg-white",
    canvasSoft: "bg-[#fbfaf7]",
    text: "text-[#202322]",
    muted: "text-[#62675e]",
    faint: "text-[#858a80]",
    hover: "hover:bg-[#efede8]",
    active: "bg-white text-[#202322] shadow-[inset_0_0_0_1px_#202322]",
    line: "border-[#dedbd5]",
    button:
      "border-[#d8d5cf] text-[#202322] hover:border-[#c7c2ba] hover:bg-[#fbfaf7]",
    buttonActive: "border-[#202322] bg-white text-[#202322]",
    danger: "text-red-700 hover:bg-red-50 hover:text-red-800",
    tab: "border-[#dedbd5] bg-[#f5f3ef] text-[#62675e]",
    tabActive: "border-[#202322] bg-white text-[#202322]",
    codeLine: "border-[#ece9e3] text-[#9a9f94]",
    mdSurface: "bg-white",
    agentBubble: "border-[#e3e0da] bg-white text-[#202322]",
    userBubble: "bg-[#202322] text-white",
    error: "border-red-200 bg-red-50 text-red-700",
    lineActive: "bg-[#efede8] shadow-[inset_2px_0_0_#202322]",
    lineHover: "hover:bg-[#f5f3ef]",
    lineNoted: "bg-[#f8f6f1]",
    notePanel: "border-[#dedbd5] bg-white",
    liveDot: "bg-[#202322]",
    idleDot: "bg-[#9a7a1f]",
    scrollbar: "#c9c5bd",
    scrollbarHover: "#969086",
  },
} satisfies Record<WorkspaceTheme, Record<string, string>>;

const syntaxPalettes: Record<WorkspaceTheme, SyntaxPalette> = {
  dark: {
    base: "#d8ddd1",
    comment: "#7b8377",
    functionName: "#ffd866",
    keyword: "#65d6ff",
    literal: "#c792ea",
    number: "#f4bf75",
    punctuation: "#b6bcb0",
    string: "#ffffff",
  },
  light: {
    base: "#202322",
    comment: "#6f756c",
    functionName: "#8a5a00",
    keyword: "#005ea8",
    literal: "#6b3fb4",
    number: "#9c4a00",
    punctuation: "#5d6258",
    string: "#202322",
  },
};

const languageKeywords: Record<string, Set<string>> = {
  javascript: new Set([
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "let",
    "new",
    "return",
    "switch",
    "throw",
    "try",
    "typeof",
    "useEffect",
    "useMemo",
    "useState",
    "while",
  ]),
  json: new Set(["false", "null", "true"]),
  python: new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "async",
    "await",
    "class",
    "def",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "with",
    "yield",
  ]),
};

const technologyLabels: Record<string, string> = {
  python: "Python",
  react_javascript: "React",
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildFileTree(files: CodebaseFile[]): TreeNode[] {
  const root: TreeNode = { children: [], isDir: true, name: "", path: "" };

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let node = root;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const segmentPath = segments.slice(0, index + 1).join("/");
      let child = node.children.find(
        (candidate) => candidate.name === segment && candidate.isDir === !isLeaf,
      );

      if (!child) {
        child = {
          children: [],
          isDir: !isLeaf,
          name: segment,
          path: segmentPath,
        };
        node.children.push(child);
      }

      node = child;
    });
  }

  const sortNodes = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root.children;
}

function fileGlyph(name: string) {
  if (name.endsWith(".json")) return "{}";
  if (name.endsWith(".jsx") || name.endsWith(".js")) return "js";
  if (name.endsWith(".md")) return "md";
  if (name.endsWith(".py")) return "py";
  if (name.endsWith(".txt")) return "txt";
  return "<>";
}

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

function lineNoteId(path: string, line: number) {
  return `${path}:${line}`;
}

function languageForFile(file: CodebaseFile) {
  const path = file.path.toLowerCase();
  const language = file.language.toLowerCase();

  if (path.endsWith(".md") || language.includes("markdown")) return "markdown";
  if (path.endsWith(".py") || language.includes("python")) return "python";
  if (
    path.endsWith(".js") ||
    path.endsWith(".jsx") ||
    language.includes("javascript")
  ) {
    return "javascript";
  }
  if (path.endsWith(".json") || language.includes("json")) return "json";
  return "text";
}

function initialSeconds(session: CandidateAssessmentSession) {
  return Math.max(0, session.timeLimitMinutes * 60);
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildProblemStatement(session: CandidateAssessmentSession) {
  const techs = session.technologies
    .map((tech) => technologyLabels[tech] ?? tech)
    .join(", ");
  const files = session.codeFiles.map((file) => `- ${file.path}`).join("\n");
  return [
    `This is a ${techs || "code"} walkthrough interview for "${session.title}".`,
    "",
    "The candidate has this codebase open:",
    files || "(no files provided)",
    "",
    "Ask them to walk through the code, explain key decisions, spot issues, and",
    "propose improvements. Probe their reasoning when they pause.",
  ].join("\n");
}

function buildOpenFileSnapshot(
  files: CodebaseFile[],
  openTabs: string[],
  activePath: string,
) {
  const paths = openTabs.length > 0 ? openTabs : activePath ? [activePath] : [];
  return paths
    .map((path) => files.find((file) => file.path === path))
    .filter((file): file is CodebaseFile => Boolean(file))
    .map((file) => `// File: ${file.path}\n${file.content}`)
    .join("\n\n");
}

function pushTextNode(
  nodes: ReactNode[],
  key: string,
  text: string,
  style?: CSSProperties,
) {
  if (!text) return;
  nodes.push(
    <span key={key} style={style}>
      {text}
    </span>,
  );
}

function commentIndex(line: string, language: string) {
  if (language === "python") {
    return line.indexOf("#");
  }

  if (language === "javascript") {
    return line.indexOf("//");
  }

  return -1;
}

function highlightCodeLine(
  line: string,
  language: string,
  palette: SyntaxPalette,
) {
  const nodes: ReactNode[] = [];
  const commentStart = commentIndex(line, language);
  const code = commentStart >= 0 ? line.slice(0, commentStart) : line;
  const comment = commentStart >= 0 ? line.slice(commentStart) : "";
  const keywords = languageKeywords[language] ?? new Set<string>();
  const tokenPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[{}()[\].,:;+\-*/%=<>!&|]+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(code))) {
    const [token] = match;
    const start = match.index;
    pushTextNode(nodes, `plain-${start}`, code.slice(cursor, start));

    let color = palette.base;
    if (/^["'`]/.test(token)) {
      color = palette.string;
    } else if (/^\d/.test(token)) {
      color = palette.number;
    } else if (keywords.has(token)) {
      color = palette.keyword;
    } else if (["true", "false", "null", "None", "True", "False"].includes(token)) {
      color = palette.literal;
    } else if (/^[{}()[\].,:;+\-*/%=<>!&|]+$/.test(token)) {
      color = palette.punctuation;
    } else if (code.slice(tokenPattern.lastIndex).trimStart().startsWith("(")) {
      color = palette.functionName;
    }

    pushTextNode(nodes, `token-${start}`, token, { color });
    cursor = start + token.length;
  }

  pushTextNode(nodes, "tail", code.slice(cursor));
  pushTextNode(nodes, "comment", comment, {
    color: palette.comment,
    fontStyle: "italic",
  });

  return nodes.length > 0 ? nodes : " ";
}

function renderInlineMarkdown(text: string, theme: WorkspaceTheme) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  const t = themeTokens[theme];

  return tokens.map((token, index) => {
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          className={cx(
            "ch-mono rounded-[3px] border px-1.5 py-0.5 text-[0.92em]",
            t.panelSoft,
          )}
          key={`${token}-${index}`}
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong className={t.text} key={`${token}-${index}`}>
          {token.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function MarkdownPreview({
  content,
  file,
  notesByLine,
  onSelectLine,
  selectedLine,
  theme,
}: {
  content: string;
  file: CodebaseFile;
  notesByLine: Map<string, CodeNote>;
  onSelectLine: (reference: LineReference) => void;
  selectedLine: LineReference | null;
  theme: WorkspaceTheme;
}) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  const t = themeTokens[theme];
  let index = 0;
  let orderedIndex = 0;

  const selectableLineClass = (lineNumber: number) => {
    const noted = notesByLine.has(lineNoteId(file.path, lineNumber));
    const selected =
      selectedLine?.path === file.path && selectedLine.line === lineNumber;

    return cx(
      "rounded-[4px] border-l-2 border-transparent pl-3 pr-2 transition duration-150",
      t.lineHover,
      noted && t.lineNoted,
      selected && t.lineActive,
    );
  };

  const selectLine = (lineNumber: number, lineContent: string) =>
    onSelectLine({ content: lineContent, line: lineNumber, path: file.path });

  while (index < lines.length) {
    const line = lines[index];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);

    if (line.trim().startsWith("```")) {
      const lineNumber = index + 1;
      const fenceLanguage = line.trim().replace(/```/, "") || "text";
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(
        <div
          className={selectableLineClass(lineNumber)}
          key={`fence-${index}`}
          onClick={() => selectLine(lineNumber, line)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              selectLine(lineNumber, line);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className={cx("my-4 overflow-hidden rounded-[6px] border", t.line)}>
            <div className={cx("border-b px-3 py-1.5 text-xs", t.line, t.muted)}>
              {fenceLanguage}
            </div>
            <pre
              className={cx(
                "ch-mono overflow-auto p-4 text-[15px] leading-8",
                t.canvasSoft,
                t.text,
              )}
            >
              {codeLines.map((codeLine, lineIndex) => (
                <div key={`${codeLine}-${lineIndex}`}>
                  {highlightCodeLine(
                    codeLine,
                    fenceLanguage,
                    syntaxPalettes[theme],
                  )}
                </div>
              ))}
            </pre>
          </div>
        </div>,
      );
    } else if (heading) {
      const lineNumber = index + 1;
      const level = heading[1].length;
      blocks.push(
        <div
          className={selectableLineClass(lineNumber)}
          key={`heading-${index}`}
          onClick={() => selectLine(lineNumber, line)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              selectLine(lineNumber, line);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div
            className={cx(
              "mt-5 border-b pb-2 font-black",
              level <= 1 ? "text-3xl" : level === 2 ? "text-2xl" : "text-lg",
              t.line,
              t.text,
            )}
          >
            {heading[2]}
          </div>
        </div>,
      );
    } else if (bullet || ordered) {
      const lineNumber = index + 1;
      const listMarker = ordered ? `${(orderedIndex += 1)}.` : "-";
      blocks.push(
        <div
          className={cx(
            selectableLineClass(lineNumber),
            "grid grid-cols-[28px_1fr] gap-3 py-1 text-[15px] leading-7",
            t.text,
          )}
          key={`list-${index}`}
          onClick={() => selectLine(lineNumber, line)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              selectLine(lineNumber, line);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className={cx("text-right", t.faint)}>{listMarker}</span>
          <span>{renderInlineMarkdown((bullet ?? ordered)?.[1] ?? "", theme)}</span>
        </div>,
      );
    } else if (line.trim().length === 0) {
      blocks.push(<div className="h-3" key={`space-${index}`} />);
    } else {
      const lineNumber = index + 1;
      blocks.push(
        <p
          className={cx(
            selectableLineClass(lineNumber),
            "py-1 text-[15px] leading-7",
            t.text,
          )}
          key={`p-${index}`}
          onClick={() => selectLine(lineNumber, line)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              selectLine(lineNumber, line);
            }
          }}
          role="button"
          tabIndex={0}
        >
          {renderInlineMarkdown(line, theme)}
        </p>,
      );
    }

    index += 1;
  }

  return (
    <article className={cx("min-h-full overflow-auto p-5", t.mdSurface)}>
      <div className="mx-auto max-w-[940px]">{blocks}</div>
    </article>
  );
}

function CodeViewer({
  file,
  notesByLine,
  onSelectLine,
  selectedLine,
  theme,
}: {
  file: CodebaseFile;
  notesByLine: Map<string, CodeNote>;
  onSelectLine: (reference: LineReference) => void;
  selectedLine: LineReference | null;
  theme: WorkspaceTheme;
}) {
  const language = languageForFile(file);
  const palette = syntaxPalettes[theme];
  const t = themeTokens[theme];
  const lines = file.content.split("\n");

  if (language === "markdown") {
    return (
      <MarkdownPreview
        content={file.content}
        file={file}
        notesByLine={notesByLine}
        onSelectLine={onSelectLine}
        selectedLine={selectedLine}
        theme={theme}
      />
    );
  }

  return (
    <div
      className={cx(
        "ch-mono min-h-full min-w-full w-max py-3 text-[15px] leading-8",
        t.canvas,
      )}
    >
      <div className="min-w-max">
        {lines.map((line, index) => (
          <div
            className={cx(
              "group flex min-h-8 min-w-full transition duration-150",
              t.lineHover,
              notesByLine.has(lineNoteId(file.path, index + 1)) && t.lineNoted,
              selectedLine?.path === file.path &&
                selectedLine.line === index + 1 &&
                t.lineActive,
            )}
            key={`${line}-${index}`}
          >
            <button
              className={cx(
                "relative w-[64px] shrink-0 select-none border-r px-4 text-right text-[13px] leading-8 transition duration-150",
                t.codeLine,
              )}
              onClick={() =>
                onSelectLine({
                  content: line,
                  line: index + 1,
                  path: file.path,
                })
              }
              type="button"
            >
              {notesByLine.has(lineNoteId(file.path, index + 1)) ? (
                <span className="absolute left-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current" />
              ) : null}
              {index + 1}
            </button>
            <pre
              className="m-0 flex-1 whitespace-pre py-0 pl-8 pr-10"
              style={{ color: palette.base, tabSize: 4 }}
            >
              {highlightCodeLine(line, language, palette)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InterviewWorkspace({
  session,
}: {
  session: CandidateAssessmentSession;
}) {
  const files = session.codeFiles;
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [theme, setTheme] = useState<WorkspaceTheme>("dark");
  const [activePath, setActivePath] = useState(files[0]?.path ?? "");
  const [openTabs, setOpenTabs] = useState<string[]>(() =>
    files[0]?.path ? [files[0].path] : [],
  );
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => {
    const open = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isDir) {
          open.add(node.path);
          walk(node.children);
        }
      }
    };
    walk(tree);
    return open;
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(() => initialSeconds(session));
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<LineReference | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState<CodeNote[]>([]);

  const { status, messages, interim, error, sessionId, speaking, interviewComplete, start, end } =
    useInterviewSession();

  // Auto-end when agent signals all rubric areas are covered
  useEffect(() => {
    if (interviewComplete && status === "live") {
      void end();
    }
  }, [interviewComplete, status, end]);

  const activeFile = files.find((file) => file.path === activePath) ?? files[0] ?? null;
  const activeName = activeFile ? activeFile.path.split("/").pop() : "";
  const activeContent = activeFile
    ? edits[activeFile.path] ?? activeFile.content
    : "";

  const codeRef = useRef("");
  useEffect(() => {
    codeRef.current = buildOpenFileSnapshot(files, openTabs, activePath);
  }, [activePath, files, openTabs]);

  const startArgsRef = useRef({
    candidate_name: session.candidateName,
    problem_id: session.assessmentId,
    problem_title: session.title,
    problem_statement: buildProblemStatement(session),
    question_guidelines: session.rubric,
  });
  useEffect(() => {
    void start({ ...startArgsRef.current, getCode: () => codeRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 0 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const feedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages, interim]);

  function toggleDir(path: string) {
    setOpenDirs((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function openFile(path: string) {
    setOpenTabs((previous) =>
      previous.includes(path) ? previous : [...previous, path],
    );
    setActivePath(path);
  }

  function closeFile(path: string) {
    const index = openTabs.indexOf(path);
    const next = openTabs.filter((tabPath) => tabPath !== path);
    setOpenTabs(next);

    if (activePath === path) {
      setActivePath(next[index] ?? next[index - 1] ?? "");
    }
  }

  function selectLine(reference: LineReference) {
    const id = lineNoteId(reference.path, reference.line);
    setSelectedLine(reference);
    setNoteDraft(notesByLine.get(id)?.note ?? "");
    setNotesOpen(true);
  }

  function saveNote() {
    if (!selectedLine) return;
    const note = noteDraft.trim();
    if (!note) return;

    const id = lineNoteId(selectedLine.path, selectedLine.line);
    setNotes((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id
            ? {
                ...item,
                content: selectedLine.content,
                note,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          ...selectedLine,
          id,
          note,
        },
      ];
    });
  }

  function removeNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
    if (selectedLine && id === lineNoteId(selectedLine.path, selectedLine.line)) {
      setNoteDraft("");
    }
  }

  function openNote(note: CodeNote) {
    openFile(note.path);
    setSelectedLine({
      content: note.content,
      line: note.line,
      path: note.path,
    });
    setNoteDraft(note.note);
    setNotesOpen(true);
  }

  async function handleEnd() {
    if (status === "ending" || status === "ended") return;
    if (!window.confirm("End the assessment and submit for review?")) return;
    await end();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  const dotColor =
    status === "live"
      ? t.liveDot
      : status === "error"
        ? "bg-[#ffb4ab]"
        : t.idleDot;
  const statusLabel =
    status === "live"
      ? "Recording"
      : status === "connecting"
        ? "Connecting"
        : status === "ending"
          ? "Submitting"
          : status === "ended"
            ? "Submitted"
            : status === "error"
              ? "Connection error"
              : "Idle";

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      const indent = { paddingLeft: depth * 18 + 8 };

      if (node.isDir) {
        const open = openDirs.has(node.path);
        return (
          <div key={node.path}>
            <button
              className={cx(
                "group flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-[15px] transition duration-150",
                t.muted,
                t.hover,
              )}
              onClick={() => toggleDir(node.path)}
              style={indent}
              type="button"
            >
              <ChevronDown
                className={cx(
                  "h-4 w-4 shrink-0 transition-transform",
                  t.faint,
                  !open && "-rotate-90",
                )}
              />
              <Folder className={cx("h-4 w-4 shrink-0", t.faint)} />
              <span className="truncate">{node.name}</span>
            </button>
            {open ? renderNodes(node.children, depth + 1) : null}
          </div>
        );
      }

      const active = node.path === activePath;
      return (
        <button
          className={cx(
            "relative flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-[15px] transition duration-150",
            active
              ? `${t.active} before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-current before:content-['']`
              : `${t.muted} ${t.hover}`,
          )}
          key={node.path}
          onClick={() => openFile(node.path)}
          style={indent}
          type="button"
        >
          <span className="ch-mono w-7 shrink-0 text-center text-xs font-bold">
            {fileGlyph(node.name)}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      );
    });

  return (
    <div
      className={cx(
        "ch-workspace fixed inset-0 flex flex-col overflow-hidden",
        t.root,
      )}
      data-theme={theme}
      style={
        {
          "--ch-scrollbar": t.scrollbar,
          "--ch-scrollbar-hover": t.scrollbarHover,
        } as CSSProperties
      }
    >
      <style>{workspaceCss}</style>

      <header
        className={cx(
          "flex min-h-[64px] shrink-0 items-center justify-between gap-3 border-b px-4 py-2",
          t.header,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0">
            <p className={cx("text-lg font-black leading-none", t.text)}>
              Chayote
            </p>
            <p className={cx("mt-1 text-[10px] font-bold uppercase", t.muted)}>
              {session.candidateName}
            </p>
          </div>
          <div className={cx("hidden h-7 w-px sm:block", t.line)} />
          <div className="hidden min-w-0 sm:block">
            <p className={cx("truncate text-[13px] font-bold", t.text)}>
              {session.title}
            </p>
            <p className={cx("mt-1 truncate text-[10px] uppercase", t.muted)}>
              {stack || "Assessment"} - {session.timeLimitMinutes} minutes
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-pressed={panelOpen}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-[11px] font-bold uppercase transition duration-150",
              panelOpen ? t.buttonActive : t.button,
            )}
            onClick={() => setPanelOpen((value) => !value)}
            type="button"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">Interview</span>
          </button>
          <div className={cx("flex h-8 items-center gap-2 border px-2.5", t.panel)}>
            <Clock className={t.muted} size={14} />
            <span className="ch-mono text-xs font-bold">
              {formatClock(secondsLeft)}
            </span>
          </div>
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "light"}
            className={cx(
              "grid h-8 w-8 place-items-center rounded-[3px] border transition duration-150",
              t.button,
            )}
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            type="button"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-xs font-bold transition duration-150",
              t.danger,
            )}
            disabled={status === "ending" || status === "ended"}
            onClick={handleEnd}
            type="button"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">End session</span>
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={cx("hidden w-[248px] shrink-0 flex-col border-r md:flex", t.panel)}>
          <div
            className={cx(
              "flex items-center justify-between border-b px-3 py-3 text-[11px] font-bold uppercase",
              t.line,
              t.muted,
            )}
          >
            <span>Codebase</span>
            <Folder size={14} />
          </div>
          <div className="ch-mono flex-1 overflow-y-auto px-2 py-1">
            {files.length > 0 ? (
              renderNodes(tree, 0)
            ) : (
              <p className={cx("px-2 py-2 text-xs", t.faint)}>
                No files loaded.
              </p>
            )}
          </div>
        </aside>

        <section className={cx("flex min-w-0 flex-1 flex-col", t.canvas)}>
          <div
            className={cx(
              "flex h-10 shrink-0 items-stretch justify-between gap-2 border-b pl-2 pr-2",
              t.header,
            )}
          >
            <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
              {openTabs.length > 0 ? (
                openTabs.map((path) => {
                  const active = path === activePath;
                  return (
                    <div
                      className={cx(
                        "mr-1 inline-flex h-full max-w-[260px] shrink-0 items-center border border-t-0 border-b-2 text-sm transition duration-150",
                        active ? t.tabActive : t.tab,
                      )}
                      key={path}
                    >
                      <button
                        className="inline-flex min-w-0 flex-1 items-center gap-2 px-3"
                        onClick={() => setActivePath(path)}
                        type="button"
                      >
                        <span className="ch-mono text-xs font-bold">
                          {fileGlyph(path)}
                        </span>
                        <span className="truncate">{fileName(path)}</span>
                      </button>
                      <button
                        aria-label={`Close ${fileName(path)}`}
                        className={cx(
                          "mr-2 grid h-5 w-5 shrink-0 place-items-center rounded-[3px]",
                          active ? "hover:bg-white/15" : "hover:bg-black/10",
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          closeFile(path);
                        }}
                        type="button"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className={cx("px-2 text-sm", t.faint)}>Open a file.</p>
              )}
            </div>
            <button
              aria-pressed={notesOpen}
              className={cx(
                "my-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border px-2.5 text-[11px] font-bold uppercase transition duration-150",
                notesOpen ? t.buttonActive : t.button,
              )}
              onClick={() => setNotesOpen((value) => !value)}
              type="button"
            >
              <FileText size={13} />
              <span className="hidden sm:inline">
                Notes{notes.length > 0 ? ` ${notes.length}` : ""}
              </span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {activeFile ? (
              <CodeViewer
                file={activeFile}
                notesByLine={notesByLine}
                onSelectLine={selectLine}
                selectedLine={selectedLine}
                theme={theme}
              />
            ) : (
              <div className={cx("grid h-full place-items-center", t.canvasSoft)}>
                <div className="text-center">
                  <FileText className={cx("mx-auto", t.faint)} size={34} />
                  <p className={cx("mt-3 text-sm font-semibold", t.muted)}>
                    Select a file from the codebase.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {notesOpen ? (
          <aside
            className={cx(
              "hidden w-[320px] shrink-0 flex-col border-l xl:flex",
              t.notePanel,
            )}
          >
            <div
              className={cx(
                "flex h-10 items-center justify-between border-b px-3",
                t.line,
              )}
            >
              <span className={cx("text-[11px] font-bold uppercase", t.muted)}>
                Notes
              </span>
              <button
                aria-label="Close notes"
                className={cx("rounded-[3px] p-1 transition duration-150", t.hover)}
                onClick={() => setNotesOpen(false)}
                type="button"
              >
                <X size={15} />
              </button>
            </div>

            {selectedLine ? (
              <div className={cx("border-b p-3", t.line)}>
                <p className={cx("truncate text-xs font-bold", t.text)}>
                  {fileName(selectedLine.path)}:{selectedLine.line}
                </p>
                <p className={cx("mt-2 line-clamp-2 text-xs leading-5", t.muted)}>
                  {selectedLine.content.trim() || "Blank line"}
                </p>
                <textarea
                  className={cx(
                    "mt-3 h-24 w-full resize-none rounded-[3px] border bg-transparent p-2 text-sm leading-6 outline-none transition duration-150 focus:border-current",
                    t.line,
                    t.text,
                  )}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Add note..."
                  value={noteDraft}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className={cx(
                      "inline-flex h-8 items-center rounded-[3px] border px-3 text-xs font-bold transition duration-150 disabled:cursor-not-allowed disabled:opacity-45",
                      t.button,
                    )}
                    disabled={!noteDraft.trim()}
                    onClick={saveNote}
                    type="button"
                  >
                    Save note
                  </button>
                  {notesByLine.has(
                    lineNoteId(selectedLine.path, selectedLine.line),
                  ) ? (
                    <button
                      className={cx(
                        "inline-flex h-8 items-center rounded-[3px] px-2.5 text-xs font-bold transition duration-150",
                        t.danger,
                      )}
                      onClick={() =>
                        removeNote(lineNoteId(selectedLine.path, selectedLine.line))
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <button
                    className={cx(
                      "mb-2 block w-full rounded-[4px] border p-2 text-left transition duration-150",
                      t.line,
                      t.hover,
                    )}
                    key={note.id}
                    onClick={() => openNote(note)}
                    type="button"
                  >
                    <span className={cx("block truncate text-xs font-bold", t.text)}>
                      {fileName(note.path)}:{note.line}
                    </span>
                    <span
                      className={cx(
                        "mt-1 block line-clamp-2 text-xs leading-5",
                        t.muted,
                      )}
                    >
                      {note.note}
                    </span>
                  </button>
                ))
              ) : (
                <p className={cx("p-2 text-xs leading-5", t.faint)}>
                  No notes yet.
                </p>
              )}
            </div>
          </aside>
        ) : null}

        {panelOpen ? (
          <aside
            className={cx(
              "hidden w-[360px] shrink-0 flex-col border-l lg:flex",
              t.panelSoft,
            )}
          >
            <div
              className={cx(
                "flex items-center justify-between border-b px-3 py-2.5",
                t.line,
              )}
            >
              <span className={cx("text-[11px] font-bold uppercase", t.muted)}>
                Interview
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "flex items-center gap-1.5 text-[11px] font-semibold",
                    status === "error" ? "text-[#ffb4ab]" : t.muted,
                  )}
                >
                  <span className={cx("h-1.5 w-1.5 rounded-full", dotColor)} />
                  {statusLabel}
                </span>
                <button
                  aria-label="Close interview panel"
                  className={cx("rounded-[3px] p-1 transition duration-150", t.hover)}
                  onClick={() => setPanelOpen(false)}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.length === 0 && status === "connecting" ? (
                <p className={cx("flex items-center gap-2 text-xs", t.muted)}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connecting to the interviewer...
                </p>
              ) : null}

              {messages.map((message) =>
                message.role === "agent" ? (
                  <div key={message.id} className="flex gap-2">
                    <Bot className={cx("mt-0.5 h-4 w-4 shrink-0", t.text)} />
                    <div
                      className={cx(
                        "rounded-[6px] rounded-tl-none border px-3 py-2 text-xs leading-6 whitespace-pre-wrap",
                        t.agentBubble,
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-end gap-2">
                    <div
                      className={cx(
                        "rounded-[6px] rounded-tr-none px-3 py-2 text-xs leading-6 whitespace-pre-wrap",
                        t.userBubble,
                      )}
                    >
                      {message.text}
                    </div>
                    <Mic className={cx("mt-0.5 h-4 w-4 shrink-0", t.faint)} />
                  </div>
                ),
              )}

              {interim ? (
                <div className="flex justify-end gap-2">
                  <div
                    className={cx(
                      "rounded-[6px] rounded-tr-none border border-dashed px-3 py-2 text-xs italic",
                      t.line,
                      t.muted,
                    )}
                  >
                    {interim}
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className={cx("border-t px-3 py-2 text-xs", t.error)}>
                {error}
              </div>
            ) : null}

            <div
              className={cx(
                "border-t px-3 py-2 text-[11px] leading-5",
                t.line,
                t.faint,
              )}
            >
              {sessionId ? `Session ${sessionId.slice(0, 8)} - ` : ""}Speak
              naturally. The interviewer responds when you pause.
            </div>
          </aside>
        ) : null}
      </main>

      {status === "ending" || status === "ended" ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className={cx(
              "w-[380px] max-w-[90vw] rounded-[8px] border p-6 text-center",
              t.panel,
            )}
          >
            {status === "ending" ? (
              <>
                <Loader2 className={cx("mx-auto h-7 w-7 animate-spin", t.text)} />
                <h2 className={cx("mt-4 text-base font-bold", t.text)}>
                  Submitting your interview...
                </h2>
                <p className={cx("mt-2 text-xs leading-6", t.muted)}>
                  Uploading the recording and starting analysis. Please keep this
                  tab open.
                </p>
              </>
            ) : (
              <>
                <div
                  className={cx(
                    "mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black",
                    t.buttonActive,
                  )}
                >
                  OK
                </div>
                <h2 className={cx("mt-4 text-base font-bold", t.text)}>
                  Interview submitted
                </h2>
                <p className={cx("mt-2 text-xs leading-6", t.muted)}>
                  Your session is being processed. The recruiter will see your
                  results on their dashboard.
                </p>
                <button
                  className={cx(
                    "mt-5 inline-flex h-8 items-center rounded-[3px] border px-3 text-xs font-bold transition duration-150",
                    t.button,
                  )}
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  Return to lobby
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
