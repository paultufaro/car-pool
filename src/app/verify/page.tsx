import { redirect } from "next/navigation";
import { VerificationChannel } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { latestDevCode, showDevCodes } from "@/lib/verification";
import { resendCode, verify } from "../actions/auth";
import { VerifyForm } from "@/components/forms";
import { Badge, Card } from "@/components/ui";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt && user.phoneVerifiedAt) {
    redirect(user.familyId ? "/dashboard" : "/onboarding");
  }
  const [emailCode, smsCode] = await Promise.all([
    latestDevCode(user.id, VerificationChannel.EMAIL),
    latestDevCode(user.id, VerificationChannel.SMS),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card
        title="Verify your contact details"
        description="Carpool sends driving reminders and swap alerts to both, so we confirm each one."
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">{user.email}</span>
              {user.emailVerifiedAt ? <Badge tone="green">Verified</Badge> : <Badge>Pending</Badge>}
            </div>
            {!user.emailVerifiedAt && (
              <VerifyForm
                action={verify}
                resend={resendCode}
                channel="EMAIL"
                label="Email code"
                devCode={emailCode}
              />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span className="font-medium">{user.phone}</span>
              {user.phoneVerifiedAt ? <Badge tone="green">Verified</Badge> : <Badge>Pending</Badge>}
            </div>
            {!user.phoneVerifiedAt && (
              <VerifyForm
                action={verify}
                resend={resendCode}
                channel="SMS"
                label="Text message code"
                devCode={smsCode}
              />
            )}
          </div>
        </div>
      </Card>
      {showDevCodes() && (
        <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
          Dev mode: no SMS or email provider is configured, so codes are logged and pre-filled
          above. Set SHOW_DEV_VERIFICATION_CODES=false with real provider keys to disable this.
        </p>
      )}
    </div>
  );
}
