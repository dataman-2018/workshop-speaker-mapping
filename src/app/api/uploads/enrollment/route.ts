import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Validate the participant exists
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        if (payload.participantId) {
          const participant = await prisma.participant.findUnique({
            where: { id: payload.participantId },
          });
          if (!participant) {
            throw new Error("Participant not found");
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
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
          tokenPayload: clientPayload || "",
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = tokenPayload ? JSON.parse(tokenPayload) : {};
        if (payload.participantId) {
          await prisma.enrollmentSample.create({
            data: {
              participantId: payload.participantId,
              blobUrl: blob.url,
              filename: blob.pathname.split("/").pop() || "unknown",
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
