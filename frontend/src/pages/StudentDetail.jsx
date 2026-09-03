import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getStudent } from '../api/client'
import { STAGE_LABELS, stageBadgeClass, formatDate, formatDateTime } from '../utils/helpers'
import ScheduleTestModal from '../components/ScheduleTestModal'
import ScoreEntryModal from '../components/ScoreEntryModal'
import DecisionModal from '../components/DecisionModal'
import JoiningModal from '../components/JoiningModal'
import styles from './StudentDetail.module.css'

export default function StudentDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [student, setStudent] = useState(null)
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(null)

    async function fetchStudent() {
        try {
            const res = await getStudent(id)
            setStudent(res.data)
        } catch (err) {
            toast.error('Student not found')
            navigate('/')
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchStudent() }, [id])

    function afterAction() { setModal(null); fetchStudent() }

    async function handleDelete() {
        if (!window.confirm(`Are you sure you want to completely delete the record for ${student.name}?`)) return
        try {
            const tid = toast.loading('Deleting...')
            await api.delete(`/students/${student.id}`)
            toast.success('Record deleted successfully!', { id: tid })
            navigate('/')
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to delete record')
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', color: 'var(--text-muted)' }}>
            <div className="spinner" /> Loading student…
        </div>
    )

    if (!student) return null

    const s = student
    const pct = s.score_total_possible ? Math.round((s.score_total_obtained / s.score_total_possible) * 100) : null

    return (
        <div className={styles.page}>
            <div className={styles.topBar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
                    <span className={stageBadgeClass(s.stage)}>{STAGE_LABELS[s.stage]}</span>
                    {s.gr_number && <span className={styles.grBadge}>{s.gr_number}</span>}
                </div>
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--brand-red)' }} onClick={handleDelete}>
                    🗑️ Delete Profile
                </button>
            </div>

            <div className={styles.grid}>

                {/* ---- Left: Profile + Actions ---- */}
                <div className={styles.left}>
                    <div className={`card ${styles.profileCard}`}>
                        <div className={styles.avatar}>{s.name.charAt(0).toUpperCase()}</div>
                        <h1 className={styles.name}>{s.name}</h1>
                        <div className={styles.classBadge}>{s.class_applied_for}</div>

                        <div className={styles.fields}>
                            <Field label="Date of Birth" value={s.date_of_birth} />
                            <Field label="Age" value={s.age_at_registration ? `${s.age_at_registration} years` : '—'} />
                            {s.parent_relation && <Field label={`${s.parent_relation}'s Name`} value={s.parent_name} />}
                            <Field label="Father's Contact" value={s.father_contact_number} />
                            <Field label="Mother's Contact" value={s.mother_contact_number} />
                            <Field label="Registered" value={formatDateTime(s.registered_at)} />
                            {s.gr_number && <Field label="GR Number" value={s.gr_number} highlight />}
                        </div>

                        {/* Actions */}
                        <div className={styles.actions}>
                            {s.stage === 'criteria_passed' && (
                                <button className="btn btn-primary" onClick={() => setModal('schedule')}>📅 Schedule Test</button>
                            )}
                            {s.stage === 'test_scheduled' && (
                                <button className="btn btn-primary" onClick={() => setModal('score')}>📝 Enter Score</button>
                            )}
                            {s.stage === 'awaiting_decision' && (
                                <button className="btn btn-gold" onClick={() => setModal('decide')}>⚖️ Make Decision</button>
                            )}
                            {s.stage === 'admitted' && s.joined == null && (
                                <button className="btn btn-green" onClick={() => setModal('joining')}>✓ Confirm Joining</button>
                            )}
                        </div>
                    </div>

                    {/* Criteria note */}
                    {s.criteria_note && (
                        <div className={`card ${styles.noteCard}`}>
                            <div className={styles.noteLabel}>Criteria Check Result</div>
                            <div className={styles.noteText}>{s.criteria_note}</div>
                        </div>
                    )}
                </div>

                {/* ---- Right: Details + Timeline ---- */}
                <div className={styles.right}>

                    {/* Test & Score */}
                    {(s.test_date || s.score_total_obtained != null) && (
                        <div className={`card ${styles.section}`}>
                            <h3 className={styles.sectionTitle}>Test & Score</h3>
                            {s.test_date && (
                                <div className={styles.row}>
                                    <span className={styles.rowLabel}>Test Date & Time</span>
                                    <span>{s.test_date} {s.test_time || ''}</span>
                                </div>
                            )}
                            {s.score_total_obtained != null && (
                                <>
                                    <div className={styles.row}>
                                        <span className={styles.rowLabel}>Total Score</span>
                                        <span>{s.score_total_obtained} / {s.score_total_possible} {pct != null && `(${pct}%)`}</span>
                                    </div>
                                    {s.score_subjects?.length > 0 && (
                                        <div className={styles.subjectTable}>
                                            <div className={styles.subjectHeader}>
                                                <span>Subject</span><span>Obtained</span><span>Total</span>
                                            </div>
                                            {s.score_subjects.map((sub, i) => (
                                                <div key={i} className={styles.subjectRow}>
                                                    <span>{sub.subject}</span>
                                                    <span>{sub.obtained}</span>
                                                    <span>{sub.total}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Decision */}
                    {s.decision && (
                        <div className={`card ${styles.section}`}>
                            <h3 className={styles.sectionTitle}>Decision</h3>
                            <div className={styles.row}>
                                <span className={styles.rowLabel}>Outcome</span>
                                <span style={{ color: s.decision === 'admitted' ? 'var(--gold)' : 'var(--red)', fontWeight: 600 }}>
                                    {s.decision === 'admitted' ? '✅ Admitted' : '❌ Not Admitted'}
                                </span>
                            </div>
                            <div className={styles.row}>
                                <span className={styles.rowLabel}>Date</span>
                                <span>{formatDateTime(s.decision_at)}</span>
                            </div>
                            {s.joined != null && (
                                <div className={styles.row}>
                                    <span className={styles.rowLabel}>Joining</span>
                                    <span style={{ color: s.joined ? 'var(--green)' : 'var(--red)' }}>
                                        {s.joined ? '✅ Joined school' : '❌ Did not join'}
                                    </span>
                                </div>
                            )}
                            {s.not_joined_reason && (
                                <div className={styles.row}>
                                    <span className={styles.rowLabel}>Reason</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{s.not_joined_reason}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Timeline */}
                    <div className={`card ${styles.section}`}>
                        <h3 className={styles.sectionTitle}>History &amp; Audit Trail</h3>
                        {s.history_logs?.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>No history yet</div>
                        ) : (
                            <div className={styles.timeline}>
                                {s.history_logs?.map((log, i) => (
                                    <div key={log.id} className={styles.timelineItem}>
                                        <div className={styles.timelineDot} />
                                        {i < s.history_logs.length - 1 && <div className={styles.timelineLine} />}
                                        <div className={styles.timelineContent}>
                                            <div className={styles.timelineText}>{log.event_text}</div>
                                            <div className={styles.timelineDate}>{formatDateTime(log.timestamp)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {modal === 'schedule' && <ScheduleTestModal student={s} onClose={() => setModal(null)} onSuccess={afterAction} />}
            {modal === 'score' && <ScoreEntryModal student={s} onClose={() => setModal(null)} onSuccess={afterAction} />}
            {modal === 'decide' && <DecisionModal student={s} onClose={() => setModal(null)} onSuccess={afterAction} />}
            {modal === 'joining' && <JoiningModal student={s} onClose={() => setModal(null)} onSuccess={afterAction} />}
        </div>
    )
}

function Field({ label, value, highlight }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: highlight ? 'var(--gold)' : 'var(--text-primary)', fontFamily: highlight ? 'monospace' : 'inherit', fontWeight: highlight ? 600 : 400 }}>
                {value || '—'}
            </span>
        </div>
    )
}
