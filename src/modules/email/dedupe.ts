import type { EmailEventType, EntityType } from "./types";

export function buildDedupeKey(params: {
  eventType: EmailEventType;
  entityType: EntityType;
  entityId: string;
  recipient: string;
}) {
  const { eventType, entityType, entityId, recipient } = params;
  return `${eventType}:${entityType}:${entityId}:${recipient}`;
}
