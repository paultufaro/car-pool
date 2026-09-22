import { requireUser } from "@/lib/auth";
import { joinGroup } from "@/app/actions/groups";
import { JoinGroupForm } from "@/components/forms";
import { Card } from "@/components/ui";

export default async function JoinGroupPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <Card title="Join a group" description="Groups are invite-only and never publicly listed.">
        <JoinGroupForm action={joinGroup} />
      </Card>
    </div>
  );
}
