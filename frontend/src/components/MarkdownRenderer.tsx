import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onCitationClick?: (docIndex: number) => void;
}

/**
 * XSS-safe, zero-dependency Markdown renderer for SITEWISE Assistant responses.
 * Supports headings, bold/italics, lists, blockquotes, code blocks, tables,
 * horizontal rules, and interactive [DOC-N] citation badges.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  onCitationClick,
}) => {
  if (!content) return null;

  // Split content into block tokens
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`markdown-body space-y-2.5 text-xs text-gray-200 font-sans leading-relaxed ${className}`}>
      {blocks.map((block, idx) => renderBlock(block, idx, onCitationClick))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Block Parser
// ---------------------------------------------------------------------------

interface MarkdownBlock {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'ul' | 'ol' | 'table' | 'hr' | 'quote' | 'code';
  content?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  language?: string;
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Empty lines
    if (!line) {
      i++;
      continue;
    }

    // Horizontal Rule (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings (#, ##, ###, ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      const hType = (`h${level}` as const);
      blocks.push({ type: hType, content: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Blockquote (> ...)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('>') || (lines[i].trim() && quoteLines.length > 0 && !lines[i].trim().startsWith('#')))) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', content: quoteLines.join(' ') });
      continue;
    }

    // Code block (``` ... ```)
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      blocks.push({ type: 'code', content: codeLines.join('\n'), language: lang });
      continue;
    }

    // Table detection: line contains '|' and next line looks like delimiter '|---|'
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1])) {
      const headerLine = lines[i];
      const headers = parseTableRow(headerLine);
      i += 2; // skip header and delimiter

      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && !lines[i].trim().startsWith('#')) {
        const rowCells = parseTableRow(lines[i]);
        if (rowCells.length > 0) {
          // Pad row cells to match header length
          while (rowCells.length < headers.length) {
            rowCells.push('');
          }
          rows.push(rowCells.slice(0, headers.length));
        }
        i++;
      }

      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Unordered List (- item or * item)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered List (1. item)
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Regular paragraph (accumulate multi-line paragraph)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', content: paraLines.join(' ') });
  }

  return blocks;
}

function parseTableRow(rowLine: string): string[] {
  let cleaned = rowLine.trim();
  if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
  if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
  return cleaned.split('|').map(c => c.trim());
}

// ---------------------------------------------------------------------------
// Block Renderer
// ---------------------------------------------------------------------------

function renderBlock(
  block: MarkdownBlock,
  key: number,
  onCitationClick?: (docIndex: number) => void
): React.ReactNode {
  switch (block.type) {
    case 'h1':
      return (
        <h1 key={key} className="text-sm font-bold text-amber-400 mt-3 mb-1 pb-1 border-b border-neutral-800">
          {renderInline(block.content || '', onCitationClick)}
        </h1>
      );
    case 'h2':
      return (
        <h2 key={key} className="text-xs font-bold text-amber-300 mt-2.5 mb-1 tracking-wide uppercase">
          {renderInline(block.content || '', onCitationClick)}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={key} className="text-xs font-semibold text-gray-200 mt-2 mb-0.5">
          {renderInline(block.content || '', onCitationClick)}
        </h3>
      );
    case 'h4':
      return (
        <h4 key={key} className="text-[11px] font-semibold text-gray-300 mt-1.5 mb-0.5">
          {renderInline(block.content || '', onCitationClick)}
        </h4>
      );
    case 'hr':
      return <hr key={key} className="border-neutral-800 my-2.5" />;
    case 'quote':
      return (
        <blockquote
          key={key}
          className="border-l-2 border-amber-400/60 pl-3 py-1 my-1.5 italic text-gray-300 bg-amber-500/5 rounded-r"
        >
          {renderInline(block.content || '', onCitationClick)}
        </blockquote>
      );
    case 'code':
      return (
        <pre
          key={key}
          className="p-3 my-2 rounded bg-black/60 border border-neutral-800 font-mono text-[11px] text-amber-300 overflow-x-auto whitespace-pre"
        >
          <code>{block.content}</code>
        </pre>
      );
    case 'ul':
      return (
        <ul key={key} className="list-disc pl-4 space-y-1 my-1.5 text-gray-300">
          {block.items?.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, onCitationClick)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="list-decimal pl-4 space-y-1 my-1.5 text-gray-300">
          {block.items?.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, onCitationClick)}
            </li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div key={key} className="overflow-x-auto my-2.5 rounded border border-neutral-800 shadow-sm">
          <table className="min-w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-800/90 border-b border-neutral-700">
                {block.headers?.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold text-[11px] text-amber-300 tracking-wider">
                    {renderInline(h, onCitationClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {block.rows?.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={rIdx % 2 === 0 ? 'bg-neutral-900/50 hover:bg-neutral-800/40' : 'bg-black/30 hover:bg-neutral-800/40'}
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-gray-300 align-top leading-normal">
                      {renderInline(cell, onCitationClick)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'p':
    default:
      return (
        <p key={key} className="leading-relaxed text-gray-200">
          {renderInline(block.content || '', onCitationClick)}
        </p>
      );
  }
}

// ---------------------------------------------------------------------------
// Inline Renderer (Bold, Italic, Code, Citations, Links, Line Breaks)
// ---------------------------------------------------------------------------

function renderInline(
  text: string,
  onCitationClick?: (docIndex: number) => void
): React.ReactNode {
  if (!text) return null;

  // Handle explicit <br> tags often generated inside table cells
  if (text.includes('<br>') || text.includes('<br/>') || text.includes('<br />')) {
    const parts = text.split(/<br\s*\/?>/i);
    return parts.map((part, idx) => (
      <React.Fragment key={idx}>
        {idx > 0 && <br />}
        {renderInlineSegment(part, onCitationClick)}
      </React.Fragment>
    ));
  }

  return renderInlineSegment(text, onCitationClick);
}

function renderInlineSegment(
  text: string,
  onCitationClick?: (docIndex: number) => void
): React.ReactNode {
  // Regex to tokenise:
  // 1. [DOC-N] citation badges
  // 2. [Link Text](url)
  // 3. `inline code`
  // 4. **bold** or __bold__
  // 5. *italic* or _italic_
  const tokenRegex = /(\[DOC-\d+\]|\[.*?\]\(https?:\/\/[^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // 1. Citation badge [DOC-N]
    const docMatch = part.match(/^\[DOC-(\d+)\]$/i);
    if (docMatch) {
      const docNum = parseInt(docMatch[1], 10);
      return (
        <span
          key={index}
          onClick={() => onCitationClick && onCitationClick(docNum)}
          className={`inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 select-none ${
            onCitationClick ? 'cursor-pointer hover:bg-amber-500/30 transition-colors' : ''
          }`}
          title={`Source Citation DOC-${docNum}`}
        >
          DOC-{docNum}
        </span>
      );
    }

    // 2. Link [Text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // 3. Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1 py-0.2 rounded bg-neutral-800 text-amber-300 font-mono text-[10px] border border-neutral-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // 4. Bold **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 5. Italic *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      return (
        <em key={index} className="italic text-gray-300">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Plain text
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
