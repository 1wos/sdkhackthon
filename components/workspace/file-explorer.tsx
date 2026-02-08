"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FileIcon } from "@/components/ui/file-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileInfo } from "@/lib/types";

interface FileExplorerProps {
  files: FileInfo[];
  onFileSelect: (file: FileInfo) => void;
  onFileDownload?: (file: FileInfo) => void;
  selectedFilePath: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isLoading?: boolean;
}

export function FileExplorer({
  files,
  onFileSelect,
  onFileDownload,
  selectedFilePath,
  isCollapsed,
  isLoading,
}: FileExplorerProps) {
  // Track expanded folders (closed by default)
  const [folderState, setFolderState] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    setFolderState((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Auto-expand folders leading to the selected file path
  useEffect(() => {
    if (selectedFilePath) {
      const pathParts = selectedFilePath.split("/");
      const parentPaths: string[] = [];

      for (let i = 1; i < pathParts.length; i++) {
        parentPaths.push(pathParts.slice(0, i).join("/"));
      }

      setFolderState((prev) => {
        const next = new Set(prev);
        let hasChanges = false;

        parentPaths.forEach((parentPath) => {
          if (!next.has(parentPath)) {
            hasChanges = true;
            next.add(parentPath);
          }
        });

        return hasChanges ? next : prev;
      });
    }
  }, [selectedFilePath]);

  const isNodeExpanded = (path: string) => folderState.has(path);

  const renderNode = (node: FileInfo, depth = 0) => {
    const isExpanded = isNodeExpanded(node.path);
    const isSelected = selectedFilePath === node.path;
    const isFolder = node.type === "directory";

    return (
      <div key={node.path} className="relative flex flex-col gap-0.5">
        {isExpanded && (
          <div
            className="bg-border absolute bottom-0 hidden h-[calc(100%-30px)] w-px group-hover/files:block"
            style={{ left: `${depth * 12 + 12}px` }}
          />
        )}
        <div
          className={cn(
            "group/item text-foreground/80 hover:text-foreground flex cursor-pointer items-center justify-between overflow-hidden rounded-md px-2 py-1 hover:bg-muted/50",
            isSelected && "bg-muted"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
            onClick={() => {
              if (isFolder) {
                toggleFolder(node.path);
              } else {
                onFileSelect(node);
              }
            }}
          >
            <div
              className="flex items-center gap-1.5 overflow-hidden"
              title={node.name}
            >
              {isFolder ? (
                isExpanded ? (
                  <>
                    <FolderOpen className="size-4 shrink-0 text-muted-foreground group-hover/item:hidden" />
                    <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground group-hover/item:block" />
                  </>
                ) : (
                  <>
                    <Folder className="size-4 shrink-0 text-muted-foreground group-hover/item:hidden" />
                    <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground group-hover/item:block" />
                  </>
                )
              ) : (
                <FileIcon filename={node.name} className="size-4" />
              )}
              <span className="truncate text-sm">{node.name}</span>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {!isFolder && onFileDownload && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="text-muted-foreground hover:text-foreground rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover/item:opacity-100 data-[state=open]:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" sideOffset={4}>
                  <DropdownMenuItem
                    onClick={() => onFileDownload(node)}
                    className="cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {isFolder && isExpanded && node.children && (
          <div className="flex flex-col gap-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="bg-muted/30 border-border flex w-48 shrink-0 select-none flex-col overflow-hidden border-r">
      {files.length > 0 ? (
        <div className="group/files flex w-full grow flex-col gap-0.5 overflow-y-auto p-1">
          {files.map((file) => renderNode(file))}
        </div>
      ) : isLoading ? (
        <div className="flex w-full justify-center p-4">
          <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
        </div>
      ) : (
        <div className="text-muted-foreground flex w-full justify-center p-4 text-sm">
          No files
        </div>
      )}
    </div>
  );
}
