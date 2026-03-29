import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/db/client";
import { MediaType } from "@prisma/client";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        if (payload.sessionId) {
          const session = await prisma.session.findUnique({
            where: { id: payload.sessionId },
          });
          if (!session) {
            throw new Error("Session not found");
          }
        }

        return {
          allowedContentTypes: [
            "audio/mpeg",
            "audio/wav",
            "audio/mp4",
            "audio/webm",
            "audio/ogg",
            "audio/flac",
            "video/mp4",
            "video/webm",
            "video/quicktime",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
          tokenPayload: clientPayload || "",
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = tokenPayload ? JSON.parse(tokenPayload) : {};
        if (payload.sessionId) {
          const mediaType = payload.type === "SESSION_VIDEO"
            ? MediaType.SESSION_VIDEO
            : MediaType.SESSION_AUDIO;

          await prisma.mediaAsset.create({
            data: {
              sessionId: payload.sessionId,
              blobUrl: blob.url,
              filename: blob.pathname.split("/").pop() || "unknown",
              contentType: blob.contentType || "application/octet-stream",
              sizeBytes: 0, // size populated by webhook or client
              type: mediaType,
            },
          });
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
