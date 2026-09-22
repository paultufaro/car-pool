import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createRoute } from "@/app/actions/routes";
import { CreateRouteForm } from "@/components/forms";
import { Card } from "@/components/ui";

export default async function NewRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: id, userId: user.id } },
    include: { group: true },
  });
  if (!membership) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Card
        title={`Propose a route in ${membership.group.name}`}
        description={`Destination defaults to the group anchor: ${membership.group.anchorAddress}`}
      >
        <CreateRouteForm action={createRoute} groupId={id} />
      </Card>
    </div>
  );
}
