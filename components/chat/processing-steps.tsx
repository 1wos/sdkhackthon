"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  MessageSquare,
  BarChart3,
  FileText,
  Loader2,
  CheckCircle2,
  Zap,
  Globe,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import type { SessionEntry } from "@/lib/types";
import { isAssistantMessage, isToolUseBlock } from "@/lib/types";

interface ProcessingStepsProps {
  isRunning: boolean;
  messages: SessionEntry[];
  startTime?: number;
}

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  timeThreshold: number;
}

const STEPS: Step[] = [
  {
    id: "boot",
    label: "Initializing",
    description: "Setting up analysis environment",
    icon: <Zap className="size-4" />,
    timeThreshold: 0,
  },
  {
    id: "search",
    label: "Searching Reddit",
    description: "Scanning subreddits for relevant discussions",
    icon: <Search className="size-4" />,
    timeThreshold: 8,
  },
  {
    id: "collect",
    label: "Collecting Data",
    description: "Gathering reviews, comparisons, and feedback",
    icon: <Globe className="size-4" />,
    timeThreshold: 25,
  },
  {
    id: "analyze",
    label: "Analyzing Feedback",
    description: "Cross-verifying information from multiple sources",
    icon: <MessageSquare className="size-4" />,
    timeThreshold: 50,
  },
  {
    id: "compare",
    label: "Building Comparison",
    description: "Evaluating features, pricing, and performance",
    icon: <BarChart3 className="size-4" />,
    timeThreshold: 80,
  },
  {
    id: "report",
    label: "Generating Report",
    description: "Compiling deep-dive analysis with charts",
    icon: <FileText className="size-4" />,
    timeThreshold: 110,
  },
];

const FUN_FACTS = [
  "Reddit has 1.7 billion monthly visits — the world's largest focus group.",
  "The average Redditor spends 10+ minutes per visit reading threads.",
  "r/technology has 15M+ subscribers discussing AI tools daily.",
  "Reddit comments often contain more honest reviews than official review sites.",
  "AI tool subreddits grew 300%+ in the last 2 years.",
  "Cross-referencing 3+ Reddit threads increases insight accuracy by 4x.",
  "Power users on Reddit often post detailed comparisons with real benchmarks.",
  "Reddit's upvote system naturally surfaces the most helpful reviews.",
  "Most AI tool pain points are first reported on Reddit before any blog.",
  "Pricing changes are usually discussed on Reddit within hours of announcement.",
  "The best tool comparisons come from users who've tried both products.",
  "Reddit threads from 6+ months ago help identify long-standing issues vs new bugs.",
];

interface ToolStats {
  searchCount: number;
  threadCount: number;
  fetchCount: number;
  writeCount: number;
  activities: string[];
}

function extractToolStats(messages: SessionEntry[]): ToolStats {
  let searchCount = 0;
  let threadCount = 0;
  let fetchCount = 0;
  let writeCount = 0;
  const activities: string[] = [];

  for (const msg of messages) {
    if (!isAssistantMessage(msg)) continue;
    for (const block of msg.message.content) {
      if (isToolUseBlock(block)) {
        if (block.name === "WebSearch" && "query" in block.input) {
          searchCount++;
          activities.push(`Searching: "${block.input.query}"`);
        } else if (block.name === "WebFetch" && "url" in block.input) {
          fetchCount++;
          const url = String(block.input.url);
          if (url.includes("reddit.com")) {
            threadCount++;
            activities.push(`Reading Reddit thread...`);
          } else {
            activities.push(`Fetching web data...`);
          }
        } else if (block.name === "Write" && "file_path" in block.input) {
          writeCount++;
          activities.push(`Writing report...`);
        } else if (block.name === "Read") {
          activities.push(`Reading file...`);
        } else if (block.name === "Bash") {
          activities.push(`Running command...`);
        }
      }
    }
  }

  return { searchCount, threadCount, fetchCount, writeCount, activities: activities.slice(-5) };
}

export function ProcessingSteps({
  isRunning,
  messages,
  startTime,
}: ProcessingStepsProps) {
  const [elapsed, setElapsed] = useState(0);
  const [currentFactIndex, setCurrentFactIndex] = useState(
    () => Math.floor(Math.random() * FUN_FACTS.length)
  );

  useEffect(() => {
    if (!isRunning || !startTime) return;

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, startTime]);

  // Cycle fun facts every 6 seconds
  useEffect(() => {
    if (!isRunning) return;

    const factTimer = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 6000);

    return () => clearInterval(factTimer);
  }, [isRunning]);

  const currentStepIndex = useMemo(() => {
    let idx = 0;
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (elapsed >= STEPS[i].timeThreshold) {
        idx = i;
        break;
      }
    }
    return idx;
  }, [elapsed]);

  const stats = useMemo(() => extractToolStats(messages), [messages]);

  // Compute progress percentage (smooth)
  const progressPercent = useMemo(() => {
    const currentStep = STEPS[currentStepIndex];
    const nextStep = STEPS[currentStepIndex + 1];

    if (!nextStep) {
      // Last step — slowly fill to 95%
      const stepStart = currentStep.timeThreshold;
      const progressInStep = Math.min((elapsed - stepStart) / 60, 1);
      return 85 + progressInStep * 10;
    }

    const stepStart = currentStep.timeThreshold;
    const stepEnd = nextStep.timeThreshold;
    const stepProgress = Math.min((elapsed - stepStart) / (stepEnd - stepStart), 1);

    const basePercent = (currentStepIndex / STEPS.length) * 100;
    const stepPercent = (1 / STEPS.length) * 100 * stepProgress;

    return Math.min(basePercent + stepPercent, 95);
  }, [elapsed, currentStepIndex]);

  if (!isRunning) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="w-full max-w-lg mx-auto py-4">
      {/* Progress bar + timer */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" />
              <div className="relative size-2 rounded-full bg-orange-500" />
            </div>
            <span className="text-sm text-muted-foreground font-mono">
              Deep-diving <span className="text-orange-400">{timeStr}</span>
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {Math.round(progressPercent)}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000 ease-out relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-bar" />
          </div>
        </div>
      </div>

      {/* Real-time stats */}
      {(stats.searchCount > 0 || stats.threadCount > 0) && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatCard
            icon={<Search className="size-3.5" />}
            value={stats.searchCount}
            label="Searches"
          />
          <StatCard
            icon={<BookOpen className="size-3.5" />}
            value={stats.threadCount}
            label="Threads"
          />
          <StatCard
            icon={<TrendingUp className="size-3.5" />}
            value={stats.fetchCount}
            label="Sources"
          />
        </div>
      )}

      {/* Steps */}
      <div className="space-y-1">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-500",
                isCurrent && "bg-orange-500/10 border border-orange-500/20",
                isCompleted && "opacity-60",
                isPending && "opacity-30"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center size-7 rounded-full shrink-0 transition-colors duration-500",
                  isCurrent && "bg-orange-500/20 text-orange-400",
                  isCompleted && "bg-green-500/20 text-green-400",
                  isPending && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-4" />
                ) : isCurrent ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  step.icon
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium transition-colors duration-500",
                    isCurrent && "text-orange-300",
                    isCompleted && "text-foreground",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </div>
                {isCurrent && (
                  <div className="text-xs text-muted-foreground mt-0.5 animate-fade-in">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live tool activities */}
      {stats.activities.length > 0 && (
        <div className="mt-4 mx-4 pt-3 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
            Live Activity
          </div>
          <div className="space-y-1">
            {stats.activities.map((activity, i) => (
              <div
                key={`${activity}-${i}`}
                className={cn(
                  "text-xs text-muted-foreground truncate flex items-center gap-1.5",
                  i === stats.activities.length - 1 && "text-orange-400/80 animate-fade-in"
                )}
              >
                <span className={cn(
                  "size-1 rounded-full shrink-0",
                  i === stats.activities.length - 1 ? "bg-orange-400 animate-pulse" : "bg-current"
                )} />
                {activity}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fun fact - cycling */}
      <div className="mt-5 mx-4 pt-3 border-t border-border/30">
        <div className="flex items-start gap-2 min-h-[40px]">
          <span className="text-orange-400/60 mt-0.5 shrink-0 text-sm">💡</span>
          <p
            key={currentFactIndex}
            className="text-xs text-muted-foreground/70 leading-relaxed animate-fade-in"
          >
            {FUN_FACTS[currentFactIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border/50 bg-card/30 py-2.5 px-2">
      <div className="flex items-center gap-1.5 text-orange-400">
        {icon}
        <span className="text-lg font-bold font-mono tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}
