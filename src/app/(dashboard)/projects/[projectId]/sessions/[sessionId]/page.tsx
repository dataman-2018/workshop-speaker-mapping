import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddParticipantButton } from "./add-participant-button";
import { UploadTab } from "@/features/uploads/upload-tab";
import { ProcessingTab } from "@/features/processing/processing-tab";
import { TranscriptTab } from "@/features/transcripts/transcript-tab";

interface Props {
  params: Promise<{ projectId: string; sessionId: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { projectId, sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      project: true,
      participants: { orderBy: { label: "asc" } },
    },
  });

  if (!session || session.projectId !== projectId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${projectId}`}
          className="hover:underline"
        >
          {session.project.name}
        </Link>
        <span>/</span>
        <span>{session.name}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {session.participants.length} participant
          {session.participants.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="participants">
        <TabsList>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Participants</h3>
            <AddParticipantButton sessionId={sessionId} />
          </div>

          {session.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No participants yet. Add one to begin enrollment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Label</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead className="w-40">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {session.participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Badge variant="outline">{p.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.displayName || (
                        <span className="text-muted-foreground italic">
                          Unnamed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="uploads" className="mt-4">
          <UploadTab
            sessionId={sessionId}
            participants={session.participants.map((p) => ({
              id: p.id,
              label: p.label,
              displayName: p.displayName,
            }))}
          />
        </TabsContent>

        <TabsContent value="processing" className="mt-4">
          <ProcessingTab sessionId={sessionId} />
        </TabsContent>

        <TabsContent value="transcript" className="mt-4">
          <TranscriptTab
            sessionId={sessionId}
            participants={session.participants.map((p) => ({
              id: p.id,
              label: p.label,
              displayName: p.displayName,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
