import { VerificationChannel } from "@prisma/client";
import { prisma } from "./db";
import { notify } from "./notifications";

const CODE_TTL_MINUTES = 15;

export function showDevCodes(): boolean {
  return process.env.SHOW_DEV_VERIFICATION_CODES === "true";
}

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueVerificationCode(
  user: { id: string; email: string; phone: string },
  channel: VerificationChannel,
): Promise<string> {
  const code = randomCode();
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      channel,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });
  await notify({
    userId: user.id,
    type: "VERIFICATION",
    subject: "Your Carpool verification code",
    body: `Your Carpool verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    email: channel === VerificationChannel.EMAIL ? user.email : undefined,
    phone: channel === VerificationChannel.SMS ? user.phone : undefined,
  });
  return code;
}

export async function consumeVerificationCode(
  userId: string,
  channel: VerificationChannel,
  code: string,
): Promise<boolean> {
  const record = await prisma.verificationCode.findFirst({
    where: { userId, channel, code, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;
  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data:
        channel === VerificationChannel.EMAIL
          ? { emailVerifiedAt: new Date() }
          : { phoneVerifiedAt: new Date() },
    }),
  ]);
  return true;
}

/** Latest unconsumed code, surfaced in the UI only when dev codes are enabled. */
export async function latestDevCode(
  userId: string,
  channel: VerificationChannel,
): Promise<string | null> {
  if (!showDevCodes()) return null;
  const record = await prisma.verificationCode.findFirst({
    where: { userId, channel, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return record?.code ?? null;
}
