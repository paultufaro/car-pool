import Link from "next/link";
import { logIn } from "../actions/auth";
import { LogInForm } from "@/components/forms";
import { Card } from "@/components/ui";

export default function LogInPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card title="Log in">
        <LogInForm action={logIn} />
        <p className="mt-4 text-sm text-slate-500">
          New here?{" "}
          <Link href="/signup" className="text-sky-700 hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}
