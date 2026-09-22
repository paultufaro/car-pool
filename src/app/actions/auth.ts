"use server";

import { redirect } from "next/navigation";
import { VerificationChannel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { geocode } from "@/lib/geocoding";
import {
  consumeVerificationCode,
  issueVerificationCode,
  verificationSendsExhausted,
} from "@/lib/verification";

export type FormState = { error?: string; message?: string };

const signUpSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(10, "Enter a valid phone number"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { error: "An account with that email already exists" };

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await issueVerificationCode(user, VerificationChannel.EMAIL);
  await issueVerificationCode(user, VerificationChannel.SMS);
  await createSession(user.id);
  redirect("/verify");
}

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email or password is incorrect" };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function verify(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const channel =
    String(formData.get("channel")) === "SMS"
      ? VerificationChannel.SMS
      : VerificationChannel.EMAIL;
  const code = String(formData.get("code") ?? "").trim();
  const ok = await consumeVerificationCode(user.id, channel, code);
  if (!ok) return { error: "That code is invalid, expired or has been tried too many times" };

  const updated = await prisma.user.findUnique({ where: { id: user.id } });
  if (updated?.emailVerifiedAt && updated?.phoneVerifiedAt) {
    redirect(updated.familyId ? "/dashboard" : "/onboarding");
  }
  return { message: `${channel === VerificationChannel.SMS ? "Phone" : "Email"} verified` };
}

export async function resendCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const channel =
    String(formData.get("channel")) === "SMS"
      ? VerificationChannel.SMS
      : VerificationChannel.EMAIL;
  if (await verificationSendsExhausted(user.id, channel)) {
    return { error: "Too many codes requested. Wait a few minutes and try again." };
  }
  await issueVerificationCode(user, channel);
  return { message: "New code sent" };
}

const familySchema = z.object({
  homeAddress: z.string().min(5, "Enter your home address"),
});

export async function createFamilyProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = familySchema.safeParse({ homeAddress: formData.get("homeAddress") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const location = await geocode(parsed.data.homeAddress);
  const childNames = formData.getAll("childName").map(String);
  const childGrades = formData.getAll("childGrade").map(String);
  const children = childNames
    .map((firstName, index) => ({ firstName: firstName.trim(), grade: childGrades[index] ?? "" }))
    .filter((child) => child.firstName.length > 0);

  const family = await prisma.family.upsert({
    where: { primaryUserId: user.id },
    create: {
      primaryUserId: user.id,
      homeAddress: parsed.data.homeAddress,
      neighborhood: location.neighborhood,
      homeLat: location.lat,
      homeLng: location.lng,
      children: { create: children },
    },
    update: {
      homeAddress: parsed.data.homeAddress,
      neighborhood: location.neighborhood,
      homeLat: location.lat,
      homeLng: location.lng,
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { familyId: family.id } });
  redirect("/dashboard");
}
