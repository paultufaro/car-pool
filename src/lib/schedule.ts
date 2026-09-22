import { AssignmentStatus, SwapStatus } from "@prisma/client";
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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Rotating calendar: families take turns in blocks of `rotationWeeks`, so a
 * weekly rotation gives each family every school day of their week. Turns are
 * counted from `anchorDate` (the route's creation week) rather than from the
 * generation date, so regenerating mid-cycle keeps the rotation in phase.
 */
export function buildRotation(
  familyIds: string[],
  daysOfWeek: number[],
  rotationWeeks: number,
  from: Date,
  weeks: number = SCHEDULE_WEEKS,
  anchorDate: Date = from,
): { date: Date; familyId: string }[] {
  if (familyIds.length === 0 || daysOfWeek.length === 0) return [];
  const anchor = startOfWeek(from);
  const today = startOfDayUtc(from);
  const rotation = Math.max(1, rotationWeeks);
  const weekOffset = Math.round((anchor.getTime() - startOfWeek(anchorDate).getTime()) / WEEK_MS);
  const result: { date: Date; familyId: string }[] = [];

  for (let week = 0; week < weeks; week += 1) {
    const turn = Math.floor((weekOffset + week) / rotation) % familyIds.length;
    const familyId = familyIds[(turn + familyIds.length) % familyIds.length];
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
  if (familyIds.length < 2) return 0;
  const rotation = buildRotation(
    familyIds,
    route.daysOfWeek,
    route.rotationWeeks,
    today,
    SCHEDULE_WEEKS,
    route.createdAt,
  ).filter((entry) => !protectedDates.has(entry.date.toISOString()));
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

/**
 * Rolls every route's rotation forward so schedules never run out. Idempotent:
 * only missing future dates are created, and protected days are left alone.
 */
export async function extendAllSchedules(): Promise<number> {
  const routes = await prisma.route.findMany({ select: { id: true } });
  let created = 0;
  for (const route of routes) {
    created += await regenerateSchedule(route.id);
  }
  return created;
}

/**
 * Takes a family off a route: upcoming plain assignments are dropped, and days
 * they had taken on through a swap are handed back to the rotation with the
 * swap cancelled, so no date is silently left without a driver.
 */
export async function releaseFamilyFromRoute(routeId: string, familyId: string): Promise<void> {
  const today = startOfDayUtc(new Date());
  const assignments = await prisma.drivingAssignment.findMany({
    where: { routeId, familyId, date: { gte: today } },
    include: { swapRequests: true, route: true },
  });
  const releasedSwaps = assignments.filter(
    (assignment) =>
      assignment.status !== AssignmentStatus.SCHEDULED || assignment.swapRequests.length > 0,
  );

  await prisma.$transaction([
    prisma.routeMember.deleteMany({ where: { routeId, familyId } }),
    prisma.swapRequest.updateMany({
      where: { assignmentId: { in: assignments.map((assignment) => assignment.id) } },
      data: { status: SwapStatus.CANCELLED },
    }),
    prisma.drivingAssignment.deleteMany({
      where: { id: { in: assignments.map((assignment) => assignment.id) } },
    }),
  ]);
  await regenerateSchedule(routeId);

  for (const assignment of releasedSwaps) {
    await notifyRoute(routeId, {
      type: "SCHEDULE_PUBLISHED",
      subject: `Driver needed again: ${assignment.route.name} on ${formatDate(assignment.date)}`,
      body: `The family covering ${assignment.route.name} on ${formatDate(
        assignment.date,
      )} left the carpool, so that day went back into the rotation.`,
    });
  }
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
