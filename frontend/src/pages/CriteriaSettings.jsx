import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getCriteria, createCriterion, updateCriterion, deleteCriterion } from '../api/client'
import styles from './CriteriaSettings.module.css'

export default function CriteriaSettings() {
    const [rules, setRules] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(null)  // { id | null if new, class_name, min, max }
    const [saving, setSaving] = useState(false)

    async function fetchRules() {
        try {
            const res = await getCriteria()
            setRules(res.data)
        } catch { toast.error('Failed to load criteria') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchRules() }, [])

    function startEdit(rule) {
        setEditing({
            id: rule?.id ?? null,
            class_name: rule?.class_name ?? '',
            min: rule?.min_age_years ?? '',
            max: rule?.max_age_years ?? '',
        })
    }

    async function saveEdit(e) {
        e.preventDefault()
        if (!editing.class_name || editing.min === '' || editing.max === '') return toast.error('All fields required')
        const min = parseFloat(editing.min)
        const max = parseFloat(editing.max)
        if (isNaN(min) || isNaN(max)) return toast.error('Ages must be numbers')
        if (min >= max) return toast.error('Min age must be less than max age')
        setSaving(true)
        try {
            if (editing.id) {
                await updateCriterion(editing.id, { class_name: editing.class_name, min_age_years: min, max_age_years: max })
                toast.success('Rule updated')
            } else {
                await createCriterion({ class_name: editing.class_name, min_age_years: min, max_age_years: max })
                toast.success('Rule created')
            }
            setEditing(null)
            fetchRules()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Save failed')
        } finally { setSaving(false) }
    }

    async function deleteRule(id, name) {
        if (!window.confirm(`Delete rule for "${name}"?`)) return
        try {
            await deleteCriterion(id)
            toast.success(`Rule for "${name}" deleted`)
            fetchRules()
        } catch { toast.error('Delete failed') }
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>⚙️ Criteria Rules</h1>
                    <p className={styles.subtitle}>Age eligibility ranges per class — these drive the automatic criteria check on every new registration</p>
                </div>
                <button className="btn btn-primary" onClick={() => startEdit(null)}>+ Add Rule</button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', gap: '1rem', color: 'var(--text-muted)' }}>
                    <div className="spinner" /> Loading…
                </div>
            ) : (
                <div className={`card ${styles.tableWrap}`}>
                    {rules.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">⚙️</div>
                            <div>No rules yet. Add a rule to enable automatic age checking.</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th>Min Age (years)</th>
                                    <th>Max Age (years)</th>
                                    <th>Range</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map(r => (
                                    <tr key={r.id} onClick={() => startEdit(r)} style={{ cursor: 'pointer' }}>
                                        <td><strong>{r.class_name}</strong></td>
                                        <td>{r.min_age_years}</td>
                                        <td>{r.max_age_years}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {r.min_age_years} – {r.max_age_years} yrs ({((r.max_age_years - r.min_age_years) * 12).toFixed(0)} months range)
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>Edit</button>
                                                <button className="btn btn-red btn-sm" onClick={() => deleteRule(r.id, r.class_name)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ---- Edit / Add Modal ---- */}
            {editing && (
                <div className="modal-overlay" onClick={() => setEditing(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing.id ? 'Edit Rule' : 'Add New Rule'}</h2>
                            <button className="close-btn" onClick={() => setEditing(null)}>✕</button>
                        </div>
                        <form onSubmit={saveEdit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Class Name *</label>
                                    <input
                                        value={editing.class_name}
                                        onChange={e => setEditing(ed => ({ ...ed, class_name: e.target.value }))}
                                        placeholder="e.g. Nursery, Grade 1"
                                        disabled={!!editing.id}
                                    />
                                    {editing.id && <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Class name cannot be changed. Delete and re-create to rename.</small>}
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Min Age (years) *</label>
                                        <input
                                            type="number" step="0.5" min="0"
                                            value={editing.min}
                                            onChange={e => setEditing(ed => ({ ...ed, min: e.target.value }))}
                                            placeholder="e.g. 3.0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Max Age (years) *</label>
                                        <input
                                            type="number" step="0.5" min="0"
                                            value={editing.max}
                                            onChange={e => setEditing(ed => ({ ...ed, max: e.target.value }))}
                                            placeholder="e.g. 4.0"
                                        />
                                    </div>
                                </div>
                                {editing.min && editing.max && parseFloat(editing.min) < parseFloat(editing.max) && (
                                    <div style={{ padding: '0.6rem 0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Range: {parseFloat(editing.min)} – {parseFloat(editing.max)} years ({((parseFloat(editing.max) - parseFloat(editing.min)) * 12).toFixed(0)} months)
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (editing.id ? 'Save Changes' : 'Create Rule')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
