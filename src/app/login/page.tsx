import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { LoginForm } from "./LoginForm";
import { Sparkles } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-amber/5 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg mb-4">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-xs">
            Generate business documents dynamically with configurable templates.
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="rounded-xl border bg-card shadow-sm p-8 animate-slide-up">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
