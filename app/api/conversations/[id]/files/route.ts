import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listVolumeFiles, buildFileTree } from "@/lib/moru";

/**
 * GET /api/conversations/[id]/files
 * List files in workspace directory
 * Use ?tree=true to get full recursive tree structure
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") || "/";
    const tree = searchParams.get("tree") === "true";

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
      return NextResponse.json({ files: [] });
    }

    const files = tree
      ? await buildFileTree(conversation.volumeId, path)
      : await listVolumeFiles(conversation.volumeId, path);

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error in GET /api/conversations/[id]/files:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
