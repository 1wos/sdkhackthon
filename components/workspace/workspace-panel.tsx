"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { FileExplorer } from "./file-explorer";
import { FileViewer } from "./file-viewer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Loader2, PanelLeftClose, PanelLeft, X } from "lucide-react";
import type { FileInfo } from "@/lib/types";

interface WorkspacePanelProps {
  conversationId: string | null;
  refreshTrigger?: number;
  onClose?: () => void;
}

function WorkspacePanelComponent({
  conversationId,
  refreshTrigger,
  onClose,
}: WorkspacePanelProps) {
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // File tree state
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Fetch file tree
  const fetchFileTree = useCallback(async () => {
    if (!conversationId) return;

    setIsTreeLoading(true);
    setTreeError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/files?path=/&tree=true`
      );
      if (!response.ok) {
        throw new Error("Failed to load file tree");
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsTreeLoading(false);
    }
  }, [conversationId]);

  // Fetch file tree on mount and when refreshTrigger changes
  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree, refreshTrigger]);

  // Fetch file content when a file is selected
  useEffect(() => {
    if (!conversationId || !selectedFilePath) {
      setSelectedFileContent("");
      return;
    }

    const fetchContent = async () => {
      setIsLoadingContent(true);
      setContentError(null);

      try {
        const encodedPath = selectedFilePath
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        const response = await fetch(
          `/api/conversations/${conversationId}/files${encodedPath}`
        );

        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.status}`);
        }

        const data = await response.json();
        setSelectedFileContent(data.content || "");
      } catch (err) {
        setContentError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchContent();
  }, [conversationId, selectedFilePath]);

  const handleFileSelect = (file: FileInfo) => {
    setSelectedFilePath(file.path);
  };

  const handleFileDownload = async (file: FileInfo) => {
    if (!conversationId) return;

    try {
      const encodedPath = file.path
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const response = await fetch(
        `/api/conversations/${conversationId}/files${encodedPath}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      const data = await response.json();
      if (!data.content) {
        throw new Error("Failed to get file content");
      }

      const blob = new Blob([data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  };

  // Helper for consistent header rendering
  const renderHeader = () => (
    <div className="flex items-center justify-between border-b border-border px-3 py-2 h-[52px]">
      <span className="font-mono text-sm font-medium">Workspace</span>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setIsExplorerCollapsed((prev) => !prev)}
            >
              {isExplorerCollapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isExplorerCollapsed ? "Open" : "Close"} File Explorer
          </TooltipContent>
        </Tooltip>
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close Workspace</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );

  // No conversation yet
  if (!conversationId) {
    return (
      <div className="flex h-full flex-col border-l border-border">
        {renderHeader()}
        <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-4 text-center">
          Start a conversation to see workspace files
        </div>
      </div>
    );
  }

  // Loading state
  if (isTreeLoading && files.length === 0) {
    return (
      <div className="flex h-full flex-col border-l border-border">
        {renderHeader()}
        <div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Initializing Workspace...
        </div>
      </div>
    );
  }

  // Error state
  if (treeError) {
    return (
      <div className="flex h-full flex-col border-l border-border">
        {renderHeader()}
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="text-destructive size-4" />
            Failed to Load Workspace
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchFileTree()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Ready state
  return (
    <div className="flex h-full flex-col border-l border-border">
      {renderHeader()}
      {/* Content */}
      <div className="flex w-full flex-1 overflow-hidden">
        <FileExplorer
          files={files}
          onFileSelect={handleFileSelect}
          onFileDownload={handleFileDownload}
          selectedFilePath={selectedFilePath}
          isCollapsed={isExplorerCollapsed}
          onToggleCollapse={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
          isLoading={isTreeLoading}
        />
        <div className="flex-1 overflow-hidden">
          <FileViewer
            selectedFilePath={selectedFilePath}
            selectedFileContent={selectedFileContent}
            isLoadingContent={isLoadingContent}
            contentError={contentError}
          />
        </div>
      </div>
    </div>
  );
}

export const WorkspacePanel = memo(WorkspacePanelComponent);
