import Link from "next/link";
import { notFound } from "next/navigation";
import { SwapStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scoreFamilyAgainstRoute } from "@/lib/matching";
import { DAY_LABELS, formatDate, startOfDayUtc } from "@/lib/schedule";
import { joinRoute, leaveRoute } from "@/app/actions/routes";
import { cancelSwap, claimSwap, requestSwap } from "@/app/actions/swaps";
import {
  Badge,
  buttonClass,
  Card,
  dangerButtonClass,
  EmptyState,
  secondaryButtonClass,
} from "@/components/ui";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const family = user.family!;
  const today = startOfDayUtc(new Date());

  const route = await prisma.route.findUnique({
    where: { id },
    include: {
      group: true,
      members: { include: { family: { include: { members: true, children: true } } } },
      assignments: {
        where: { date: { gte: today } },
        include: {
          family: { include: { primaryUser: true } },
          swapRequests: { include: { requestedBy: true }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { date: "asc" },
        take: 20,
      },
    },
  });
  if (!route) notFound();

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: route.groupId, userId: user.id } },
  });
  if (!membership) notFound();

  const joined = route.members.some((member) => member.familyId === family.id);
  const score = scoreFamilyAgainstRoute(family, route);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{route.name}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/groups/${route.groupId}`} className="text-sky-700 hover:underline">
              {route.group.name}
            </Link>{" "}
            · {route.originDescription} → {route.destinationDescription}
          </p>
          <p className="text-sm text-slate-500">
            {route.daysOfWeek.map((day) => DAY_LABELS[day]).join(" ")} · {route.timeWindowStart}–
            {route.timeWindowEnd} ·{" "}
            {route.rotationWeeks === 1 ? "weekly" : `${route.rotationWeeks}-week`} rotation
          </p>
        </div>
        {joined ? (
          <form action={leaveRoute}>
            <input type="hidden" name="routeId" value={route.id} />
            <button type="submit" className={secondaryButtonClass}>
              Leave route
            </button>
          </form>
        ) : (
          <div className="text-right">
            {score.matches && (
              <p className="mb-2 text-xs text-slate-500">
                {score.milesFromOrigin.toFixed(1)} mi from your home
              </p>
            )}
            <form action={joinRoute}>
              <input type="hidden" name="routeId" value={route.id} />
              <button type="submit" className={buttonClass}>
                Join this carpool
              </button>
            </form>
          </div>
        )}
      </div>

      {route.members.length < 2 && (
        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
          A rotating schedule starts once a second family joins.
        </p>
      )}

      <Card title="Driving rotation" description="Next eight weeks.">
        {route.assignments.length === 0 ? (
          <EmptyState>No schedule yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {route.assignments.map((assignment) => {
              const openSwap = assignment.swapRequests.find(
                (swap) => swap.status === SwapStatus.OPEN,
              );
              const mine = assignment.familyId === family.id;
              return (
                <li key={assignment.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-32 text-sm text-slate-600">{formatDate(assignment.date)}</span>
                  <span className="flex-1 text-sm font-medium text-slate-900">
                    {mine ? "You" : assignment.family.primaryUser.name}
                    {assignment.status === "SWAPPED" && (
                      <span className="ml-2 text-xs font-normal text-slate-500">(swapped)</span>
                    )}
                  </span>
                  {openSwap ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="amber">Needs cover</Badge>
                      {openSwap.requestedById === user.id ? (
                        <form action={cancelSwap}>
                          <input type="hidden" name="swapId" value={openSwap.id} />
                          <button type="submit" className={secondaryButtonClass}>
                            Cancel request
                          </button>
                        </form>
                      ) : (
                        joined && (
                          <form action={claimSwap}>
                            <input type="hidden" name="swapId" value={openSwap.id} />
                            <button type="submit" className={buttonClass}>
                              I&apos;ll drive
                            </button>
                          </form>
                        )
                      )}
                    </div>
                  ) : (
                    mine && (
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
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title="Families on this route"
        description={
          joined
            ? "You share a route, so pickup addresses are visible to each other."
            : "Join the route to see pickup details."
        }
      >
        <ul className="divide-y divide-slate-100">
          {route.members.map((member) => (
            <li key={member.id} className="py-3">
              <p className="text-sm font-medium text-slate-900">
                {member.family.members.map((parent) => parent.name).join(", ")}
              </p>
              <p className="text-xs text-slate-500">
                {joined ? member.family.homeAddress : member.family.neighborhood}
                {member.family.children.length > 0 &&
                  ` · ${member.family.children
                    .map((child) => `${child.firstName} (${child.grade})`)
                    .join(", ")}`}
              </p>
              {joined && (
                <p className="text-xs text-slate-500">
                  {member.family.members.map((parent) => parent.phone).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
