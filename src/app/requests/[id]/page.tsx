import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Page } from "@/components/app-shell";
import { idSchema } from "@/domain/teams";
import { serialize } from "@/lib/api";
import { getViewer } from "@/server/auth/guards";
import { getPageViewer, loginHref } from "@/server/auth/pages";
import type { Viewer } from "@/server/auth/viewer";
import { withTx } from "@/server/db/client";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { getRequestView, listMessages } from "@/server/services/requests";
import { RequestThread, type Done } from "./request-thread";

/** The request as the viewer may see it, or a 404. Thread access is decided by the service. */
async function load(rawId: string, viewer: Viewer) {
  const id = idSchema.safeParse(rawId);
  if (!id.success) notFound();
  try {
    return await withTx(async (tx) => {
      const view = await getRequestView(tx, viewer, id.data);
      const messages = view.canViewThread ? await listMessages(tx, viewer, id.data) : [];
      return { view, messages };
    });
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata(props: PageProps<"/requests/[id]">): Promise<Metadata> {
  const viewer = await getViewer();
  if (!viewer) return { title: "Blocker" };
  const { view } = await load((await props.params).id, viewer);
  return { title: view.request.title };
}

export default async function RequestPage(props: PageProps<"/requests/[id]">) {
  const { id } = await props.params;
  const viewer = await getPageViewer();
  if (!viewer) redirect(loginHref(`/requests/${id}`));

  const { view, messages } = await load(id, viewer);
  const { done } = await props.searchParams;

  return (
    <Page>
      <RequestThread
        initialView={serialize(view)}
        initialMessages={serialize(messages)}
        timeZone={env.eventTimezone}
        done={done === "post" || done === "accept" ? (done satisfies Done) : null}
      />
    </Page>
  );
}
