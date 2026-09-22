"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AssignmentStatus, SwapStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate, notifyRoute } from "@/lib/schedule";

export async function requestSwap(formData: FormData): Promise<void> {
  const assignmentId = String(formData.get("assignmentId"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const user = await requireUser();

  const assignment = await prisma.drivingAssignment.findUnique({
    where: { id: assignmentId },
    include: { route: true },
  });
  if (!assignment) throw new Error("Assignment not found");
  if (assignment.familyId !== user.familyId) {
    throw new Error("You can only request a swap for your own driving day");
  }
  const open = await prisma.swapRequest.findFirst({
    where: { assignmentId, status: SwapStatus.OPEN },
  });
  if (open) return;

  await prisma.swapRequest.create({
    data: { assignmentId, requestedById: user.id, note },
  });
  await notifyRoute(assignment.routeId, {
    type: "SWAP_REQUESTED",
    subject: `Swap needed: ${assignment.route.name} on ${formatDate(assignment.date)}`,
    body: `${user.name} can't drive ${assignment.route.name} on ${formatDate(assignment.date)}${
      note ? ` (${note})` : ""
    }. Open Carpool to claim the day.`,
  });
  revalidatePath(`/routes/${assignment.routeId}`);
  revalidatePath("/dashboard");
}

export async function claimSwap(formData: FormData): Promise<void> {
  const swapId = String(formData.get("swapId"));
  const user = await requireUser();
  if (!user.family) redirect("/onboarding");

  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    include: { assignment: { include: { route: true } } },
  });
  if (!swap || swap.status !== SwapStatus.OPEN) return;
  if (swap.assignment.familyId === user.family.id) {
    throw new Error("You are already driving that day");
  }
  const membership = await prisma.routeMember.findUnique({
    where: { routeId_familyId: { routeId: swap.assignment.routeId, familyId: user.family.id } },
  });
  if (!membership) throw new Error("Only families on this route can claim a swap");

  await prisma.$transaction([
    prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: SwapStatus.CLAIMED, claimedById: user.id, claimedAt: new Date() },
    }),
    prisma.drivingAssignment.update({
      where: { id: swap.assignmentId },
      data: { familyId: user.family.id, status: AssignmentStatus.SWAPPED },
    }),
  ]);
  await notifyRoute(swap.assignment.routeId, {
    type: "SWAP_CLAIMED",
    subject: `Swap covered: ${swap.assignment.route.name} on ${formatDate(swap.assignment.date)}`,
    body: `${user.name} is now driving ${swap.assignment.route.name} on ${formatDate(
      swap.assignment.date,
    )}.`,
  });
  revalidatePath(`/routes/${swap.assignment.routeId}`);
  revalidatePath("/dashboard");
}

export async function cancelSwap(formData: FormData): Promise<void> {
  const swapId = String(formData.get("swapId"));
  const user = await requireUser();
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    include: { assignment: true },
  });
  if (!swap || swap.requestedById !== user.id || swap.status !== SwapStatus.OPEN) return;
  await prisma.swapRequest.update({
    where: { id: swapId },
    data: { status: SwapStatus.CANCELLED },
  });
  revalidatePath(`/routes/${swap.assignment.routeId}`);
  revalidatePath("/dashboard");
}
