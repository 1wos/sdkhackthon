"use client";

import { Fragment, useEffect, useState, memo } from "react";
import { AlertTriangle, ChevronRight, Code, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { MermaidDiagram } from "@/components/chat/mermaid-diagram";

type ViewMode = "preview" | "source";

interface FileViewerProps {
  selectedFilePath: string | null;
  selectedFileContent: string;
  isLoadingContent: boolean;
  contentError: string | null;
}

function FileViewerComponent({
  selectedFilePath,
  selectedFileContent,
  isLoadingContent,
  contentError,
}: FileViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");

  const fileContentString = selectedFileContent || "";

  // Check file types for preview support
  const isMarkdownFile =
    selectedFilePath?.endsWith(".md") ||
    selectedFilePath?.endsWith(".markdown");
  const isHtmlFile =
    selectedFilePath?.endsWith(".html") || selectedFilePath?.endsWith(".htm");

  const hasPreviewSupport = isMarkdownFile || isHtmlFile;

  // Reset to preview mode when file changes (if it supports preview)
  useEffect(() => {
    if (hasPreviewSupport) {
      setViewMode("preview");
    } else {
      setViewMode("source");
    }
  }, [selectedFilePath, hasPreviewSupport]);

  // Syntax highlight the code
  useEffect(() => {
    if (!fileContentString || viewMode === "preview") {
      setHighlightedHtml("");
      return;
    }

    const lang = getLanguageFromPath(selectedFilePath || "");
    codeToHtml(fileContentString, {
      lang: lang || "text",
      theme: "github-dark",
    })
      .then(setHighlightedHtml)
      .catch(() => setHighlightedHtml(""));
  }, [fileContentString, selectedFilePath, viewMode]);

  const filePathHeader = (
    <div className="text-muted-foreground flex items-center justify-between px-4 py-2 text-sm border-b border-border">
      <div className="flex items-center gap-0.5">
        {selectedFilePath &&
          selectedFilePath
            .split("/")
            .filter((part) => part && part !== "workspace")
            .map((part, index) => (
              <Fragment key={index}>
                {index > 0 && (
                  <span className="text-muted-foreground">
                    <ChevronRight className="size-3" />
                  </span>
                )}
                <span className="text-muted-foreground leading-tight">
                  {part}
                </span>
              </Fragment>
            ))}
      </div>
      <div className="flex items-center gap-2">
        {hasPreviewSupport && selectedFilePath && (
          <div className="flex items-center rounded-md border border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 rounded-r-none px-2",
                    viewMode === "preview" && "bg-muted"
                  )}
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Preview</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 rounded-l-none px-2",
                    viewMode === "source" && "bg-muted"
                  )}
                  onClick={() => setViewMode("source")}
                >
                  <Code className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Source</TooltipContent>
            </Tooltip>
          </div>
        )}
        {selectedFilePath && (
          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
            Read-only
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-background flex size-full flex-col">
      {filePathHeader}
      <div className="relative flex-1 overflow-hidden">
        {(isLoadingContent || contentError || !selectedFilePath) && (
          <div className="bg-background text-muted-foreground absolute inset-0 z-10 flex select-none items-center justify-center gap-2 text-sm">
            {isLoadingContent ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin opacity-60" />
                Loading file content
              </div>
            ) : contentError ? (
              <div className="flex items-center justify-center gap-2 break-words leading-none">
                <AlertTriangle className="text-destructive size-4 shrink-0" />
                Error loading file: {contentError || "Unknown error"}
              </div>
            ) : (
              <div>No file selected</div>
            )}
          </div>
        )}
        {viewMode === "preview" && isMarkdownFile && fileContentString ? (
          <div className="h-full overflow-auto p-4 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                code: ({ inline, children, className, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const lang = match ? match[1] : "";
                  if (!inline && lang === "mermaid") {
                    const chartCode = String(children).replace(/\n$/, "");
                    return <MermaidDiagram chart={chartCode} id={`fv-${Date.now()}`} />;
                  }
                  if (inline) {
                    return <code className={className} {...props}>{children}</code>;
                  }
                  return (
                    <pre className="border-border my-3 max-h-[500px] overflow-auto rounded-md border p-3 font-mono text-xs">
                      <code {...props}>{children}</code>
                    </pre>
                  );
                },
              }}
            >
              {fileContentString}
            </ReactMarkdown>
          </div>
        ) : viewMode === "preview" && isHtmlFile && fileContentString ? (
          <iframe
            srcDoc={fileContentString}
            className="h-full w-full bg-white"
            sandbox="allow-scripts"
            title="HTML Preview"
          />
        ) : fileContentString ? (
          <div className="h-full overflow-auto">
            {highlightedHtml ? (
              <div
                className="shiki-container text-sm p-4 [&>pre]:!bg-transparent [&>pre]:!p-0"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <pre className="text-sm p-4 font-mono whitespace-pre-wrap">
                {fileContentString}
              </pre>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    sql: "sql",
    graphql: "graphql",
    dockerfile: "dockerfile",
    makefile: "makefile",
    gitignore: "gitignore",
  };
  return langMap[ext] || "text";
}

export const FileViewer = memo(FileViewerComponent, (prevProps, nextProps) => {
  return (
    prevProps.selectedFilePath === nextProps.selectedFilePath &&
    prevProps.selectedFileContent === nextProps.selectedFileContent &&
    prevProps.isLoadingContent === nextProps.isLoadingContent &&
    prevProps.contentError === nextProps.contentError
  );
});
