"use client";

import { cn } from "@/lib/utils";
import {
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Image,
  Settings,
} from "lucide-react";

const getFileIcon = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const baseName = filename.toLowerCase();

  // Special filenames
  if (baseName === "package.json") return FileJson;
  if (baseName.startsWith(".env")) return Settings;
  if (baseName.endsWith(".config.js") || baseName.endsWith(".config.ts"))
    return Settings;

  // Extensions
  switch (extension) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "mjs":
    case "cjs":
      return FileCode;
    case "json":
      return FileJson;
    case "md":
    case "mdx":
    case "txt":
      return FileText;
    case "html":
    case "htm":
    case "css":
    case "scss":
    case "sass":
      return FileCode;
    case "py":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "h":
      return FileCode;
    case "yml":
    case "yaml":
    case "toml":
      return FileType;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return Image;
    default:
      return File;
  }
};

export function FileIcon({
  filename,
  className,
  style,
}: {
  filename: string;
  className?: string;
  style?: React.CSSProperties;
  useFallback?: boolean;
}) {
  const IconComponent = getFileIcon(filename);
  return (
    <IconComponent
      className={cn("shrink-0 text-muted-foreground", className)}
      style={style}
    />
  );
}
