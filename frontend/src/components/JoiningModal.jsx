import { useState } from 'react'
import toast from 'react-hot-toast'
import { confirmJoining } from '../api/client'

export default function JoiningModal({ student, onClose, onSuccess }) {
    const [joined, setJoined] = useState(null)
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)

    async function submit(e) {
        e.preventDefault()
        if (joined === null) return toast.error('Please select an option')
        if (joined === false && !reason.trim()) return toast.error('Please provide a reason when the student didn\'t join')
        setLoading(true)
        try {
            await confirmJoining(student.id, { joined, not_joined_reason: joined ? null : reason })
            toast.success(joined ? `${student.name} confirmed as joined! 🎉` : 'Non-joining recorded.')
            onSuccess()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to confirm joining')
        } finally { setLoading(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>✓ Confirm Joining</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                            <strong>{student.name}</strong> · GR: <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{student.gr_number}</span>
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                            {[
                                { val: true, icon: '✅', label: 'Joined', sub: 'Student enrolled and attending', color: 'var(--green)' },
                                { val: false, icon: '❌', label: "Didn't Join", sub: 'Seat was not taken up', color: 'var(--red)' },
                            ].map(opt => (
                                <label key={String(opt.val)} style={{ flex: 1, cursor: 'pointer' }}>
                                    <input type="radio" name="joined" onChange={() => setJoined(opt.val)} style={{ display: 'none' }} />
                                    <div style={{
                                        padding: '1rem',
                                        border: `2px solid ${joined === opt.val ? opt.color : 'var(--border)'}`,
                                        borderRadius: 'var(--radius)',
                                        textAlign: 'center',
                                        background: joined === opt.val ? `${opt.color}12` : 'var(--bg-input)',
                                        transition: 'all 0.15s',
                                    }}>
                                        <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{opt.icon}</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: joined === opt.val ? opt.color : 'var(--text-secondary)' }}>{opt.label}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{opt.sub}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {joined === false && (
                            <div className="form-group">
                                <label>Reason for not joining *</label>
                                <textarea
                                    rows={3}
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="e.g. Family relocated, admitted to another school, financial reasons…"
                                />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" disabled={joined === null || loading} className={`btn ${joined === true ? 'btn-green' : joined === false ? 'btn-red' : 'btn-primary'}`}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
