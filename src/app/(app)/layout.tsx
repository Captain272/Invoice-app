import { redirect } from "next/navigation";
import { getSession } from "@/server/actions/auth-helper";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Providers } from "@/components/Providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar role={session.user.role} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header user={session.user} />
          <main className="flex-1 p-6 lg:p-8 max-w-[1600px] w-full mx-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
