// client/src/components/groups/MarkdownDescription.tsx
//
// Two exports:
//   <MarkdownEditor value={...} onChange={...} />   — for GroupManage (editing)
//   <MarkdownRenderer content={...} />               — for GroupProfile (display)
//
// No external markdown library needed — editor uses plain textarea with a
// formatting toolbar. Renderer uses a lightweight in-component parser that
// handles the subset of markdown a group description realistically uses.

import { useRef } from "react";
import { Bold, Italic, List, Link as LinkIcon, Heading2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ── Editor ────────────────────────────────────────────────────────────────

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 8 }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string, defaultText: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || defaultText;
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    // Restore selection after React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertLine(prefix: string, defaultText: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    // Find start of line
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", start);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const line = value.slice(lineStart, end);
    // Toggle: if line already starts with prefix, remove it
    const next = line.startsWith(prefix)
      ? value.slice(0, lineStart) + line.slice(prefix.length) + value.slice(end)
      : value.slice(0, lineStart) + prefix + (line || defaultText) + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.focus());
  }

  const tools = [
    {
      icon: <Bold className="w-3.5 h-3.5" />,
      label: "Bold",
      action: () => wrap("**", "**", "bold text"),
    },
    {
      icon: <Italic className="w-3.5 h-3.5" />,
      label: "Italic",
      action: () => wrap("_", "_", "italic text"),
    },
    {
      icon: <Heading2 className="w-3.5 h-3.5" />,
      label: "Heading",
      action: () => insertLine("## ", "Heading"),
    },
    {
      icon: <List className="w-3.5 h-3.5" />,
      label: "List item",
      action: () => insertLine("- ", "List item"),
    },
    {
      icon: <LinkIcon className="w-3.5 h-3.5" />,
      label: "Link",
      action: () => wrap("[", "](url)", "link text"),
    },
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-muted/40 border-b border-border">
        {tools.map(tool => (
          <Button
            key={tool.label}
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 rounded-md hover:bg-muted"
            title={tool.label}
            onMouseDown={e => {
              e.preventDefault(); // keep focus in textarea
              tool.action();
            }}
          >
            {tool.icon}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground pr-1 select-none">Markdown</span>
      </div>

      {/* Textarea */}
      <Textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "Describe your group… supports **bold**, _italic_, ## headings, - lists"}
        rows={rows}
        className="rounded-none border-0 focus-visible:ring-0 resize-y min-h-[120px]"
      />
    </div>
  );
}

// ── Renderer ──────────────────────────────────────────────────────────────
// Parses a small but practical subset of markdown:
//   ## Heading 2   ### Heading 3
//   **bold**        _italic_
//   - list item     blank line → paragraph break
//   [text](url)

interface RendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: RendererProps) {
  if (!content?.trim()) return null;

  // Split into blocks on blank lines
  const blocks = content.split(/\n{2,}/);

  const renderInline = (text: string, key: number) => {
    // Process inline: **bold**, _italic_, [text](url)
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let i = 0;

    while (remaining.length > 0) {
      // Bold
      const bold = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
      // Italic
      const italic = remaining.match(/^(.*?)_(.+?)_(.*)/s);
      // Link
      const link = remaining.match(/^(.*?)\[(.+?)\]\((.+?)\)(.*)/s);

      // Find the earliest match
      const candidates = [
        bold ? { type: "bold", index: bold[1].length, match: bold } : null,
        italic ? { type: "italic", index: italic[1].length, match: italic } : null,
        link ? { type: "link", index: link[1].length, match: link } : null,
      ].filter(Boolean) as { type: string; index: number; match: RegExpMatchArray }[];

      if (candidates.length === 0) {
        parts.push(<span key={i++}>{remaining}</span>);
        break;
      }

      const earliest = candidates.reduce((a, b) => (a.index <= b.index ? a : b));
      const { type, match } = earliest;

      // Text before the match
      if (match[1]) parts.push(<span key={i++}>{match[1]}</span>);

      if (type === "bold") {
        parts.push(<strong key={i++} className="font-semibold">{match[2]}</strong>);
        remaining = match[3];
      } else if (type === "italic") {
        parts.push(<em key={i++}>{match[2]}</em>);
        remaining = match[3];
      } else if (type === "link") {
        parts.push(
          <a key={i++} href={match[3]} target="_blank" rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80">
            {match[2]}
          </a>
        );
        remaining = match[4];
      }
    }

    return <>{parts}</>;
  };

  const renderBlock = (block: string, blockIdx: number) => {
    const lines = block.split("\n").filter(l => l.trim() !== "");

    // All lines are list items
    if (lines.every(l => l.startsWith("- ") || l.startsWith("* "))) {
      return (
        <ul key={blockIdx} className="list-disc list-inside space-y-1 text-muted-foreground">
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^[-*]\s/, ""), i)}</li>
          ))}
        </ul>
      );
    }

    // Single-line headings
    if (lines.length === 1) {
      const h2 = lines[0].match(/^##\s+(.+)/);
      const h3 = lines[0].match(/^###\s+(.+)/);
      if (h2) return <h2 key={blockIdx} className="text-lg font-semibold mt-1">{h2[1]}</h2>;
      if (h3) return <h3 key={blockIdx} className="text-base font-semibold mt-1">{h3[1]}</h3>;
    }

    // Paragraph — render each line, join with <br> inside the paragraph
    return (
      <p key={blockIdx} className="text-muted-foreground leading-relaxed">
        {lines.map((line, i) => {
          const h2 = line.match(/^##\s+(.+)/);
          const h3 = line.match(/^###\s+(.+)/);
          if (h2) return <><h2 key={i} className="text-lg font-semibold mt-2 text-foreground">{h2[1]}</h2></>;
          if (h3) return <><h3 key={i} className="text-base font-semibold mt-1 text-foreground">{h3[1]}</h3></>;
          return (
            <span key={i}>
              {i > 0 && <br />}
              {renderInline(line, i)}
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => renderBlock(block.trim(), i))}
    </div>
  );
}
