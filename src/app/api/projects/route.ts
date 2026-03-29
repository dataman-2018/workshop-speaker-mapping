import { NextRequest, NextResponse } from "next/server";
import { projectRepo } from "@/server/repositories/project.repo";
import { createProjectSchema } from "@/lib/validations/project";

const DEMO_USER_ID = "demo-user";

export async function GET() {
  try {
    const projects = await projectRepo.list();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const project = await projectRepo.create({
      ...parsed.data,
      userId: DEMO_USER_ID,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
