import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDemoRequest, WORKED_REQUEST_ID } from "@/demo/fixtures";
import { DemoThread } from "@/demo/demo-thread";

export async function generateMetadata({ params }: PageProps<"/demo/requests/[id]">): Promise<Metadata> {
  const request = getDemoRequest((await params).id);
  return { title: request?.title ?? "Blocker" };
}

export default async function DemoRequestPage({ params, searchParams }: PageProps<"/demo/requests/[id]">) {
  const request = getDemoRequest((await params).id);
  if (!request) notFound();
  // Links to the worked thread's confirmation (from the receipt) open it already confirmed.
  const startConfirmed = (await searchParams).confirmed === "1";

  return (
    <DemoThread
      key={`${request.id}-${startConfirmed}`}
      request={request}
      interactive={request.id === WORKED_REQUEST_ID}
      startConfirmed={startConfirmed}
    />
  );
}
