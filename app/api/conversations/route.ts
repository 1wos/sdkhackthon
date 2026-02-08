import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createVolume,
  createAndLaunchAgent,
} from "@/lib/moru";
import type { SendMessageRequest, SendMessageResponse } from "@/lib/types";

/**
 * GET /api/conversations
 * List all conversations, most recent first
 */
export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error in GET /api/conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Send a message - creates conversation if needed
 */
export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const { conversationId, content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    let conversation;
    let volumeId: string;
    let sessionId: string | undefined;

    if (conversationId) {
      // Follow-up message to existing conversation
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      if (conversation.status === "running") {
        return NextResponse.json(
          { error: "Conversation is already running" },
          { status: 409 }
        );
      }

      volumeId = conversation.volumeId!;
      sessionId = conversation.sessionId || undefined;
    } else {
      // New conversation - create record first
      conversation = await prisma.conversation.create({
        data: {
          status: "idle",
          title: content.trim().slice(0, 100),
        },
      });

      // Create volume for this conversation
      volumeId = await createVolume(conversation.id);

      // Update conversation with volumeId
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { volumeId },
      });
    }

    // Create sandbox and launch agent (fire-and-forget, no streaming connection)
    const { sandboxId } = await createAndLaunchAgent(
      volumeId,
      conversation.id,
      content,
      sessionId
    );

    // Update conversation to running state
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "running",
        sandboxId,
      },
    });

    const response: SendMessageResponse = {
      conversationId: conversation.id,
      status: "running",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in POST /api/conversations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
