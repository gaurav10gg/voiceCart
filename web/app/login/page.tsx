import { AuthForm } from "@/components/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-[var(--indigo)] underline">
        Back to the shop
      </Link>
      <p className="mt-4">
        New here?{" "}
        <Link href="/signup" className="underline">
          Make an account
        </Link>
      </p>
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
