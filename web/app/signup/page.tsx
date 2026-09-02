import { AuthForm } from "@/components/AuthForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-[var(--indigo)] underline">
        Back to the shop
      </Link>
      <div className="mt-8">
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
