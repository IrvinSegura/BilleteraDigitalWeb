import { StatusBadge } from '@/components/StatusBadge'
import { casePriority, caseResolution, supportStatus } from '@/lib/labels'

/** Only an urgent case gets a badge: a normal one, or one older than priorities, says nothing. */
export function CaseUrgency({ priority }: { priority: string | undefined }) {
  return priority === 'HIGH' ? <StatusBadge value={priority} map={casePriority} /> : null
}

/** Where a case is; once closed, how it ended says more than that it closed. */
export function CaseOutcome({ status, resolution }: { status: string | undefined; resolution: string | undefined }) {
  return status === 'RESOLVED' && resolution
    ? <StatusBadge value={resolution} map={caseResolution} />
    : <StatusBadge value={status} map={supportStatus} />
}
