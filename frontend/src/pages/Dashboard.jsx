import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getDashboardStats, getStudents, exportCSV } from '../api/client'
import { STAGE_LABELS, stageBadgeClass, formatDate, KANBAN_COLUMNS } from '../utils/helpers'
import RegisterModal from '../components/RegisterModal'
import ScheduleTestModal from '../components/ScheduleTestModal'
import ScoreEntryModal from '../components/ScoreEntryModal'
import DecisionModal from '../components/DecisionModal'
import JoiningModal from '../components/JoiningModal'
import styles from './Dashboard.module.css'

const KANBAN_STAGES = ['criteria_passed', 'test_scheduled', 'awaiting_decision', 'admitted']

const STAT_CARDS = [
    { key: 'total', label: 'Total Registered', color: 'var(--text-secondary)', stage: null },
    { key: 'not_eligible', label: 'Not Eligible', color: 'var(--red)', stage: 'not_eligible' },
    { key: 'criteria_passed', label: 'Criteria Passed', color: 'var(--blue)', stage: 'criteria_passed' },
    { key: 'test_scheduled', label: 'Test Scheduled', color: 'var(--purple)', stage: 'test_scheduled' },
    { key: 'awaiting_decision', label: 'Awaiting Decision', color: 'var(--orange)', stage: 'awaiting_decision' },
    { key: 'admitted', label: 'Admitted', color: 'var(--gold)', stage: 'admitted' },
    { key: 'not_admitted', label: 'Not Admitted', color: 'var(--red-dim)', stage: 'not_admitted' },
    { key: 'admitted_not_joined', label: "Didn't Join", color: 'var(--muted)', stage: 'admitted' },
]

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('kanban')  // 'kanban' | 'table'
    const [search, setSearch] = useState('')
    const [stageFilter, setStageFilter] = useState(null)
    const [sortCol, setSortCol] = useState('registered_at')
    const [sortDir, setSortDir] = useState('desc')
    const [showRegister, setShowRegister] = useState(false)
    const [actionModal, setActionModal] = useState(null) // { type, student }
    const [exporting, setExporting] = useState(false)

    const fetchAll = useCallback(async () => {
        try {
            const [sRes, stRes] = await Promise.all([getDashboardStats(), getStudents()])
            setStats(sRes.data)
            setStudents(stRes.data)
        } catch (err) {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(fetchAll, 30000)
        return () => clearInterval(interval)
    }, [fetchAll])

    function getStatValue(card) {
        if (!stats) return '—'
        if (card.key === 'total') return stats.total
        if (card.key === 'admitted_not_joined') return stats.admitted_not_joined
        return stats.by_stage?.[card.key] ?? 0
    }

    function handleStatClick(card) {
        if (card.stage) {
            setStageFilter(card.key === 'admitted_not_joined' ? 'admitted' : card.stage)
            setView('table')
        } else {
            setStageFilter(null)
            setView('table')
        }
    }

    const filtered = students.filter(s => {
        const q = search.toLowerCase()
        const matchSearch = !search
            || s.name.toLowerCase().includes(q)
            || (s.gr_number || '').toLowerCase().includes(q)
            || s.class_applied_for.toLowerCase().includes(q)
        const matchStage = !stageFilter || s.stage === stageFilter
        return matchSearch && matchStage
    })

    function sorted(list) {
        return [...list].sort((a, b) => {
            let av = a[sortCol], bv = b[sortCol]
            if (sortCol === 'registered_at') {
                av = new Date(av); bv = new Date(bv)
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1
            if (av > bv) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }

    function handleSort(col) {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortCol(col); setSortDir('asc') }
    }

    function openAction(type, student) { setActionModal({ type, student }) }
    function closeAction() { setActionModal(null) }

    function afterAction() {
        closeAction()
        fetchAll()
    }

    async function handleDelete(student) {
        if (!window.confirm(`Are you sure you want to completely delete the record for ${student.name}?`)) return
        try {
            const tid = toast.loading('Deleting...')
            await api.delete(`/students/${student.id}`)
            toast.success('Record deleted successfully!', { id: tid })
            fetchAll()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to delete record')
        }
    }

    async function handleExport() {
        setExporting(true)
        try {
            const res = await exportCSV()
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
            const a = document.createElement('a')
            a.href = url
            a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('CSV exported')
        } catch { toast.error('Export failed') }
        finally { setExporting(false) }
    }

    if (loading) return (
        <div className={styles.loadingScreen}>
            <div className="spinner" /><span>Loading dashboard…</span>
        </div>
    )

    return (
        <div className={styles.page}>
            {/* ---- Header ---- */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Admission Control Room</h1>
                    <p className={styles.subtitle}>Bara Kahu Campus · {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className={styles.headerActions}>
                    <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={exporting}>
                        {exporting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '⬇'} Export CSV
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
                        + Register Student
                    </button>
                </div>
            </div>

            {/* ---- Stat Cards ---- */}
            <div className={styles.statsGrid}>
                {STAT_CARDS.map(card => (
                    <div
                        key={card.key}
                        className={`${styles.statCard} card`}
                        onClick={() => handleStatClick(card)}
                        title={`Filter by: ${card.label}`}
                    >
                        <div className={styles.statValue} style={{ color: card.color }}>
                            {getStatValue(card)}
                        </div>
                        <div className={styles.statLabel}>{card.label}</div>
                    </div>
                ))}
            </div>

            {/* ---- Toolbar ---- */}
            <div className={styles.toolbar}>
                <input
                    className={styles.searchInput}
                    placeholder="Search by name, GR number, or class…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className={styles.stageFilters}>
                    <button
                        className={`btn btn-sm ${!stageFilter ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setStageFilter(null)}
                    >All</button>
                    {Object.entries(STAGE_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            className={`btn btn-sm ${stageFilter === key ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setStageFilter(key === stageFilter ? null : key)}
                        >{label}</button>
                    ))}
                </div>
                <div className={styles.viewToggle}>
                    <button
                        className={`btn btn-sm ${view === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('kanban')}
                    >⊞ Board</button>
                    <button
                        className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setView('table')}
                    >☰ Table</button>
                </div>
            </div>

            {/* ---- Views ---- */}
            {view === 'kanban' ? (
                <KanbanBoard students={filtered} onAction={openAction} handleDelete={handleDelete} onStudentClick={id => navigate(`/students/${id}`)} />
            ) : (
                <StudentTable students={sorted(filtered)} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} onAction={openAction} handleDelete={handleDelete} onStudentClick={id => navigate(`/students/${id}`)} />
            )}

            {/* ---- Modals ---- */}
            {showRegister && (
                <RegisterModal onClose={() => setShowRegister(false)} onSuccess={() => { setShowRegister(false); fetchAll() }} />
            )}
            {actionModal?.type === 'schedule' && (
                <ScheduleTestModal student={actionModal.student} onClose={closeAction} onSuccess={afterAction} />
            )}
            {actionModal?.type === 'score' && (
                <ScoreEntryModal student={actionModal.student} onClose={closeAction} onSuccess={afterAction} />
            )}
            {actionModal?.type === 'decide' && (
                <DecisionModal student={actionModal.student} onClose={closeAction} onSuccess={afterAction} />
            )}
            {actionModal?.type === 'joining' && (
                <JoiningModal student={actionModal.student} onClose={closeAction} onSuccess={afterAction} />
            )}
        </div>
    )
}

/* ---- KanbanBoard ---- */
function KanbanBoard({ students, onAction, handleDelete, onStudentClick }) {
    return (
        <div className={styles.kanban}>
            {KANBAN_COLUMNS.map(col => {
                const cards = students.filter(s => s.stage === col.key)
                return (
                    <div key={col.key} className={styles.kanbanCol}>
                        <div className={styles.kanbanHeader}>
                            <span className={styles.kanbanDot} style={{ background: col.color }} />
                            <span>{col.label}</span>
                            <span className={styles.kanbanCount}>{cards.length}</span>
                        </div>
                        <div className={styles.kanbanCards}>
                            {cards.length === 0 && <div className={styles.kanbanEmpty}>No students</div>}
                            {cards.map(s => (
                                <StudentCard key={s.id} student={s} onAction={onAction} handleDelete={handleDelete} onStudentClick={onStudentClick} />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ---- StudentCard ---- */
function StudentCard({ student: s, onAction, handleDelete, onStudentClick }) {
    const joining = s.joined === true ? '✅ Joined' : s.joined === false ? '❌ Didn\'t Join' : null

    return (
        <div className={styles.card_item} onClick={() => onStudentClick(s.id)}>
            <div className={styles.cardName}>{s.name}</div>
            <div className={styles.cardMeta}>
                <span>{s.class_applied_for}</span>
                <span>·</span>
                <span>{s.age_at_registration} yrs</span>
                {s.gr_number && <><span>·</span><span className={styles.grNum}>{s.gr_number}</span></>}
            </div>
            {joining && <div className={styles.joiningBadge}>{joining}</div>}
            {s.score_total_obtained != null && (
                <div className={styles.scoreLine}>Score: {s.score_total_obtained}/{s.score_total_possible}</div>
            )}
            {s.test_date && <div className={styles.scoreLine}>Test: {formatDate(s.test_date)} {s.test_time || ''}</div>}
            <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                {s.stage === 'criteria_passed' && (
                    <button className="btn btn-sm btn-primary" onClick={() => onAction('schedule', s)}>
                        📅 Schedule Test
                    </button>
                )}
                {s.stage === 'test_scheduled' && (
                    <button className="btn btn-sm btn-primary" onClick={() => onAction('score', s)}>
                        📝 Enter Score
                    </button>
                )}
                {s.stage === 'awaiting_decision' && (
                    <button className="btn btn-sm btn-gold" onClick={() => onAction('decide', s)}>
                        ⚖️ Decide
                    </button>
                )}
                {s.stage === 'admitted' && s.joined == null && (
                    <button className="btn btn-sm btn-green" onClick={() => onAction('joining', s)}>
                        ✓ Confirm Joining
                    </button>
                )}
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--brand-red)' }} onClick={(e) => { e.stopPropagation(); handleDelete(s) }}>
                    🗑️ Delete
                </button>
            </div>
        </div>
    )
}

/* ---- StudentTable ---- */
function StudentTable({ students, sortCol, sortDir, onSort, onAction, handleDelete, onStudentClick }) {
    const arrow = col => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

    return (
        <div className={`card ${styles.tableWrap}`}>
            {students.length === 0 ? (
                <div className="empty-state"><div className="icon">🔍</div><div>No students found</div></div>
            ) : (
                <table className="data-table">
                    <thead>
                        <tr>
                            <th onClick={() => onSort('name')}>Name{arrow('name')}</th>
                            <th onClick={() => onSort('class_applied_for')}>Class{arrow('class_applied_for')}</th>
                            <th>Age</th>
                            <th onClick={() => onSort('registered_at')}>Registered{arrow('registered_at')}</th>
                            <th>Stage</th>
                            <th>GR Number</th>
                            <th>Score</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.id} onClick={() => onStudentClick(s.id)}>
                                <td><strong>{s.name}</strong></td>
                                <td>{s.class_applied_for}</td>
                                <td>{s.age_at_registration ?? '—'}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.registered_at)}</td>
                                <td><span className={stageBadgeClass(s.stage)}>{STAGE_LABELS[s.stage]}</span></td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.gr_number || '—'}</td>
                                <td>{s.score_total_obtained != null ? `${s.score_total_obtained}/${s.score_total_possible}` : '—'}</td>
                                <td onClick={e => e.stopPropagation()}>
                                    {s.stage === 'criteria_passed' && <button className="btn btn-sm btn-primary" onClick={() => onAction('schedule', s)}>Schedule Test</button>}
                                    {s.stage === 'test_scheduled' && <button className="btn btn-sm btn-primary" onClick={() => onAction('score', s)}>Enter Score</button>}
                                    {s.stage === 'awaiting_decision' && <button className="btn btn-sm btn-gold" onClick={() => onAction('decide', s)}>Decide</button>}
                                    {s.stage === 'admitted' && s.joined == null && <button className="btn btn-sm btn-green" onClick={() => onAction('joining', s)}>Confirm Joining</button>}
                                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--brand-red)' }} onClick={(e) => { e.stopPropagation(); handleDelete(s) }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
