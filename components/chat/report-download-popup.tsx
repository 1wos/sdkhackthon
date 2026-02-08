"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { marked } from "marked";
import type { FileInfo } from "@/lib/types";

interface ReportDownloadPopupProps {
  conversationId: string | null;
  isCompleted: boolean;
  refreshTrigger?: number;
}

type DownloadFormat = "pdf" | "md" | "summary";

const PDF_STYLES = `
  .pdf-content {
    margin: 0;
    padding: 32px 40px;
    box-sizing: border-box;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1a1a2e;
    line-height: 1.7;
    font-size: 13px;
    background: white;
  }
  .pdf-content * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    color: inherit;
    border-color: #e5e5e5;
  }
  .pdf-content h1 {
    font-size: 24px;
    font-weight: 700;
    color: #ea580c;
    border-bottom: 2px solid #f97316;
    padding-bottom: 8px;
    margin-top: 24px;
    margin-bottom: 14px;
  }
  .pdf-content h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a2e;
    margin-top: 20px;
    margin-bottom: 10px;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 5px;
  }
  .pdf-content h3 {
    font-size: 15px;
    font-weight: 600;
    color: #374151;
    margin-top: 16px;
    margin-bottom: 6px;
  }
  .pdf-content p { margin: 6px 0; }
  .pdf-content ul, .pdf-content ol { padding-left: 22px; margin: 6px 0; }
  .pdf-content li { margin: 3px 0; }
  .pdf-content blockquote {
    border-left: 3px solid #f97316;
    padding: 6px 14px;
    margin: 10px 0;
    background: #fff7ed;
    color: #374151;
    font-style: italic;
  }
  .pdf-content code {
    background: #f3f4f6;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11px;
    font-family: 'Courier New', monospace;
    color: #1a1a2e;
  }
  .pdf-content pre {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 11px;
    margin: 10px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .pdf-content pre code {
    background: none;
    padding: 0;
    color: inherit;
  }
  .pdf-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 11px;
  }
  .pdf-content th {
    background: #f97316;
    color: white;
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
  }
  .pdf-content td {
    border: 1px solid #e5e5e5;
    padding: 6px 10px;
    color: #1a1a2e;
  }
  .pdf-content tr:nth-child(even) { background: #fafafa; }
  .pdf-content strong { color: #ea580c; }
  .pdf-content a { color: #2563eb; text-decoration: underline; }
  .pdf-content hr { border: none; border-top: 1px solid #e5e5e5; margin: 16px 0; }
  .pdf-content img { max-width: 100%; height: auto; }
  .header-badge {
    display: inline-block;
    background: linear-gradient(135deg, #f97316, #ea580c);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 12px;
  }
`;

async function generatePdf(
  htmlContent: string,
  filename: string
): Promise<void> {
  // Dynamic imports for browser-only libraries
  const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);
  const html2canvas = html2canvasModule.default;

  // Overlay: covers the screen so user sees "Generating PDF..." while content renders behind it
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML =
    '<div style="color:white;font-size:14px;font-family:sans-serif;display:flex;align-items:center;gap:8px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Generating PDF...</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(overlay);

  // Render container: appended to <html> (not <body>) to avoid inheriting body's dark mode color
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:0;left:0;width:794px;z-index:99997;background:white;color:#1a1a2e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.7;font-size:13px;overflow:auto;max-height:100vh;color-scheme:light;";
  container.innerHTML = `<style>${PDF_STYLES}</style><div class="pdf-content"><div class="header-badge">Reddit Deep-Dive Analysis</div>${htmlContent}</div>`;
  document.documentElement.appendChild(container);

  // Wait for fonts and rendering
  await new Promise((r) => setTimeout(r, 500));

  try {
    // Capture the full scrollable height
    const scrollHeight = container.scrollHeight;
    container.style.maxHeight = "none";
    container.style.height = `${scrollHeight}px`;

    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      height: scrollHeight,
      windowWidth: 794,
      windowHeight: scrollHeight,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10;
    const contentWidth = imgWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const usableHeight = pageHeight - margin * 2;
    let yOffset = 0;

    // Split into pages by cropping the single large image
    for (let page = 0; yOffset < imgHeight; page++) {
      if (page > 0) {
        pdf.addPage();
      }
      pdf.addImage(
        imgData,
        "JPEG",
        margin,
        margin - yOffset,
        contentWidth,
        imgHeight
      );
      yOffset += usableHeight;
    }

    pdf.save(filename);
  } finally {
    document.documentElement.removeChild(container);
    document.body.removeChild(overlay);
  }
}

async function generateSummaryPdf(
  markdownContent: string,
  filename: string
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  // Strip markdown/HTML to plain text
  const temp = document.createElement("div");
  temp.innerHTML = markdownContent;
  const text = temp.textContent || temp.innerText || "";

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 15;
  const pageWidth = 210 - margin * 2;

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(234, 88, 12);
  pdf.text("Reddit Deep-Dive Analysis", margin, margin + 12);

  // Subtitle
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `One-Page Summary  |  Generated ${new Date().toLocaleDateString()}`,
    margin,
    margin + 20
  );

  // Divider
  pdf.setDrawColor(249, 115, 22);
  pdf.setLineWidth(0.5);
  pdf.line(margin, margin + 24, 210 - margin, margin + 24);

  // Content
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(26, 26, 46);

  const lines = pdf.splitTextToSize(text, pageWidth);
  const maxLines = Math.floor((297 - margin * 2 - 32) / 4.5);
  const truncatedLines = lines.slice(0, maxLines);

  pdf.text(truncatedLines, margin, margin + 32);

  // Footer
  pdf.setFontSize(7);
  pdf.setTextColor(180, 180, 180);
  pdf.text(
    "Generated by Reddit Deep-Dive Analyst — Powered by Claude Agent SDK",
    margin,
    297 - 8
  );

  pdf.save(filename);
}

export function ReportDownloadPopup({
  conversationId,
  isCompleted,
  refreshTrigger,
}: ReportDownloadPopupProps) {
  const [reportFiles, setReportFiles] = useState<FileInfo[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(
    new Set()
  );

  // Find report files when completed
  useEffect(() => {
    if (!isCompleted || !conversationId || isDismissed) return;

    const fetchFiles = async () => {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/files?path=/&tree=true`
        );
        if (!response.ok) return;

        const data = await response.json();
        const files: FileInfo[] = data.files || [];

        const reports: FileInfo[] = [];
        const findReports = (items: FileInfo[]) => {
          for (const item of items) {
            if (
              item.type === "file" &&
              item.name.endsWith(".md") &&
              item.name.includes("report")
            ) {
              reports.push(item);
            }
            if (item.children) {
              findReports(item.children);
            }
          }
        };
        findReports(files);

        if (reports.length > 0) {
          setReportFiles(reports);
          setIsVisible(true);
        }
      } catch {
        // Silently ignore
      }
    };

    fetchFiles();
  }, [isCompleted, conversationId, isDismissed, refreshTrigger]);

  // Reset when conversation changes
  useEffect(() => {
    setIsDismissed(false);
    setIsVisible(false);
    setReportFiles([]);
    setDownloadedFiles(new Set());
  }, [conversationId]);

  const fetchFileContent = useCallback(
    async (file: FileInfo): Promise<string> => {
      if (!conversationId) throw new Error("No conversation");
      const encodedPath = file.path
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const response = await fetch(
        `/api/conversations/${conversationId}/files${encodedPath}`
      );
      if (!response.ok) throw new Error("Failed to fetch file");
      const data = await response.json();
      if (!data.content) throw new Error("Empty content");
      return data.content;
    },
    [conversationId]
  );

  const downloadAsMd = useCallback(
    async (file: FileInfo, content: string) => {
      const blob = new Blob([content], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  const downloadAsPdf = useCallback(
    async (file: FileInfo, content: string) => {
      const htmlBody = await marked.parse(content);
      const pdfFilename = file.name.replace(/\.md$/, ".pdf");
      await generatePdf(htmlBody, pdfFilename);
    },
    []
  );

  const downloadAsSummaryPdf = useCallback(
    async (file: FileInfo, content: string) => {
      const htmlBody = await marked.parse(content);
      const pdfFilename = file.name.replace(/\.md$/, "_summary.pdf");
      await generateSummaryPdf(htmlBody, pdfFilename);
    },
    []
  );

  const handleDownload = useCallback(
    async (file: FileInfo, format: DownloadFormat = "pdf") => {
      if (!conversationId) return;
      setDownloadingFile(file.path + format);

      try {
        const content = await fetchFileContent(file);

        if (format === "pdf") {
          await downloadAsPdf(file, content);
        } else if (format === "summary") {
          await downloadAsSummaryPdf(file, content);
        } else {
          await downloadAsMd(file, content);
        }

        setDownloadedFiles((prev) => new Set(prev).add(file.path + format));
      } catch (err) {
        console.error("Download failed:", err);
      } finally {
        setDownloadingFile(null);
      }
    },
    [conversationId, fetchFileContent, downloadAsPdf, downloadAsMd, downloadAsSummaryPdf]
  );

  const handleDownloadAllPdf = useCallback(() => {
    reportFiles.forEach((file) => {
      handleDownload(file, "pdf");
    });
  }, [reportFiles, handleDownload]);

  if (!isVisible || reportFiles.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="w-[380px] rounded-xl border border-orange-500/30 bg-card/95 backdrop-blur-md shadow-2xl shadow-orange-500/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500/10 to-transparent border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <FileText className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Report Ready
              </p>
              <p className="text-[11px] text-muted-foreground">
                {reportFiles.length} file
                {reportFiles.length > 1 ? "s" : ""} generated
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setIsDismissed(true);
            }}
            className="p-1 hover:bg-accent rounded-md transition-colors"
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* File list */}
        <div className="px-3 py-2 max-h-[200px] overflow-auto">
          {reportFiles.map((file) => {
            const isPdfDownloading = downloadingFile === file.path + "pdf";
            const isMdDownloading = downloadingFile === file.path + "md";
            const isSummaryDownloading = downloadingFile === file.path + "summary";
            const isPdfDownloaded = downloadedFiles.has(file.path + "pdf");
            const isMdDownloaded = downloadedFiles.has(file.path + "md");
            const isSummaryDownloaded = downloadedFiles.has(file.path + "summary");

            return (
              <div
                key={file.path}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FileText className="size-4 text-orange-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.name.replace(/\.md$/, "")}
                    </p>
                    {file.size && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* PDF download */}
                  <button
                    onClick={() => handleDownload(file, "pdf")}
                    disabled={isPdfDownloading}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                      isPdfDownloaded
                        ? "text-green-400 bg-green-500/10"
                        : "text-orange-400 hover:bg-orange-500/10"
                    )}
                    title="Download as PDF"
                  >
                    {isPdfDownloading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isPdfDownloaded ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <FileDown className="size-3.5" />
                    )}
                    <span>PDF</span>
                  </button>
                  {/* 1-Page Summary PDF */}
                  <button
                    onClick={() => handleDownload(file, "summary")}
                    disabled={isSummaryDownloading}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                      isSummaryDownloaded
                        ? "text-green-400 bg-green-500/10"
                        : "text-orange-300 hover:bg-orange-500/10"
                    )}
                    title="Download 1-page summary PDF"
                  >
                    {isSummaryDownloading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isSummaryDownloaded ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <FileText className="size-3.5" />
                    )}
                    <span>1P</span>
                  </button>
                  {/* MD download */}
                  <button
                    onClick={() => handleDownload(file, "md")}
                    disabled={isMdDownloading}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                      isMdDownloaded
                        ? "text-green-400 bg-green-500/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    title="Download as Markdown"
                  >
                    {isMdDownloading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isMdDownloaded ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    <span>MD</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 pb-3 pt-1">
          <Button
            onClick={handleDownloadAllPdf}
            className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/20 h-9 text-sm font-medium"
          >
            <FileDown className="size-4 mr-2" />
            {reportFiles.length > 1
              ? "Download All as PDF"
              : "Download Report as PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
