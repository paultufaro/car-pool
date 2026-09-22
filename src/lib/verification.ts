import { randomInt, timingSafeEqual } from "node:crypto";
import { VerificationChannel } from "@prisma/client";
import { prisma } from "./db";
import { notify } from "./notifications";

const CODE_TTL_MINUTES = 15;
const MAX_CODES_PER_WINDOW = 5;
const MAX_ATTEMPTS_PER_CODE = 5;

/** Dev codes are a local convenience and are never honoured in production. */
export function showDevCodes(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SHOW_DEV_VERIFICATION_CODES === "true";
}

function randomCode(): string {
  return String(randomInt(100000, 1000000));
}

function codesMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Throttles code issuance per user and channel so resends can't be abused. */
export async function verificationSendsExhausted(
  userId: string,
  channel: VerificationChannel,
): Promise<boolean> {
  const since = new Date(Date.now() - CODE_TTL_MINUTES * 60 * 1000);
  const recent = await prisma.verificationCode.count({
    where: { userId, channel, createdAt: { gt: since } },
  });
  return recent >= MAX_CODES_PER_WINDOW;
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
    where: { userId, channel, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_ATTEMPTS_PER_CODE) return false;
  if (!codesMatch(record.code, code)) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }
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
