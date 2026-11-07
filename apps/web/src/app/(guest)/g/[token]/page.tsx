import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GUEST_SESSION_COOKIE, galleryPage, openGallery } from "@instantphotos/core";
import { Gallery } from "@/components/guest/gallery";
import { GuestMessage } from "@/components/guest/message";
import { Reclaim } from "@/components/guest/reclaim";

export const dynamic = "force-dynamic";

const load = cache(async (token: string) => openGallery(token, (await cookies()).get(GUEST_SESSION_COOKIE)?.value));

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const access = await load((await params).token);
  return { title: access.state === "not_found" ? "Gallery not found · InstantPhotos" : `Your photos · ${access.event.name}` };
}

/** G04 (GAL-1..3): the guest's gallery, or the phone-number screen when this browser isn't signed in. */
export default async function GalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await load(token);
  if (access.state === "not_found") return <GuestMessage kind="gallery_not_found" />;
  if (access.state === "expired") return <GuestMessage kind="expired" studio={access.event.studio} />;
  if (access.state === "locked") return <Reclaim token={token} event={access.event} />;
  // key: a fresh render (after "Open my photos" or a refresh) starts the client state from the new first page.
  const initial = await galleryPage(access.guest.id, 1);
  return <Gallery key={`${access.guest.id}-${initial.total}`} token={token} event={access.event} guestName={access.guest.name} initial={initial} />;
}
