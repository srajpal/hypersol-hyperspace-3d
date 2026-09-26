import type { ShellBridge } from '../shared/commands';
import type { DataOp, DataRequest, DataResults } from '../shared/data';
import type { PrivacyOp, PrivacyRequest, PrivacyResults } from '../shared/privacy';
import type { PermissionOp, PermissionRequest, PermissionResults } from '../shared/permissions';
import type { PasswordOp, PasswordRequest, PasswordResults } from '../shared/passwords';

/** Saved-data requests from the shell; errors arrive as thrown Errors with plain messages. */
export class DataClient {
  constructor(private readonly bridge: ShellBridge) {}

  async get<K extends DataOp>(request: Extract<DataRequest, { op: K }>): Promise<DataResults[K]> {
    const reply = await this.bridge.data(request);
    if (!reply.ok) throw new Error(reply.error);
    return reply.value as DataResults[K];
  }
}

/** Privacy requests from the shell (shield, filter lists, DNS); errors arrive as thrown Errors. */
export class PrivacyClient {
  constructor(private readonly bridge: ShellBridge) {}

  async get<K extends PrivacyOp>(request: Extract<PrivacyRequest, { op: K }>): Promise<PrivacyResults[K]> {
    const reply = await this.bridge.privacy(request);
    if (!reply.ok) throw new Error(reply.error);
    return reply.value as PrivacyResults[K];
  }
}

/** Site permission requests (milestone 9): prompt answers and the site panel. */
export class PermissionsClient {
  constructor(private readonly bridge: ShellBridge) {}

  async get<K extends PermissionOp>(request: Extract<PermissionRequest, { op: K }>): Promise<PermissionResults[K]> {
    const reply = await this.bridge.permissions(request);
    if (!reply.ok) throw new Error(reply.error);
    return reply.value as PermissionResults[K];
  }
}

/** Saved password requests (milestone 9): the Library's Passwords tab and save offers. */
export class PasswordsClient {
  constructor(private readonly bridge: ShellBridge) {}

  async get<K extends PasswordOp>(request: Extract<PasswordRequest, { op: K }>): Promise<PasswordResults[K]> {
    const reply = await this.bridge.passwords(request);
    if (!reply.ok) throw new Error(reply.error);
    return reply.value as PasswordResults[K];
  }
}

export interface DayGroup<T> {
  label: string;
  items: T[];
}

/**
 * Groups history entries (newest first) by the day they were visited:
 * "Today", "Yesterday", then the date, in the viewer's own time zone.
 */
export function groupByDay<T extends { visitedAt: number }>(
  entries: readonly T[],
  now: Date = new Date(),
  locale?: string,
): DayGroup<T>[] {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOf(now);
  const yesterday = startOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups: DayGroup<T>[] = [];
  for (const entry of entries) {
    const day = startOf(new Date(entry.visitedAt));
    const label =
      day === today
        ? 'Today'
        : day === yesterday
          ? 'Yesterday'
          : new Date(day).toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}
