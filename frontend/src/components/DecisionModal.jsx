import { useState } from 'react'
import toast from 'react-hot-toast'
import { decide } from '../api/client'

export default function DecisionModal({ student, onClose, onSuccess }) {
    const [decision, setDecision] = useState('')
    const [loading, setLoading] = useState(false)

    async function submit(e) {
        e.preventDefault()
        if (!decision) return toast.error('Please select a decision')
        setLoading(true)
        try {
            const res = await decide(student.id, { decision })
            if (decision === 'admitted') {
                toast.success(`Admitted! GR Number: ${res.data.gr_number}`, { duration: 5000 })
            } else {
                toast('Marked as Not Admitted.', { icon: '📋' })
            }
            onSuccess()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to record decision')
        } finally { setLoading(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚖️ Admission Decision</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                            <strong>{student.name}</strong> · {student.class_applied_for}<br />
                            Score: {student.score_total_obtained ?? '—'} / {student.score_total_possible ?? '—'}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <label className={`decision-opt ${decision === 'admitted' ? 'selected-admit' : ''}`} style={{ flex: 1, cursor: 'pointer' }}>
                                <input type="radio" name="decision" value="admitted" onChange={() => setDecision('admitted')} style={{ display: 'none' }} />
                                <div style={{
                                    padding: '1.25rem',
                                    border: `2px solid ${decision === 'admitted' ? 'var(--gold)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius)',
                                    textAlign: 'center',
                                    background: decision === 'admitted' ? 'rgba(240,180,41,0.08)' : 'var(--bg-input)',
                                    transition: 'all 0.15s',
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🎉</div>
                                    <div style={{ fontWeight: 700, color: decision === 'admitted' ? 'var(--gold)' : 'var(--text-secondary)' }}>Admit</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>GR number auto-assigned</div>
                                </div>
                            </label>
                            <label style={{ flex: 1, cursor: 'pointer' }}>
                                <input type="radio" name="decision" value="rejected" onChange={() => setDecision('rejected')} style={{ display: 'none' }} />
                                <div style={{
                                    padding: '1.25rem',
                                    border: `2px solid ${decision === 'rejected' ? 'var(--red)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius)',
                                    textAlign: 'center',
                                    background: decision === 'rejected' ? 'rgba(229,62,62,0.08)' : 'var(--bg-input)',
                                    transition: 'all 0.15s',
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📋</div>
                                    <div style={{ fontWeight: 700, color: decision === 'rejected' ? 'var(--red)' : 'var(--text-secondary)' }}>Not Admit</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Student notified separately</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={!decision || loading} className={`btn ${decision === 'admitted' ? 'btn-gold' : decision === 'rejected' ? 'btn-red' : 'btn-primary'}`}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : `Confirm ${decision === 'admitted' ? 'Admission' : decision === 'rejected' ? 'Rejection' : 'Decision'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
