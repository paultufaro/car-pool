import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { buttonClass, Card, SafetyNote, secondaryButtonClass } from "@/components/ui";

const STEPS = [
  {
    title: "Join your group",
    body: "Groups are invite-only — a class, a travel team, a street. No public browsing, no strangers.",
  },
  {
    title: "Propose a route",
    body: "Say where you leave from, where you're going and which mornings. Nearby families in the group get suggested the match.",
  },
  {
    title: "Share the driving",
    body: "Once two families commit, Carpool builds the rotating calendar, sends reminders and handles swaps in one tap.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-sm font-medium text-sky-700">Pilot: Summit, NJ and neighboring towns</p>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          The carpools already happen. Stop running them out of a group text.
        </h1>
        <p className="max-w-2xl text-slate-600">
          Carpool is a shared scheduling layer for parents who already know each other — school
          runs, practices and activities, with a rotating driving calendar and one-tap swaps.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className={buttonClass}>
            Get started
          </Link>
          <Link href="/login" className={secondaryButtonClass}>
            I already have an account
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.title} title={step.title}>
            <p className="text-sm text-slate-600">{step.body}</p>
          </Card>
        ))}
      </div>

      <SafetyNote />
    </div>
  );
}
