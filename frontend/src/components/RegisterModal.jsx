import { useState } from 'react'
import toast from 'react-hot-toast'
import { registerStudent } from '../api/client'

export default function RegisterModal({ onClose, onSuccess }) {
    const [form, setForm] = useState({
        name: '', class_applied_for: '', date_of_birth: '',
        father_contact_number: '', mother_contact_number: '',
        parent_relation: 'Father', parent_name: ''
    })
    const [loading, setLoading] = useState(false)
    const [duplicateWarning, setDuplicateWarning] = useState(null)

    function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

    async function submit(e, force = false) {
        e?.preventDefault()
        if (!form.name || !form.class_applied_for || !form.date_of_birth || !form.father_contact_number || !form.parent_name) {
            return toast.error('All fields marked * are required')
        }
        if (new Date(form.date_of_birth) > new Date()) {
            return toast.error('Date of birth cannot be in the future')
        }
        setLoading(true)
        setDuplicateWarning(null)
        try {
            await registerStudent(form)
            toast.success(`${form.name} registered successfully`)
            onSuccess()
        } catch (err) {
            if (err.response?.status === 409) {
                setDuplicateWarning(err.response.data.detail)
                setLoading(false)
                return
            }
            toast.error(err.response?.data?.detail || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const CLASSES = [
        'Playgroup', 'Nursery', 'Prep',
        'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
        'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
    ]

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Register New Student</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={submit}>
                    <div className="modal-body">
                        {duplicateWarning && (
                            <div className="duplicate-warn">
                                <strong>⚠ Duplicate Detected</strong>
                                <p>{duplicateWarning.message}</p>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                    Existing record ID(s): {duplicateWarning.existing_ids?.join(', ')}
                                </p>
                                <p style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                                    Are you sure you want to register this student again as a separate record?
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    <button type="button" className="btn btn-red btn-sm" onClick={onClose}>Cancel</button>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                                        setDuplicateWarning(null)
                                        toast('Duplicate warning dismissed. Please verify before proceeding.', { icon: '⚠' })
                                    }}>Dismiss & Review</button>
                                </div>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Full Name *</label>
                            <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Student's full name" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Class Applying For *</label>
                                <select value={form.class_applied_for} onChange={e => update('class_applied_for', e.target.value)}>
                                    <option value="">Select class…</option>
                                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date of Birth *</label>
                                <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Parent / Guardian *</label>
                                <select value={form.parent_relation} onChange={e => update('parent_relation', e.target.value)}>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Guardian">Guardian</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Parent/Guardian Name *</label>
                                <input value={form.parent_name} onChange={e => update('parent_name', e.target.value)} placeholder="Name" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Father's Contact Number *</label>
                                <input
                                    value={form.father_contact_number}
                                    onChange={e => update('father_contact_number', e.target.value)}
                                    placeholder="0300-0000000"
                                />
                            </div>
                            <div className="form-group">
                                <label>Mother's Contact Number</label>
                                <input
                                    value={form.mother_contact_number}
                                    onChange={e => update('mother_contact_number', e.target.value)}
                                    placeholder="0300-0000000"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Register & Check Criteria'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
