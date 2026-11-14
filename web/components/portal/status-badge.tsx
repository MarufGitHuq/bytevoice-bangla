import type { CallStatus } from '@/lib/db';
import { STATUS_LABELS, STATUS_STYLES } from '@/lib/portal-format';

export function StatusBadge({ status }: { status: CallStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
