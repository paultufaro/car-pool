"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { geocode } from "@/lib/geocoding";
import { notifyUsers } from "@/lib/notifications";
import { rankFamiliesForRoute } from "@/lib/matching";
import { notifyRoute, regenerateSchedule } from "@/lib/schedule";
import type { FormState } from "./auth";

async function requireGroupMembership(groupId: string) {
  const user = await requireUser();
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership) throw new Error("You are not a member of this group");
  return user;
}

const routeSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(3, "Name the route"),
  originDescription: z.string().min(3, "Describe the pickup area"),
  destinationDescription: z.string().min(3, "Describe the destination"),
  timeWindowStart: z.string().min(1, "Set a start time"),
  timeWindowEnd: z.string().min(1, "Set an end time"),
  rotationWeeks: z.coerce.number().int().min(1).max(4),
  matchRadiusMiles: z.coerce.number().min(0.25).max(10),
});

export async function createRoute(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = routeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await requireGroupMembership(parsed.data.groupId);
  if (!user.family) redirect("/onboarding");

  const daysOfWeek = formData
    .getAll("daysOfWeek")
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (daysOfWeek.length === 0) return { error: "Pick at least one day of the week" };

  const [origin, destination] = await Promise.all([
    geocode(parsed.data.originDescription),
    geocode(parsed.data.destinationDescription),
  ]);

  const route = await prisma.route.create({
    data: {
      groupId: parsed.data.groupId,
      createdById: user.id,
      name: parsed.data.name,
      originDescription: parsed.data.originDescription,
      originLat: origin.lat,
      originLng: origin.lng,
      destinationDescription: parsed.data.destinationDescription,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      daysOfWeek,
      timeWindowStart: parsed.data.timeWindowStart,
      timeWindowEnd: parsed.data.timeWindowEnd,
      rotationWeeks: parsed.data.rotationWeeks,
      matchRadiusMiles: parsed.data.matchRadiusMiles,
      members: { create: { familyId: user.family.id } },
    },
  });
  await regenerateSchedule(route.id);
  await notifyMatchSuggestions(route.id);
  redirect(`/routes/${route.id}`);
}

/** Tells nearby families in the group that a route they could join now exists. */
async function notifyMatchSuggestions(routeId: string): Promise<void> {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { members: true, group: { include: { members: { include: { user: true } } } } },
  });
  if (!route) return;
  const joined = new Set(route.members.map((member) => member.familyId));
  const candidateUsers = route.group.members
    .map((member) => member.user)
    .filter((user) => user.familyId && !joined.has(user.familyId));
  const families = await prisma.family.findMany({
    where: { id: { in: candidateUsers.map((user) => user.familyId!) } },
  });
  const matches = rankFamiliesForRoute(route, families);
  const matchedFamilyIds = new Set(matches.map((match) => match.family.id));
  const recipients = candidateUsers.filter((user) => matchedFamilyIds.has(user.familyId!));
  await notifyUsers(recipients, {
    type: "ROUTE_MATCH",
    subject: `New carpool near you: ${route.name}`,
    body: `${route.group.name} has a new route "${route.name}" (${route.originDescription} → ${route.destinationDescription}) that looks close to your home. Open Carpool to join it.`,
  });
}

export async function joinRoute(formData: FormData): Promise<void> {
  const routeId = String(formData.get("routeId"));
  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) throw new Error("Route not found");
  const user = await requireGroupMembership(route.groupId);
  if (!user.family) redirect("/onboarding");

  await prisma.routeMember.upsert({
    where: { routeId_familyId: { routeId, familyId: user.family.id } },
    create: { routeId, familyId: user.family.id },
    update: {},
  });
  await regenerateSchedule(routeId);
  await notifyRoute(routeId, {
    type: "ROUTE_JOINED",
    subject: `${user.name} joined ${route.name}`,
    body: `${user.name} joined the carpool "${route.name}". The driving rotation has been updated.`,
  });
  revalidatePath(`/routes/${routeId}`);
}

export async function leaveRoute(formData: FormData): Promise<void> {
  const routeId = String(formData.get("routeId"));
  const user = await requireUser();
  if (!user.family) redirect("/onboarding");
  await prisma.routeMember.deleteMany({ where: { routeId, familyId: user.family.id } });
  await prisma.drivingAssignment.deleteMany({
    where: { routeId, familyId: user.family.id, date: { gte: new Date() } },
  });
  await regenerateSchedule(routeId);
  revalidatePath(`/routes/${routeId}`);
}
