"use client";

import { useActionState, useState } from "react";
import { GroupType } from "@prisma/client";
import type { FormState } from "@/app/actions/auth";
import { buttonClass, Field, inputClass, secondaryButtonClass } from "./ui";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.message) return <p className="text-sm text-emerald-700">{state.message}</p>;
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button type="submit" className={buttonClass} disabled={pending}>
      {pending ? "Working…" : children}
    </button>
  );
}

/** Submit button that asks before running an irreversible admin action. */
export function ConfirmButton({
  children,
  confirmation,
  className,
}: {
  children: string;
  confirmation: string;
  className: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function SignUpForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Your name">
        <input name="name" className={inputClass} autoComplete="name" required />
      </Field>
      <Field label="Email">
        <input name="email" type="email" className={inputClass} autoComplete="email" required />
      </Field>
      <Field label="Mobile phone" hint="Used for driving reminders and swap alerts.">
        <input name="phone" className={inputClass} autoComplete="tel" required />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          className={inputClass}
          autoComplete="new-password"
          required
        />
      </Field>
      <Feedback state={state} />
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}

export function LogInForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" className={inputClass} autoComplete="email" required />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          className={inputClass}
          autoComplete="current-password"
          required
        />
      </Field>
      <Feedback state={state} />
      <Submit pending={pending}>Log in</Submit>
    </form>
  );
}

export function VerifyForm({
  action,
  resend,
  channel,
  label,
  devCode,
}: {
  action: Action;
  resend: Action;
  channel: "EMAIL" | "SMS";
  label: string;
  devCode: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [resendState, resendAction] = useActionState(resend, {});
  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="channel" value={channel} />
        <div className="flex-1">
          <Field label={label}>
            <input
              name="code"
              inputMode="numeric"
              className={inputClass}
              defaultValue={devCode ?? ""}
              required
            />
          </Field>
        </div>
        <Submit pending={pending}>Verify</Submit>
      </form>
      <form action={resendAction}>
        <input type="hidden" name="channel" value={channel} />
        <button type="submit" className="text-sm text-sky-700 hover:underline">
          Send a new code
        </button>
      </form>
      <Feedback state={state} />
      <Feedback state={resendState} />
    </div>
  );
}

export function FamilyForm({
  action,
  defaultAddress,
}: {
  action: Action;
  defaultAddress?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [children, setChildren] = useState([0]);
  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Home address"
        hint="Used only to match you to nearby routes. Other parents see your town, never your street address, until you share a route."
      >
        <input
          name="homeAddress"
          className={inputClass}
          defaultValue={defaultAddress}
          placeholder="12 Beekman Rd, Summit, NJ"
          required
        />
      </Field>
      <div className="space-y-3">
        <span className="text-sm font-medium text-slate-700">Kids</span>
        {children.map((key) => (
          <div key={key} className="flex gap-3">
            <input name="childName" className={inputClass} placeholder="First name" />
            <input name="childGrade" className={inputClass} placeholder="Grade / age" />
          </div>
        ))}
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => setChildren((prev) => [...prev, prev.length])}
        >
          Add another kid
        </button>
      </div>
      <Feedback state={state} />
      <Submit pending={pending}>Save family profile</Submit>
    </form>
  );
}

export function CreateGroupForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Group name">
        <input
          name="name"
          className={inputClass}
          placeholder="Lincoln-Hubbard 3rd Grade"
          required
        />
      </Field>
      <Field label="Group type">
        <select name="type" className={inputClass} defaultValue={GroupType.SCHOOL}>
          <option value={GroupType.SCHOOL}>School class</option>
          <option value={GroupType.SPORTS}>Sports team</option>
          <option value={GroupType.ACTIVITY}>Activity</option>
          <option value={GroupType.NEIGHBORHOOD}>Neighborhood</option>
        </select>
      </Field>
      <Field label="Anchor address" hint="The school, field or meeting point this group drives to.">
        <input
          name="anchorAddress"
          className={inputClass}
          placeholder="52 Woodland Ave, Summit, NJ"
          required
        />
      </Field>
      <Feedback state={state} />
      <Submit pending={pending}>Create group</Submit>
    </form>
  );
}

export function JoinGroupForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Invite code" hint="Ask the group admin for the code. Groups are never public.">
        <input name="inviteCode" className={inputClass} placeholder="ABCD2345" required />
      </Field>
      <Feedback state={state} />
      <Submit pending={pending}>Join group</Submit>
    </form>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CreateRouteForm({ action, groupId }: { action: Action; groupId: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <Field label="Route name">
        <input name="name" className={inputClass} placeholder="Morning drop-off" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pickup area" hint="A neighborhood or cross street, not a house number.">
          <input
            name="originDescription"
            className={inputClass}
            placeholder="Summit, NJ — Franklin School area"
            required
          />
        </Field>
        <Field label="Destination">
          <input
            name="destinationDescription"
            className={inputClass}
            placeholder="52 Woodland Ave, Summit, NJ"
            required
          />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Days</legend>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((day, index) => (
            <label key={day} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                name="daysOfWeek"
                value={index}
                defaultChecked={index >= 1 && index <= 5}
              />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Earliest pickup">
          <input
            name="timeWindowStart"
            type="time"
            className={inputClass}
            defaultValue="07:45"
            required
          />
        </Field>
        <Field label="Latest pickup">
          <input
            name="timeWindowEnd"
            type="time"
            className={inputClass}
            defaultValue="08:10"
            required
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rotation">
          <select name="rotationWeeks" className={inputClass} defaultValue="1">
            <option value="1">Weekly — each family drives a full week</option>
            <option value="2">Biweekly — each family drives two weeks</option>
          </select>
        </Field>
        <Field label="Match radius (miles)" hint="How close a family's home must be to be suggested.">
          <input
            name="matchRadiusMiles"
            type="number"
            step="0.25"
            min="0.25"
            max="10"
            defaultValue="2"
            className={inputClass}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <Submit pending={pending}>Propose route</Submit>
    </form>
  );
}
