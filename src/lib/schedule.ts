import { AssignmentStatus } from "@prisma/client";
import { prisma } from "./db";
import { notifyUsers } from "./notifications";

export const SCHEDULE_WEEKS = 8;

export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfWeek(date: Date): Date {
  const day = startOfDayUtc(date);
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Rotating calendar: families take turns in blocks of `rotationWeeks`, so a
 * weekly rotation gives each family every school day of their week.
 */
export function buildRotation(
  familyIds: string[],
  daysOfWeek: number[],
  rotationWeeks: number,
  from: Date,
  weeks: number = SCHEDULE_WEEKS,
): { date: Date; familyId: string }[] {
  if (familyIds.length === 0 || daysOfWeek.length === 0) return [];
  const anchor = startOfWeek(from);
  const today = startOfDayUtc(from);
  const rotation = Math.max(1, rotationWeeks);
  const result: { date: Date; familyId: string }[] = [];

  for (let week = 0; week < weeks; week += 1) {
    const familyId = familyIds[Math.floor(week / rotation) % familyIds.length];
    for (const day of [...daysOfWeek].sort((a, b) => a - b)) {
      const date = new Date(anchor);
      date.setUTCDate(anchor.getUTCDate() + week * 7 + day);
      if (date < today) continue;
      result.push({ date, familyId });
    }
  }
  return result;
}

/**
 * Regenerates upcoming assignments for a route. Past days, completed days and
 * days touched by a swap are left alone so history and agreements survive
 * membership changes.
 */
export async function regenerateSchedule(routeId: string): Promise<number> {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { members: { orderBy: { joinedAt: "asc" } } },
  });
  if (!route) return 0;

  const today = startOfDayUtc(new Date());
  const protectedAssignments = await prisma.drivingAssignment.findMany({
    where: {
      routeId,
      date: { gte: today },
      OR: [{ status: { not: AssignmentStatus.SCHEDULED } }, { swapRequests: { some: {} } }],
    },
    select: { date: true },
  });
  const protectedDates = new Set(protectedAssignments.map((a) => a.date.toISOString()));

  await prisma.drivingAssignment.deleteMany({
    where: {
      routeId,
      date: { gte: today },
      status: AssignmentStatus.SCHEDULED,
      swapRequests: { none: {} },
    },
  });

  const familyIds = route.members.map((member) => member.familyId);
  const rotation = buildRotation(familyIds, route.daysOfWeek, route.rotationWeeks, today).filter(
    (entry) => !protectedDates.has(entry.date.toISOString()),
  );
  if (rotation.length === 0) return 0;

  await prisma.drivingAssignment.createMany({
    data: rotation.map((entry) => ({
      routeId,
      familyId: entry.familyId,
      date: entry.date,
    })),
    skipDuplicates: true,
  });
  return rotation.length;
}

export async function notifyRoute(
  routeId: string,
  message: { type: Parameters<typeof notifyUsers>[1]["type"]; subject: string; body: string },
): Promise<void> {
  const members = await prisma.routeMember.findMany({
    where: { routeId },
    include: { family: { include: { members: true } } },
  });
  const users = members.flatMap((member) => member.family.members);
  const unique = new Map(users.map((user) => [user.id, user]));
  await notifyUsers([...unique.values()], message);
}
