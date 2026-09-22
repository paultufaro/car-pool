import { prisma } from "./db";

export type NotificationType =
  | "VERIFICATION"
  | "ROUTE_MATCH"
  | "ROUTE_JOINED"
  | "SCHEDULE_PUBLISHED"
  | "DRIVING_REMINDER"
  | "SWAP_REQUESTED"
  | "SWAP_CLAIMED"
  | "GROUP_MEMBER_REMOVED";

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  subject: string;
  body: string;
  email?: string;
  phone?: string;
};

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/plain", value: body }],
    }),
  });
  return response.ok;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  return response.ok;
}

/**
 * Delivers over email and SMS when provider credentials are configured, and
 * always records the message in notifications_log so the pilot can be run and
 * demoed without provider accounts.
 */
export async function notify(input: NotificationInput): Promise<void> {
  const channels: string[] = [];
  try {
    if (input.email && (await sendEmail(input.email, input.subject, input.body))) {
      channels.push("email");
    }
    if (input.phone && (await sendSms(input.phone, input.body))) {
      channels.push("sms");
    }
  } catch (error) {
    console.error("notification provider failed", error);
  }
  if (channels.length === 0) {
    channels.push("logged");
    console.info(`[notification:${input.type}] ${input.subject} — ${input.body}`);
  }
  await prisma.notificationLog.create({
    data: {
      userId: input.userId,
      type: input.type,
      channel: channels.join(","),
      subject: input.subject,
      body: input.body,
    },
  });
}

export async function notifyUsers(
  users: { id: string; email: string; phone: string }[],
  message: { type: NotificationType; subject: string; body: string },
): Promise<void> {
  for (const user of users) {
    await notify({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      ...message,
    });
  }
}
