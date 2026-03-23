import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">ODCHC PRISP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          PRS Intelligence & Strategy Portal - Central Brain for operations, finance, and productivity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/task-tracker">
          <Card className="h-full cursor-pointer transition hover:border-primary">
            <CardHeader>
              <CardTitle>PRS Unit Task Tracker</CardTitle>
              <CardDescription>
                Spreadsheet-style task operations with Table and Kanban views.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Open module</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
