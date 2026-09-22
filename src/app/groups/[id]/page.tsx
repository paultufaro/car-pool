import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rankRoutesForFamily } from "@/lib/matching";
import { DAY_LABELS } from "@/lib/schedule";
import { dissolveGroup, removeMember, rotateInviteCode, updateGroup } from "@/app/actions/groups";
import {
  Badge,
  buttonClass,
  Card,
  dangerButtonClass,
  EmptyState,
  Field,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";

const GROUP_TYPE_LABELS: Record<string, string> = {
  SCHOOL: "School class",
  SPORTS: "Sports team",
  ACTIVITY: "Activity",
  NEIGHBORHOOD: "Neighborhood",
};

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const family = user.family!;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: { include: { user: { include: { family: true } } }, orderBy: { joinedAt: "asc" } },
      routes: {
        include: { members: true, _count: { select: { members: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!group) notFound();

  const membership = group.members.find((member) => member.userId === user.id);
  if (!membership) notFound();
  const isAdmin = membership.role === MemberRole.ADMIN;

  const notJoined = group.routes.filter(
    (route) => !route.members.some((member) => member.familyId === family.id),
  );
  const suggested = new Set(rankRoutesForFamily(family, notJoined).map((entry) => entry.route.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{group.name}</h1>
          <p className="text-sm text-slate-500">
            {GROUP_TYPE_LABELS[group.type]} · drives to {group.anchorAddress}
          </p>
        </div>
        <Link href={`/groups/${group.id}/routes/new`} className={buttonClass}>
          Propose a route
        </Link>
      </div>

      <Card title="Routes">
        {group.routes.length === 0 ? (
          <EmptyState>No routes yet. Propose the first one.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {group.routes.map((route) => {
              const joined = route.members.some((member) => member.familyId === family.id);
              return (
                <li key={route.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1">
                    <Link
                      href={`/routes/${route.id}`}
                      className="text-sm font-medium text-sky-700 hover:underline"
                    >
                      {route.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {route.originDescription} → {route.destinationDescription} ·{" "}
                      {route.daysOfWeek.map((day) => DAY_LABELS[day]).join(" ")} ·{" "}
                      {route.timeWindowStart}–{route.timeWindowEnd} · {route._count.members}{" "}
                      families
                    </p>
                  </div>
                  {joined ? (
                    <Badge tone="green">You&apos;re in</Badge>
                  ) : suggested.has(route.id) ? (
                    <Badge tone="sky">Match near you</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Members"
        description="Home addresses stay private — members see each other's town only."
      >
        <ul className="divide-y divide-slate-100">
          {group.members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {member.user.name}
                  {member.userId === user.id ? " (you)" : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {member.user.family?.neighborhood ?? "No family profile yet"}
                </p>
              </div>
              {member.role === MemberRole.ADMIN && <Badge tone="sky">Admin</Badge>}
              {isAdmin && member.userId !== user.id && (
                <form action={removeMember}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <button type="submit" className={dangerButtonClass}>
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isAdmin && (
        <Card title="Admin tools">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Invite code</p>
                <p className="font-mono text-lg tracking-widest text-slate-900">
                  {group.inviteCode}
                </p>
              </div>
              <form action={rotateInviteCode}>
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className={secondaryButtonClass}>
                  Revoke &amp; regenerate
                </button>
              </form>
            </div>

            <form action={updateGroup} className="space-y-3">
              <input type="hidden" name="groupId" value={group.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Group name">
                  <input name="name" className={inputClass} defaultValue={group.name} />
                </Field>
                <Field label="Anchor address">
                  <input
                    name="anchorAddress"
                    className={inputClass}
                    defaultValue={group.anchorAddress}
                  />
                </Field>
              </div>
              <button type="submit" className={secondaryButtonClass}>
                Save group settings
              </button>
            </form>

            <form action={dissolveGroup}>
              <input type="hidden" name="groupId" value={group.id} />
              <button type="submit" className={dangerButtonClass}>
                Dissolve this group
              </button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
