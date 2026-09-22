import { requireUser } from "@/lib/auth";
import { createGroup } from "@/app/actions/groups";
import { CreateGroupForm } from "@/components/forms";
import { Card } from "@/components/ui";

export default async function NewGroupPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <Card
        title="Create a group"
        description="You'll be the admin: you get an invite code to share and can remove members at any time."
      >
        <CreateGroupForm action={createGroup} />
      </Card>
    </div>
  );
}
