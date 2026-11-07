import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GUEST_SESSION_COOKIE, getPublicEvent, signedInGalleryToken } from "@instantphotos/core";
import { GuestMessage } from "@/components/guest/message";
import { Registration } from "@/components/guest/register";

export const dynamic = "force-dynamic";

const load = cache((code: string) => getPublicEvent(code));

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const event = await load((await params).code);
  return { title: event ? `${event.name} · ${event.studio.studioName}` : "Event not found · InstantPhotos" };
}

/** G01 (GST-1, GST-8): the page the QR code opens. */
export default async function EventPage({ params }: { params: Promise<{ code: string }> }) {
  const event = await load((await params).code);
  if (!event) return <GuestMessage kind="not_found" />;

  const token = await signedInGalleryToken(event.id, (await cookies()).get(GUEST_SESSION_COOKIE)?.value);
  const galleryPath = token ? `/g/${token}` : null;
  const openGallery = galleryPath ? { label: "Open my photos", icon: "arrow_forward", href: galleryPath } : undefined;

  if (event.state === "expired") return <GuestMessage kind="expired" studio={event.studio} />;
  if (event.state === "closed") return <GuestMessage kind="closed" studio={event.studio} action={openGallery} />;
  return <Registration event={event} galleryPath={galleryPath} />;
}
