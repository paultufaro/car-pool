import { Card } from "@/components/ui";

export const metadata = { title: "Terms of Service — Carpool" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Placeholder text pending legal review. Do not treat this as final terms of service.
      </p>
      <Card title="Terms of Service">
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Carpool is a scheduling and coordination tool for parents who already know each other
            through a school, team, activity or neighborhood. It is not a transportation provider,
            a rideshare service, or a driver marketplace.
          </p>
          <h3 className="font-semibold text-slate-900">What Carpool does not do</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>We do not vet, screen, or run background checks on any driver.</li>
            <li>We do not verify licenses, vehicles, or insurance coverage.</li>
            <li>We do not supervise, track, or take responsibility for any trip.</li>
            <li>We do not process payments between families.</li>
          </ul>
          <h3 className="font-semibold text-slate-900">Your responsibility</h3>
          <p>
            Every carpool arrangement is a private agreement between the parents involved. You are
            responsible for deciding who drives your children, and for confirming that any driver
            is licensed and insured.
          </p>
          <h3 className="font-semibold text-slate-900">Privacy of addresses</h3>
          <p>
            Home addresses are used to calculate proximity for route suggestions. Other members see
            only an approximate area label until both families join the same route.
          </p>
          <h3 className="font-semibold text-slate-900">Group admins</h3>
          <p>
            Group admins can remove members and dissolve groups at any time. Groups are invite-only
            and are never publicly discoverable.
          </p>
        </div>
      </Card>
    </div>
  );
}
