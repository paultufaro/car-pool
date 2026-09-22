import Link from "next/link";
import { SwapStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rankRoutesForFamily } from "@/lib/matching";
import { formatDate, startOfDayUtc, DAY_LABELS } from "@/lib/schedule";
import { claimSwap, requestSwap } from "../actions/swaps";
import {
  Badge,
  buttonClass,
  Card,
  dangerButtonClass,
  EmptyState,
  secondaryButtonClass,
} from "@/components/ui";

const GROUP_TYPE_LABELS: Record<string, string> = {
  SCHOOL: "School",
  SPORTS: "Sports",
  ACTIVITY: "Activity",
  NEIGHBORHOOD: "Neighborhood",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const family = user.family!;
  const today = startOfDayUtc(new Date());

  const [memberships, assignments, openSwaps, myRoutes] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: user.id },
      include: { group: { include: { _count: { select: { members: true, routes: true } } } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.drivingAssignment.findMany({
      where: { familyId: family.id, date: { gte: today } },
      include: {
        route: { include: { group: true, _count: { select: { members: true } } } },
        swapRequests: { where: { status: SwapStatus.OPEN } },
      },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.swapRequest.findMany({
      where: {
        status: SwapStatus.OPEN,
        assignment: {
          date: { gte: today },
          route: { members: { some: { familyId: family.id } } },
        },
      },
      include: {
        requestedBy: true,
        assignment: { include: { route: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.route.findMany({
      where: { members: { some: { familyId: family.id } } },
      include: { group: true, _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const groupIds = memberships.map((membership) => membership.groupId);
  const candidateRoutes = await prisma.route.findMany({
    where: { groupId: { in: groupIds }, members: { none: { familyId: family.id } } },
    include: { group: true, _count: { select: { members: true } } },
  });
  const suggestions = rankRoutesForFamily(family, candidateRoutes).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hi {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500">
            {family.neighborhood} · {family.children.length} kid
            {family.children.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/groups/join" className={secondaryButtonClass}>
            Join a group
          </Link>
          <Link href="/groups/new" className={buttonClass}>
            Create a group
          </Link>
        </div>
      </div>

      <Card title="Your next driving days">
        {assignments.length === 0 ? (
          <EmptyState>
            Nothing scheduled yet. Join a route and the rotation fills in automatically.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-40">
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(assignment.date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {assignment.route.timeWindowStart}–{assignment.route.timeWindowEnd}
                  </p>
                </div>
                <div className="flex-1">
                  <Link
                    href={`/routes/${assignment.routeId}`}
                    className="text-sm font-medium text-sky-700 hover:underline"
                  >
                    {assignment.route.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {assignment.route.group.name} · {assignment.route._count.members} families
                  </p>
                </div>
                {assignment.swapRequests.length > 0 ? (
                  <Badge tone="amber">Swap requested</Badge>
                ) : (
                  <form action={requestSwap} className="flex items-center gap-2">
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input
                      name="note"
                      placeholder="Reason (optional)"
                      className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button type="submit" className={dangerButtonClass}>
                      Can&apos;t drive
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Swap requests in your carpools">
        {openSwaps.length === 0 ? (
          <EmptyState>No one needs cover right now.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {openSwaps.map((swap) => (
              <li key={swap.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="text-sm text-slate-900">
                    {swap.requestedBy.name} needs cover on {formatDate(swap.assignment.date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {swap.assignment.route.name}
                    {swap.note ? ` · ${swap.note}` : ""}
                  </p>
                </div>
                {swap.assignment.familyId === family.id ? (
                  <Badge tone="amber">Yours</Badge>
                ) : (
                  <form action={claimSwap}>
                    <input type="hidden" name="swapId" value={swap.id} />
                    <button type="submit" className={buttonClass}>
                      I&apos;ll drive
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {suggestions.length > 0 && (
        <Card
          title="Suggested carpools near you"
          description="Routes in your groups that start close to home."
        >
          <ul className="divide-y divide-slate-100">
            {suggestions.map(({ route, score }) => (
              <li key={route.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <Link
                    href={`/routes/${route.id}`}
                    className="text-sm font-medium text-sky-700 hover:underline"
                  >
                    {route.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {route.group.name} · {route.originDescription} → {route.destinationDescription}{" "}
                    · {route.daysOfWeek.map((day) => DAY_LABELS[day]).join(" ")}
                  </p>
                </div>
                <Badge tone="sky">{score.milesFromOrigin.toFixed(1)} mi away</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Your groups">
          {memberships.length === 0 ? (
            <EmptyState>Join a group with an invite code to get started.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {memberships.map((membership) => (
                <li key={membership.id} className="flex items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/groups/${membership.groupId}`}
                      className="text-sm font-medium text-sky-700 hover:underline"
                    >
                      {membership.group.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {GROUP_TYPE_LABELS[membership.group.type]} ·{" "}
                      {membership.group._count.members} families ·{" "}
                      {membership.group._count.routes} routes
                    </p>
                  </div>
                  {membership.role === "ADMIN" && <Badge tone="sky">Admin</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Your routes">
          {myRoutes.length === 0 ? (
            <EmptyState>You haven&apos;t joined a route yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {myRoutes.map((route) => (
                <li key={route.id}>
                  <Link
                    href={`/routes/${route.id}`}
                    className="text-sm font-medium text-sky-700 hover:underline"
                  >
                    {route.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {route.group.name} · {route._count.members} families ·{" "}
                    {route.daysOfWeek.map((day) => DAY_LABELS[day]).join(" ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
