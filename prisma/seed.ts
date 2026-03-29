import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      id: "demo-user",
      name: "Demo User",
      email: "demo@example.com",
    },
  });

  // Create sample project
  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: {
      id: "demo-project",
      name: "Startup Workshop #1",
      description: "Monthly startup founders meetup - March 2026",
      userId: user.id,
    },
  });

  // Create sample session
  const session = await prisma.session.upsert({
    where: { id: "demo-session" },
    update: {},
    create: {
      id: "demo-session",
      name: "Pitch Session",
      projectId: project.id,
    },
  });

  // Create sample participants
  const labels = ["A", "B", "C"];
  const names = ["Alice", "Bob", "Charlie"];

  for (let i = 0; i < labels.length; i++) {
    await prisma.participant.upsert({
      where: {
        sessionId_label: { sessionId: session.id, label: labels[i] },
      },
      update: {},
      create: {
        sessionId: session.id,
        label: labels[i],
        displayName: names[i],
      },
    });
  }

  console.log("Seed completed: user, project, session, 3 participants");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
