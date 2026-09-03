import { useState } from 'react'
import toast from 'react-hot-toast'
import { enterScore } from '../api/client'

export default function ScoreEntryModal({ student, onClose, onSuccess }) {
    const [mode, setMode] = useState('subjects') // 'subjects' | 'total'
    const [totalObtained, setTotalObtained] = useState('')
    const [totalPossible, setTotalPossible] = useState('')
    const [subjects, setSubjects] = useState([
        { subject: 'English', obtained: '', total: '' },
        { subject: 'Math', obtained: '', total: '' },
        { subject: 'GK', obtained: '', total: '' },
    ])
    const [loading, setLoading] = useState(false)

    function updateSubject(i, key, val) {
        setSubjects(prev => {
            const next = [...prev]
            next[i] = { ...next[i], [key]: val }
            return next
        })
    }

    function addSubject() {
        setSubjects(prev => [...prev, { subject: '', obtained: '', total: '' }])
    }

    function removeSubject(i) {
        setSubjects(prev => prev.filter((_, idx) => idx !== i))
    }

    function computedTotal() {
        return subjects.reduce((s, sub) => s + (parseFloat(sub.obtained) || 0), 0)
    }

    function computedPossible() {
        return subjects.reduce((s, sub) => s + (parseFloat(sub.total) || 0), 0)
    }

    async function submit(e) {
        e.preventDefault()

        let payload
        if (mode === 'total') {
            const ob = parseFloat(totalObtained)
            const po = parseFloat(totalPossible)
            if (isNaN(ob) || isNaN(po) || ob < 0 || po <= 0) return toast.error('Enter valid scores')
            if (ob > po) return toast.error('Obtained score cannot exceed total possible')
            payload = { score_total_obtained: ob, score_total_possible: po }
        } else {
            for (const s of subjects) {
                if (!s.subject || s.obtained === '' || s.total === '') return toast.error('Fill all subject fields')
                if (parseFloat(s.obtained) > parseFloat(s.total)) return toast.error(`${s.subject}: obtained > total`)
            }
            const ob = computedTotal()
            const po = computedPossible()
            payload = {
                score_total_obtained: ob,
                score_total_possible: po,
                score_subjects: subjects.map(s => ({
                    subject: s.subject,
                    obtained: parseFloat(s.obtained),
                    total: parseFloat(s.total),
                })),
            }
        }

        setLoading(true)
        try {
            await enterScore(student.id, payload)
            toast.success('Score recorded')
            onSuccess()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to enter score')
        } finally { setLoading(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📝 Enter Score</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                            <strong>{student.name}</strong> · {student.class_applied_for} · Test: {student.test_date} {student.test_time}
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                            <button type="button" className={`btn btn-sm ${mode === 'subjects' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('subjects')}>Subject Breakdown</button>
                            <button type="button" className={`btn btn-sm ${mode === 'total' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('total')}>Total Only</button>
                        </div>

                        {mode === 'subjects' ? (
                            <>
                                {subjects.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'center' }}>
                                        <input style={{ flex: 2 }} placeholder="Subject" value={s.subject} onChange={e => updateSubject(i, 'subject', e.target.value)} />
                                        <input style={{ flex: 1 }} type="number" min="0" placeholder="Got" value={s.obtained} onChange={e => updateSubject(i, 'obtained', e.target.value)} />
                                        <input style={{ flex: 1 }} type="number" min="1" placeholder="Max" value={s.total} onChange={e => updateSubject(i, 'total', e.target.value)} />
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSubject(i)} style={{ padding: '0.3rem 0.5rem' }}>✕</button>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-ghost btn-sm" onClick={addSubject} style={{ marginTop: '0.25rem' }}>+ Add Subject</button>
                                {subjects.length > 0 && (
                                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        Computed Total: <strong style={{ color: 'var(--gold)' }}>{computedTotal()} / {computedPossible()}</strong>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Score Obtained *</label>
                                    <input type="number" min="0" step="0.5" value={totalObtained} onChange={e => setTotalObtained(e.target.value)} placeholder="e.g. 72" />
                                </div>
                                <div className="form-group">
                                    <label>Total Possible *</label>
                                    <input type="number" min="1" step="0.5" value={totalPossible} onChange={e => setTotalPossible(e.target.value)} placeholder="e.g. 100" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save Score'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
