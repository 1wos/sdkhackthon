"use client";

import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./mermaid-diagram";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

const MemoizedMarkdownBlock = memo(
  ({ content, blockIndex }: { content: string; blockIndex?: number }) => {
    return (
      <div className="prose text-foreground prose-headings:font-medium prose-h1:text-2xl prose-sm dark:prose-invert prose-neutral prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-muted-foreground prose-code:rounded-sm prose-code:border prose-code:bg-card prose-code:px-1 prose-code:before:content-none prose-code:after:content-none prose-code:font-normal prose-pre:p-0 prose-pre:bg-background max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            code: ({ inline, children, className, ...props }: any) => {
              const isInline = inline ?? !className;
              const match = /language-(\w+)/.exec(className || "");
              const lang = match ? match[1] : "";

              // Render Mermaid diagrams
              if (!isInline && lang === "mermaid") {
                const chartCode = String(children).replace(/\n$/, "");
                return <MermaidDiagram chart={chartCode} id={`block-${blockIndex}`} />;
              }

              if (isInline) {
                return (
                  <code
                    className="bg-muted text-muted-foreground inline rounded px-1 py-px font-mono text-xs"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <pre className="border-border my-3 max-h-[500px] overflow-auto rounded-md border p-3 font-mono text-xs">
                  <code {...props}>{children}</code>
                </pre>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content;
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);

    return (
      <div className="space-y-2">
        {blocks.map((block, index) => (
          <MemoizedMarkdownBlock content={block} blockIndex={index} key={`${id}-block_${index}`} />
        ))}
      </div>
    );
  }
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
