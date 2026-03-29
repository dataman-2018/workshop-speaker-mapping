import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { participants: true } } },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Projects
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        <Link href={`/projects/${project.id}/sessions/new`}>
          <Button size="sm">New Session</Button>
        </Link>
      </div>

      {project.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sessions yet. Create one to start mapping speakers.
        </p>
      ) : (
        <div className="grid gap-3">
          {project.sessions.map((session) => (
            <Link
              key={session.id}
              href={`/projects/${project.id}/sessions/${session.id}`}
            >
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{session.name}</CardTitle>
                    <Badge variant="secondary">
                      {session._count.participants} participant
                      {session._count.participants !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created{" "}
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
