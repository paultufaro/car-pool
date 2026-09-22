import Link from "next/link";
import { signUp } from "../actions/auth";
import { SignUpForm } from "@/components/forms";
import { Card, SafetyNote } from "@/components/ui";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card
        title="Create your account"
        description="Email and phone are verified so group admins know who's joining."
      >
        <SignUpForm action={signUp} />
        <p className="mt-4 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-sky-700 hover:underline">
            Log in
          </Link>
        </p>
      </Card>
      <SafetyNote />
    </div>
  );
}
