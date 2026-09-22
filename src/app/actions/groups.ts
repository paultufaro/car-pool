"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GroupType, MemberRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { geocode } from "@/lib/geocoding";
import { notifyUsers } from "@/lib/notifications";
import { regenerateSchedule } from "@/lib/schedule";
import type { FormState } from "./auth";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Array.from(
      { length: 8 },
      () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
    ).join("");
    const clash = await prisma.group.findUnique({ where: { inviteCode: code } });
    if (!clash) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

async function requireGroupAdmin(groupId: string) {
  const user = await requireUser();
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!membership || membership.role !== MemberRole.ADMIN) {
    throw new Error("Only group admins can do that");
  }
  return user;
}

const groupSchema = z.object({
  name: z.string().min(3, "Give the group a name"),
  type: z.nativeEnum(GroupType),
  anchorAddress: z.string().min(5, "Enter the school, field or meeting point address"),
});

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = groupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const anchor = await geocode(parsed.data.anchorAddress);
  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      anchorAddress: parsed.data.anchorAddress,
      anchorLat: anchor.lat,
      anchorLng: anchor.lng,
      adminUserId: user.id,
      inviteCode: await generateInviteCode(),
      members: { create: { userId: user.id, role: MemberRole.ADMIN } },
    },
  });
  redirect(`/groups/${group.id}`);
}

export async function joinGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const code = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();
  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group) return { error: "That invite code is not valid" };

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id },
    update: {},
  });
  redirect(`/groups/${group.id}`);
}

export async function rotateInviteCode(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId"));
  await requireGroupAdmin(groupId);
  await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: await generateInviteCode() },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function removeMember(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId"));
  const userId = String(formData.get("userId"));
  const admin = await requireGroupAdmin(groupId);
  if (userId === admin.id) throw new Error("Admins cannot remove themselves");

  const member = await prisma.user.findUnique({ where: { id: userId } });
  if (!member) return;

  if (member.familyId) {
    const memberships = await prisma.routeMember.findMany({
      where: { familyId: member.familyId, route: { groupId } },
    });
    await prisma.routeMember.deleteMany({
      where: { id: { in: memberships.map((m) => m.id) } },
    });
    for (const membership of memberships) {
      await regenerateSchedule(membership.routeId);
    }
  }
  await prisma.groupMember.delete({ where: { groupId_userId: { groupId, userId } } });
  await notifyUsers([member], {
    type: "GROUP_MEMBER_REMOVED",
    subject: "You were removed from a carpool group",
    body: "A group admin removed you from a carpool group. Contact them if this was a mistake.",
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function updateGroup(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId"));
  await requireGroupAdmin(groupId);
  const name = String(formData.get("name") ?? "").trim();
  const anchorAddress = String(formData.get("anchorAddress") ?? "").trim();
  if (name.length < 3 || anchorAddress.length < 5) return;
  const anchor = await geocode(anchorAddress);
  await prisma.group.update({
    where: { id: groupId },
    data: { name, anchorAddress, anchorLat: anchor.lat, anchorLng: anchor.lng },
  });
  revalidatePath(`/groups/${groupId}`);
}

export async function dissolveGroup(formData: FormData): Promise<void> {
  const groupId = String(formData.get("groupId"));
  await requireGroupAdmin(groupId);
  await prisma.group.delete({ where: { id: groupId } });
  redirect("/dashboard");
}
