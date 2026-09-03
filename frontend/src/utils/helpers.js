/* ---- Stage helpers ---- */
export const STAGE_LABELS = {
    not_eligible: 'Not Eligible',
    criteria_passed: 'Criteria Passed',
    test_scheduled: 'Test Scheduled',
    awaiting_decision: 'Awaiting Decision',
    admitted: 'Admitted',
    not_admitted: 'Not Admitted',
}

export const STAGE_ORDER = [
    'inquiry',
    'criteria_passed',
    'not_eligible',
    'test_scheduled',
    'awaiting_decision',
    'admitted',
    'not_admitted',
]

export const KANBAN_COLUMNS = [
    { key: 'criteria_passed', label: 'Criteria Passed', color: 'var(--blue)' },
    { key: 'test_scheduled', label: 'Test Scheduled', color: 'var(--purple)' },
    { key: 'awaiting_decision', label: 'Awaiting Decision', color: 'var(--orange)' },
    { key: 'admitted', label: 'Admitted', color: 'var(--gold)' },
    { key: 'not_admitted', label: 'Not Admitted', color: 'var(--red)' },
    { key: 'not_eligible', label: 'Not Eligible', color: 'var(--muted)' },
]

export function stageBadgeClass(stage) {
    switch (stage) {
        case 'admitted': return 'badge-green'
        case 'not_admitted':
        case 'not_eligible': return 'badge-red'
        default: return 'badge-gray'
    }
}

export function formatDate(isoString) {
    if (!isoString) return '—'
    try {
        return new Date(isoString).toLocaleDateString('en-PK', {
            day: '2-digit', month: 'short', year: 'numeric',
        })
    } catch { return isoString }
}

export function formatDateTime(isoString) {
    if (!isoString) return '—'
    try {
        const d = new Date(isoString)
        return d.toLocaleDateString('en-PK', {
            day: '2-digit', month: 'short', year: 'numeric',
        }) + ' ' + d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
    } catch { return isoString }
}

export function calcAge(dob) {
    if (!dob) return null
    const ms = Date.now() - new Date(dob).getTime()
    return (ms / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)
}
