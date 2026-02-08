"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

let mermaidInitialized = false;

export function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              primaryColor: "#f97316",
              primaryTextColor: "#fafafa",
              primaryBorderColor: "#ea580c",
              secondaryColor: "#292524",
              tertiaryColor: "#1c1917",
              lineColor: "#a8a29e",
              textColor: "#fafafa",
              mainBkg: "#1c1917",
              nodeBorder: "#ea580c",
              clusterBkg: "#292524",
              titleColor: "#fafafa",
              edgeLabelBackground: "#292524",
              pie1: "#f97316",
              pie2: "#3b82f6",
              pie3: "#10b981",
              pie4: "#8b5cf6",
              pie5: "#ec4899",
              pie6: "#eab308",
              pie7: "#06b6d4",
              pie8: "#f43e5e",
            },
            fontFamily: "var(--font-geist-sans), sans-serif",
            securityLevel: "loose",
          });
          mermaidInitialized = true;
        }

        const uniqueId = `mermaid-${id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart.trim());

        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setSvg("");
        }
      }
    }

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="my-3 rounded-lg border border-border/50 bg-card/50 p-4">
        <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 flex items-center justify-center rounded-lg border border-border/50 bg-card/30 p-8">
        <div className="size-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 flex justify-center rounded-lg border border-border/50 bg-card/30 p-4 overflow-x-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
