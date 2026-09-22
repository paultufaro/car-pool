import { requireVerifiedUser } from "@/lib/auth";
import { createFamilyProfile } from "../actions/auth";
import { FamilyForm } from "@/components/forms";
import { Card } from "@/components/ui";

export default async function OnboardingPage() {
  const user = await requireVerifiedUser();
  return (
    <div className="mx-auto max-w-md">
      <Card
        title="Set up your family"
        description="This is what route matching runs on. You can edit it later."
      >
        <FamilyForm action={createFamilyProfile} defaultAddress={user.family?.homeAddress} />
      </Card>
    </div>
  );
}
