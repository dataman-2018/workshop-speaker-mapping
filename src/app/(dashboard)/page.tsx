import { prisma } from "@/lib/db/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link href="/projects/new">
          <Button>New Project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-muted-foreground text-sm">
          No projects yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {project.name}
                    </CardTitle>
                    <Badge variant="secondary">
                      {project._count.sessions} session
                      {project._count.sessions !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created{" "}
                    {new Date(project.createdAt).toLocaleDateString()}
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
