import { useState, useEffect } from 'react'
import api from '../api/client'
import { toast } from 'react-hot-toast'
import styles from './ChallansPage.module.css'

const fmt = (n) => n !== null && n !== undefined && n !== '' ? `Rs. ${Number(n).toLocaleString('en-PK')}` : '—'
const dash = (v) => v || '—'

export default function StudentRecordsPage() {
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedClass, setSelectedClass] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [fullDetail, setFullDetail] = useState(null) // full student detail including history_logs
    const [feeHistory, setFeeHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)

    function loadStudents() {
        setLoading(true)
        api.get('/students')
            .then(res => {
                // Show ALL students, not just admitted ones
                setStudents(res.data)
            })
            .catch(() => toast.error('Failed to load students'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        loadStudents()
    }, [])

    const classes = [...new Set(students.map(s => s.class_applied_for))].sort()

    const filteredStudents = students.filter(s => {
        const matchesClass = !selectedClass || s.class_applied_for === selectedClass
        const q = searchQuery.toLowerCase()
        const matchesSearch = !q ||
            (s.name || '').toLowerCase().includes(q) ||
            (s.gr_number || '').toLowerCase().includes(q) ||
            (s.parent_name || '').toLowerCase().includes(q)
        return matchesClass && matchesSearch
    })

    async function openStudentDetail(student) {
        setSelectedStudent(student)
        setFullDetail(null)
        setFeeHistory([])
        setHistoryLoading(true)
        try {
            const [detailRes, feeRes] = await Promise.all([
                api.get(`/students/${student.id}`),
                api.get(`/fees/students/${student.id}/fee-history`)
            ])
            setFullDetail(detailRes.data)
            setFeeHistory(feeRes.data)
        } catch {
            toast.error('Failed to load student details')
        } finally {
            setHistoryLoading(false)
        }
    }

    async function handlePromoteAll() {
        if (!window.confirm("Are you sure you want to promote ALL admitted students to their next class? This action cannot be easily undone.")) {
            return
        }

        try {
            const tid = toast.loading('Promoting students...')
            const res = await api.post(`/students/promote-all`)
            toast.success(`Promotion complete! ${res.data.promoted} promoted, ${res.data.graduated} graduated.`, { id: tid })
            loadStudents()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to promote students')
        }
    }


    async function handleDelete(student) {
        if (!window.confirm(`Are you sure you want to completely delete the record for ${student.name}?`)) return
        try {
            const tid = toast.loading('Deleting...')
            await api.delete(`/students/${student.id}`)
            toast.success('Record deleted successfully!', { id: tid })
            closeModal()
            loadStudents()
        } catch (e) {
            toast.error(e?.response?.data?.detail || 'Failed to delete record')
        }
    }

    function closeModal() {
        setSelectedStudent(null)
        setFullDetail(null)
        setFeeHistory([])
    }

    const s = fullDetail || selectedStudent || {}
    const paidTotal = feeHistory.filter(r => r.status === 'paid').reduce((sum, r) => sum + r.amount_due, 0)
    const unpaidTotal = feeHistory.filter(r => r.status === 'unpaid').reduce((sum, r) => sum + r.amount_due, 0)

    // Parse score subjects if available
    const scoreSubjects = s.score_subjects || []

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Student Records</h1>
                <p className={styles.subtitle}>Complete student profiles with admission details, test scores, and full fee payment history.</p>
            </div>

            {/* Dashboard Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{filteredStudents.length}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Students</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--brand-red)' }}>{classes.length}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Classes</div>
                </div>
            </div>

            {/* Controls */}
            <div className={styles.formCard} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
                        <div className={styles.formGroup} style={{ minWidth: '170px' }}>
                            <label>Filter by Class</label>
                            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                <option value="">-- All Classes --</option>
                                {classes.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup} style={{ flex: 1, minWidth: '220px', maxWidth: '400px' }}>
                            <label>🔍 Search Name, GR Number or Parent Name</label>
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Type name, GR number or parent name..."
                            />
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={handlePromoteAll}
                            style={{
                                padding: '0.8rem 1.5rem',
                                background: 'var(--brand-red)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}>
                            ⭐ Promote Students
                        </button>
                    </div>
                </div>
            </div>

            {/* Student Table */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /> Loading students...</div>
            ) : filteredStudents.length === 0 ? (
                <div className={styles.formCard} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <h3 style={{ color: 'var(--text-secondary)' }}>No students found matching your search.</h3>
                </div>
            ) : (
                <div className={styles.formCard} style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-primary)' }}>
                                    <th style={{ padding: '1rem' }}>Student Name</th>
                                    <th style={{ padding: '1rem' }}>GR No.</th>
                                    <th style={{ padding: '1rem' }}>Current Class</th>
                                    <th style={{ padding: '1rem' }}>Class Enrolled</th>
                                    <th style={{ padding: '1rem' }}>Parent / Guardian</th>
                                    <th style={{ padding: '1rem' }}>Father Contact</th>
                                    <th style={{ padding: '1rem' }}>Mother Contact</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Profile</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(st => (
                                    <tr key={st.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => openStudentDetail(st)}>
                                        <td style={{ padding: '1rem', fontWeight: 700 }}>{st.name}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{dash(st.gr_number)}</td>
                                        <td style={{ padding: '1rem' }}>{st.class_applied_for}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{dash(st.class_enrolled)}</td>
                                        <td style={{ padding: '1rem' }}>{dash(st.parent_name)} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({dash(st.parent_relation)})</span></td>
                                        <td style={{ padding: '1rem' }}>{dash(st.father_contact_number)}</td>
                                        <td style={{ padding: '1rem' }}>{dash(st.mother_contact_number)}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <button style={{
                                                padding: '0.35rem 0.9rem',
                                                background: 'var(--brand-red)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: '0.8rem'
                                            }} onClick={e => { e.stopPropagation(); openStudentDetail(st) }}>
                                                View 📋
                                            </button>
                                            <button style={{
                                                padding: '0.35rem 0.9rem',
                                                background: 'transparent',
                                                color: 'var(--brand-red)',
                                                border: '1px solid var(--brand-red)',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: '0.8rem',
                                                marginLeft: '0.5rem'
                                            }} onClick={e => { e.stopPropagation(); handleDelete(st) }}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── Student Detail Modal ─── */}
            {selectedStudent && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999, padding: '1rem'
                }} onClick={closeModal}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '16px',
                        padding: '2rem', width: '100%', maxWidth: '760px',
                        maxHeight: '92vh', overflowY: 'auto',
                        border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{s.name}</h2>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    {s.class_applied_for} &bull; GR: <strong>{dash(s.gr_number)}</strong>
                                    &nbsp;&bull;&nbsp;
                                    <span style={{
                                        padding: '2px 10px',
                                        background: 'var(--brand-red)',
                                        color: '#fff', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700
                                    }}>ADMITTED</span>
                                </p>
                            </div>
                            <div>
                                <button onClick={closeModal} style={{
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)'
                                }}>
                                    Close ✖
                                </button>
                                <button onClick={() => handleDelete(s)} style={{
                                    background: 'var(--brand-red)', border: 'none',
                                    padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'white', marginLeft: '0.5rem'
                                }}>
                                    Delete 🗑
                                </button>
                            </div>
                        </div>

                        {historyLoading ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /> Loading full record...</div>
                        ) : (
                            <>
                                {/* ── Section 1: Personal Info ── */}
                                <Section title="👤 Personal Information">
                                    <Row label="Full Name" value={s.name} />
                                    <Row label="Date of Birth" value={dash(s.date_of_birth)} />
                                    <Row label="Current Class" value={s.class_applied_for} />
                                    <Row label="Class Enrolled" value={dash(s.class_enrolled)} />
                                    <Row label="GR Number" value={dash(s.gr_number)} />
                                    <Row label="Age at Registration" value={s.age_at_registration ? `${s.age_at_registration} years` : '—'} />
                                    <Row label="Registration Date" value={s.registered_at ? new Date(s.registered_at).toLocaleDateString('en-PK') : '—'} />
                                </Section>

                                {/* ── Section 2: Parent / Guardian ── */}
                                <Section title="👨‍👩‍👦 Parent / Guardian">
                                    <Row label="Name" value={dash(s.parent_name)} />
                                    <Row label="Relation" value={dash(s.parent_relation)} />
                                    <Row label="Father's Contact" value={dash(s.father_contact_number)} />
                                    <Row label="Mother's Contact" value={dash(s.mother_contact_number)} />
                                </Section>

                                {/* ── Section 3: Admission Test ── */}
                                <Section title="📝 Admission Test">
                                    <Row label="Test Date" value={dash(s.test_date)} />
                                    <Row label="Test Time" value={dash(s.test_time)} />
                                    <Row label="Score" value={s.score_total_obtained !== null && s.score_total_possible ? `${s.score_total_obtained} / ${s.score_total_possible}` : '—'} />
                                    {scoreSubjects.length > 0 && (
                                        <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>Subject Breakdown:</div>
                                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                {scoreSubjects.map((sub, i) => (
                                                    <span key={i} style={{
                                                        padding: '4px 10px', background: 'var(--bg-primary)',
                                                        border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.82rem'
                                                    }}>
                                                        <strong>{sub.subject}</strong>: {sub.obtained}/{sub.total}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <Row label="Criteria Note" value={dash(s.criteria_note)} />
                                </Section>

                                {/* ── Section 4: Certificate Details ── */}
                                <Section title="🎓 Certificate Details">
                                    <Row label="Certificate Issued" value={s.certificate_issued ? s.certificate_issued.toUpperCase() : 'None'} />
                                    <Row label="Date of Issue" value={s.certificate_issued_at ? new Date(s.certificate_issued_at).toLocaleDateString('en-PK') : dash(s.leaving_date)} />
                                    <Row label="Leaving Date" value={dash(s.leaving_date)} />
                                    <Row label="Reason for Leaving" value={dash(s.leaving_reason)} />
                                    <Row label="Conduct / Remarks" value={dash(s.conduct_remarks)} />
                                </Section>

                                {/* ── Section 5: Admission Challan (Fee) ── */}
                                <Section title="💳 Admission Fee Challan">
                                    {(s.challan_monthly_fee !== null && s.challan_monthly_fee !== undefined) ? (
                                        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                            <Row label="Monthly Fee Original" value={`Rs. ${s.challan_monthly_fee}`} />
                                            <Row label="Scholarship %" value={s.challan_scholarship_pct ? `${s.challan_scholarship_pct}%` : '—'} />
                                            <Row label="Sibling Discount" value={s.challan_sibling_discount_pct ? `${s.challan_sibling_discount_pct}%` : '—'} />
                                            <Row label="Orphan Discount" value={s.challan_orphan_discount_pct ? `${s.challan_orphan_discount_pct}%` : '—'} />
                                            <Row label="Admission Fee" value={s.challan_admission_fee ? `Rs. ${s.challan_admission_fee}` : '—'} />
                                            <Row label="Admin Scholarship %" value={s.challan_admission_scholarship_pct ? `${s.challan_admission_scholarship_pct}%` : '—'} />
                                            <Row label="Annual Fee" value={s.challan_annual_fee ? `Rs. ${s.challan_annual_fee}` : '—'} />
                                            <Row label="Security" value={s.challan_security ? `Rs. ${s.challan_security}` : '—'} />
                                            <Row label="Security Scholarship %" value={s.challan_security_scholarship_pct ? `${s.challan_security_scholarship_pct}%` : '—'} />
                                            <Row label="Other Dues" value={s.challan_other_dues ? `Rs. ${s.challan_other_dues}` : '—'} />
                                            <Row label="Amount Paid on Receipt" value={s.challan_amount_paid ? `Rs. ${s.challan_amount_paid}` : '—'} />
                                        </div>
                                    ) : (
                                        <p style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 0.5rem', fontStyle: 'italic' }}>
                                            Admission fee details have not been saved yet. Generate a challan from the Admission Fee Challan tab to save them.
                                        </p>
                                    )}
                                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem' }}>
                                        <Row label="Decision" value={s.decision ? s.decision.toUpperCase() : '—'} />
                                        <Row label="Decision Date" value={s.decision_at ? new Date(s.decision_at).toLocaleDateString('en-PK') : '—'} />
                                        <Row label="Joining Status" value={
                                            s.joined === true ? '✅ Joined' :
                                                s.joined === false ? `❌ Not Joined${s.not_joined_reason ? ` — ${s.not_joined_reason}` : ''}` :
                                                    '—'
                                        } />
                                    </div>
                                </Section>

                                {/* ── Section 5: Fee Summary ── */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <StatCard label="Total Months on Record" value={feeHistory.length} color="var(--text-primary)" />
                                    <StatCard label="Total Paid" value={`Rs. ${paidTotal.toLocaleString()}`} color="#10b981" />
                                    <StatCard label="Total Due (Arrears)" value={`Rs. ${unpaidTotal.toLocaleString()}`} color="var(--brand-red)" />
                                </div>

                                {/* ── Section 6: Monthly Fee History ── */}
                                <Section title="💰 Monthly Fee History">
                                    {feeHistory.length === 0 ? (
                                        <p style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
                                            No fee records yet. They appear here after monthly challans are printed.
                                        </p>
                                    ) : (
                                        <div style={{ gridColumn: '1 / -1', overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border)' }}>
                                                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Month</th>
                                                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Amount</th>
                                                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>Status</th>
                                                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Cleared On</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {feeHistory.map(r => (
                                                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: r.status === 'paid' ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                                                            <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{r.fee_month}</td>
                                                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Rs. {(r.amount_due || 0).toLocaleString()}</td>
                                                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                                                                {r.status === 'paid'
                                                                    ? <span style={{ padding: '3px 10px', background: '#10b981', color: '#fff', borderRadius: '12px', fontWeight: 700, fontSize: '0.75rem' }}>PAID ✔</span>
                                                                    : <span style={{ padding: '3px 10px', background: 'var(--brand-red)', color: '#fff', borderRadius: '12px', fontWeight: 700, fontSize: '0.75rem' }}>UNPAID</span>
                                                                }
                                                            </td>
                                                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                                {r.cleared_at ? new Date(r.cleared_at).toLocaleDateString('en-PK') : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Section>

                                {/* ── Section 7: Activity Log ── */}
                                {fullDetail?.history_logs?.length > 0 && (
                                    <Section title="🕓 Activity Log">
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            {fullDetail.history_logs.slice().reverse().map(log => (
                                                <div key={log.id} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                                                        {new Date(log.timestamp).toLocaleString('en-PK')}
                                                    </span>
                                                    <span>{log.event_text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Helper Components ──
function Section({ title, children }) {
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
                marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 700,
                color: 'var(--brand-red)', borderBottom: '2px solid var(--brand-red)', paddingBottom: '0.4rem'
            }}>
                {title}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem', fontSize: '0.88rem' }}>
                {children}
            </div>
        </div>
    )
}

function Row({ label, value }) {
    return (
        <div style={{ padding: '0.3rem 0' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}: </span>
            <span style={{ color: 'var(--text-primary)' }}>{value || '—'}</span>
        </div>
    )
}

function StatCard({ label, value, color }) {
    return (
        <div style={{
            background: 'var(--bg-primary)', padding: '1rem', borderRadius: '10px',
            textAlign: 'center', border: '1px solid var(--border)'
        }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>{label}</div>
        </div>
    )
}
