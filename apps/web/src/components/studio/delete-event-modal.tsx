"use client";

import { Modal, dangerBtn, ghostBtn } from "@/components/admin/ui";

/** Confirmation for the soft delete of an event (EVT-6). Used by the events list and the event settings tab. */
export function DeleteEventModal({
  event,
  busy,
  onCancel,
  onConfirm,
}: {
  event: { name: string } | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={event !== null}
      onClose={onCancel}
      icon="warning"
      tone="danger"
      title="Delete this event?"
      description={event ? `"${event.name}" will be hidden everywhere, and its QR code and guest links will stop working.` : undefined}
      footer={
        <>
          <button type="button" className={ghostBtn} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={dangerBtn} onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting..." : "Yes, delete"}
          </button>
        </>
      }
    >
      <p className="text-body-sm text-on-surface-variant">
        Its photos, guests and matches are hidden with it. The files are kept, so the Super Admin can still see the storage it uses.
      </p>
    </Modal>
  );
}
