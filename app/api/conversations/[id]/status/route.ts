import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { killSandbox } from "@/lib/moru";
import type { StatusCallbackRequest } from "@/lib/types";

/**
 * POST /api/conversations/[id]/status
 * Callback endpoint for sandbox to report completion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: StatusCallbackRequest = await request.json();
    const { status, errorMessage, sessionId } = body;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Update conversation status
    await prisma.conversation.update({
      where: { id },
      data: {
        status,
        errorMessage: errorMessage || null,
        sessionId: sessionId || conversation.sessionId,
        sandboxId: null, // Sandbox is done
      },
    });

    // Wait for volume to sync before killing the sandbox.
    // The agent runs `sync` before calling this callback, but we add an
    // extra delay as a safety margin for JuiceFS writeback upload to GCS.
    if (conversation.sandboxId) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await killSandbox(conversation.sandboxId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/conversations/[id]/status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
