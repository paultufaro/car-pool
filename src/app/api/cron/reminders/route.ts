import { NextResponse } from "next/server";
import { AssignmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications";
import { extendAllSchedules, formatDate, startOfDayUtc } from "@/lib/schedule";

/**
 * Rolls every rotation forward, then sends driving reminders for today and
 * tomorrow. Trigger daily from a scheduler (e.g. a Vercel cron) with the
 * CRON_SECRET bearer token.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await extendAllSchedules();

  const today = startOfDayUtc(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);

  const assignments = await prisma.drivingAssignment.findMany({
    where: {
      date: { in: [today, tomorrow] },
      status: { not: AssignmentStatus.COMPLETED },
    },
    include: {
      route: true,
      family: { include: { members: true } },
    },
  });

  for (const assignment of assignments) {
    const when = assignment.date.getTime() === today.getTime() ? "today" : "tomorrow";
    const riders = await prisma.routeMember.count({ where: { routeId: assignment.routeId } });
    await notifyUsers(assignment.family.members, {
      type: "DRIVING_REMINDER",
      subject: `You're driving ${when}: ${assignment.route.name}`,
      body: `Reminder — you're driving ${assignment.route.name} ${when} (${formatDate(
        assignment.date,
      )}) between ${assignment.route.timeWindowStart} and ${
        assignment.route.timeWindowEnd
      }, for ${riders - 1} other famil${riders - 1 === 1 ? "y" : "ies"}.`,
    });
  }

  return NextResponse.json({ reminders: assignments.length });
}
