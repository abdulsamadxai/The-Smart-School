import { useState } from 'react'
import toast from 'react-hot-toast'
import { scheduleTest } from '../api/client'

export default function ScheduleTestModal({ student, onClose, onSuccess }) {
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [loading, setLoading] = useState(false)

    async function submit(e) {
        e.preventDefault()
        if (!date || !time) return toast.error('Both date and time are required')
        setLoading(true)
        try {
            await scheduleTest(student.id, { test_date: date, test_time: time })
            toast.success(`Test scheduled for ${student.name}`)
            onSuccess()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to schedule test')
        } finally { setLoading(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📅 Schedule Test</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                            Scheduling test for <strong>{student.name}</strong> ({student.class_applied_for})
                        </p>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Test Date *</label>
                                <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Test Time *</label>
                                <input type="time" value={time} onChange={e => setTime(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Confirm Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
