import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readVolumeFile } from "@/lib/moru";

/**
 * GET /api/conversations/[id]/files/[...path]
 * Read file contents from workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id, path } = await params;
    const filePath = "/" + path.join("/");

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (!conversation.volumeId) {
      return NextResponse.json(
        { error: "No volume attached to conversation" },
        { status: 400 }
      );
    }

    const content = await readVolumeFile(conversation.volumeId, filePath);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error in GET /api/conversations/[id]/files/[...path]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
