import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readVolumeFile } from "@/lib/moru";
import { parseSessionJSONL, getSessionFilePath } from "@/lib/session-parser";
import type { ConversationResponse } from "@/lib/types";

/**
 * GET /api/conversations/[id]
 * Get conversation state and messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const response: ConversationResponse = {
      id: conversation.id,
      status: conversation.status as ConversationResponse["status"],
      messages: [],
      errorMessage: conversation.errorMessage || undefined,
    };

    // If we have a sessionId and volumeId, try to read the session file
    if (conversation.sessionId && conversation.volumeId) {
      try {
        const sessionPath = getSessionFilePath(conversation.sessionId);
        const content = await readVolumeFile(conversation.volumeId, sessionPath);
        response.messages = parseSessionJSONL(content);
      } catch (error) {
        // Session file doesn't exist yet or can't be read - return empty
        // The client will show pending messages until real messages arrive
        console.log("Could not read session file (may not exist yet):", error);
        response.messages = [];
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in GET /api/conversations/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
