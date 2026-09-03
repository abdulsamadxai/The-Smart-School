import { useState, useEffect } from 'react'
import api from '../api/client'
import { toast } from 'react-hot-toast'
import MonthlyChallanPrint from '../components/MonthlyChallanPrint'
import styles from './ChallansPage.module.css'

const CLASS_ORDER = ['Playgroup', 'Nursery', 'Prep', 'Grade 1', 'Grade 2', 'Grade 3',
    'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']

export default function MonthlyChallansPage() {
    const [loading, setLoading] = useState(true)
    const [allStudents, setAllStudents] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [printTarget, setPrintTarget] = useState(null)

    const d = new Date()
    const defaultDate = d.toLocaleDateString('en-GB').split('/').join('-')
    const [globals, setGlobals] = useState({
        issueDate: defaultDate,
        dueDate: '',
        monthOf: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
        defaultMonthlyFee: '5000',
        otherDues: '0'
    })

    const [batchData, setBatchData] = useState([])

    useEffect(() => { loadStudents() }, [])

    async function loadStudents() {
        try {
            setLoading(true)
            const { data } = await api.get('/students')
            setAllStudents(data.filter(s => s.stage === 'admitted' || s.stage === 'admitted (joined)'))
        } catch {
            toast.error('Failed to load students')
        } finally {
            setLoading(false)
        }
    }

    // Sort classes in school order
    const availableClasses = CLASS_ORDER.filter(cls =>
        allStudents.some(s => s.class_applied_for === cls)
    )

    async function handleClassChange(e) {
        const cls = e.target.value
        setSelectedClass(cls)
        setSearchQuery('')

        if (!cls) {
            setBatchData([])
            return
        }

        const studentsInClass = allStudents.filter(s => s.class_applied_for === cls)

        try {
            setLoading(true)
            const rows = await Promise.all(studentsInClass.map(async (s) => {
                const res = await api.get(`/fees/students/${s.id}/arrears?current_month=${encodeURIComponent(globals.monthOf)}`)

                const baseMf = Number(globals.defaultMonthlyFee)
                const sw = baseMf * (s.challan_scholarship_pct || 0) / 100
                const sib = baseMf * (s.challan_sibling_discount_pct || 0) / 100
                const orp = baseMf * (s.challan_orphan_discount_pct || 0) / 100
                const mfNet = Math.max(0, Math.round(baseMf - sw - sib - orp))

                return {
                    student: s,
                    monthlyFee: mfNet.toString(),
                    fine: '0',
                    otherDues: globals.otherDues,
                    arrears: res.data.arrears_amount || 0
                }
            }))
            setBatchData(rows)
        } catch (err) {
            toast.error('Failed to fetch arrears')
            // Fallback if arrears fails
            setBatchData(studentsInClass.map(s => ({
                student: s,
                monthlyFee: globals.defaultMonthlyFee,
                fine: '0',
                otherDues: globals.otherDues,
                arrears: 0
            })))
        } finally {
            setLoading(false)
        }
    }

    function handleGlobalFeeChange(val) {
        setGlobals({ ...globals, defaultMonthlyFee: val })
        setBatchData(prev => prev.map(row => {
            const s = row.student
            const baseMf = Number(val)
            const sw = baseMf * (s.challan_scholarship_pct || 0) / 100
            const sib = baseMf * (s.challan_sibling_discount_pct || 0) / 100
            const orp = baseMf * (s.challan_orphan_discount_pct || 0) / 100
            const mfNet = Math.max(0, Math.round(baseMf - sw - sib - orp))

            return { ...row, monthlyFee: mfNet.toString() }
        }))
    }

    function updateRow(index, field, val) {
        const newData = [...batchData]
        newData[index][field] = val
        setBatchData(newData)
    }

    // Use 'name' field (confirmed from models.py)
    const filteredData = batchData.filter(r =>
        (r.student.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    function validate() {
        if (!globals.dueDate) { toast.error('Please specify a Due Date'); return false }
        return true
    }

    async function syncBatchFees(dataRows) {
        try {
            const payload = dataRows.map(row => {
                const amountDue = (Number(row.monthlyFee) || 0)
                    + (Number(row.fine) || 0)
                    + (Number(row.otherDues) || 0)
                    + (Number(row.arrears) || 0)

                return {
                    student_id: row.student.id,
                    fee_month: globals.monthOf,
                    amount_due: amountDue
                }
            })
            await api.post('/fees/batch-save', payload)
            toast.success('Fee Records Saved!')
            return true
        } catch (e) {
            toast.error('Failed to sync fee records with database')
            return false
        }
    }

    async function handlePrintAll() {
        if (!selectedClass || batchData.length === 0) return toast.error('No students to print!')
        if (!validate()) return

        const success = await syncBatchFees(batchData)
        if (!success) return

        setPrintTarget('all')
        setTimeout(() => { window.print(); setPrintTarget(null) }, 150)
    }

    async function handlePrintOne(realIdx) {
        if (!validate()) return

        const success = await syncBatchFees([batchData[realIdx]])
        if (!success) return

        setPrintTarget(realIdx)
        setTimeout(() => { window.print(); setPrintTarget(null) }, 150)
    }

    const buildPrintData = (rows) => rows.map(b => ({
        ...b,
        issueDate: globals.issueDate,
        dueDate: globals.dueDate,
        monthOf: globals.monthOf,
    }))

    const printData = printTarget === 'all'
        ? buildPrintData(batchData)
        : printTarget !== null
            ? buildPrintData([batchData[printTarget]])
            : []

    if (loading) return <div style={{ padding: '2rem' }}><div className="spinner" /> Loading...</div>

    return (
        <div className={styles.page}>
            <div className="no-print">
                <div className={styles.header}>
                    <h1 className={styles.title}>Monthly Batch Challan</h1>
                    <p className={styles.subtitle}>Generate and batch-print fee challans for an entire class.</p>
                </div>

                {/* Print Settings */}
                <div className={styles.formCard} style={{ marginBottom: '1rem' }}>
                    <h2 className={styles.sectionTitle}>Print Settings</h2>
                    <div className={styles.formRow} style={{ gap: '1rem' }}>
                        <div className={styles.formGroup}>
                            <label>Fee for Month of</label>
                            <input value={globals.monthOf} onChange={e => setGlobals({ ...globals, monthOf: e.target.value })} placeholder="e.g. August 2026" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Monthly Fee (Per Student)</label>
                            <input value={globals.defaultMonthlyFee} onChange={e => handleGlobalFeeChange(e.target.value)} type="number" placeholder="5000" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Issue Date</label>
                            <input value={globals.issueDate} onChange={e => setGlobals({ ...globals, issueDate: e.target.value })} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Due Date <span style={{ color: 'var(--brand-red)' }}>*</span></label>
                            <input value={globals.dueDate} onChange={e => setGlobals({ ...globals, dueDate: e.target.value })} placeholder="DD-MM-YYYY" />
                        </div>
                    </div>
                </div>

                {/* Class + Search + Print All */}
                <div className={styles.formCard} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className={styles.formGroup} style={{ minWidth: '180px' }}>
                            <label>Select Class</label>
                            <select value={selectedClass} onChange={handleClassChange}>
                                <option value="">-- Choose a class --</option>
                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Default Fee</label>
                            <input
                                type="number"
                                value={globals.defaultMonthlyFee}
                                onChange={e => handleGlobalFeeChange(e.target.value)}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Global Other Dues</label>
                            <input
                                type="number"
                                value={globals.otherDues}
                                onChange={e => {
                                    const val = e.target.value
                                    setGlobals({ ...globals, otherDues: val })
                                    setBatchData(prev => prev.map(row => ({ ...row, otherDues: val })))
                                }}
                            />
                        </div>
                        <div className={styles.formGroup} style={{ flex: 1 }}>
                            <label>🔍 Search Student Name</label>
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Type student name..."
                                disabled={!selectedClass}
                            />
                        </div>
                        {selectedClass && (
                            <button
                                onClick={handlePrintAll}
                                disabled={batchData.length === 0}
                                style={{
                                    padding: '0.6rem 1.2rem',
                                    background: 'var(--brand-red)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    marginBottom: '1rem'
                                }}
                            >
                                🖨️ Save & Print All ({batchData.length}) Challans
                            </button>
                        )}
                    </div>
                </div>

                {/* Student Grid */}
                {selectedClass && filteredData.length > 0 && (
                    <div className={styles.formCard}>
                        <h2 className={styles.sectionTitle}>
                            Students in {selectedClass}
                            {searchQuery && <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>— {filteredData.length} result(s)</span>}
                        </h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-primary)' }}>
                                        <th style={{ padding: '0.75rem' }}>#</th>
                                        <th style={{ padding: '0.75rem' }}>Student Name</th>
                                        <th style={{ padding: '0.75rem' }}>Monthly Fee (Rs)</th>
                                        <th style={{ padding: '0.75rem' }}>Arrears (Rs)</th>
                                        <th style={{ padding: '0.75rem' }}>Fine (Rs)</th>
                                        <th style={{ padding: '0.75rem' }}>Other Dues (Rs)</th>
                                        <th style={{ padding: '0.75rem' }}>Total</th>
                                        <th style={{ padding: '0.75rem' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((row, i) => {
                                        const realIdx = batchData.findIndex(b => b.student.id === row.student.id)
                                        const total = (Number(row.monthlyFee) || 0)
                                            + (Number(row.fine) || 0)
                                            + (Number(row.arrears) || 0)
                                            + (Number(row.otherDues) || 0)

                                        return (
                                            <tr key={row.student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>
                                                    {row.student.name}
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.student.gr_number || 'No GR'}</div>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                    <input
                                                        style={{ width: '90px', padding: '0.4rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                                        value={row.monthlyFee}
                                                        placeholder="0"
                                                        onChange={e => updateRow(realIdx, 'monthlyFee', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--brand-red)' }}>
                                                    {row.arrears > 0 ? `Rs. ${row.arrears.toLocaleString()}` : "—"}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                    <input
                                                        style={{ width: '90px', padding: '0.4rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                                        value={row.fine}
                                                        placeholder="0"
                                                        onChange={e => updateRow(realIdx, 'fine', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                    <input
                                                        style={{ width: '90px', padding: '0.4rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                                        value={row.otherDues}
                                                        placeholder="0"
                                                        onChange={e => updateRow(realIdx, 'otherDues', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--brand-red)' }}>
                                                    Rs. {total.toLocaleString()}
                                                </td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                    <button
                                                        onClick={() => handlePrintOne(realIdx)}
                                                        style={{
                                                            padding: '0.35rem 0.9rem',
                                                            background: 'var(--brand-red)',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '5px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        🖨️ Save & Print
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selectedClass && filteredData.length === 0 && (
                    <div className={styles.formCard} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No students found{searchQuery ? ` matching "${searchQuery}"` : ' in this class'}.
                    </div>
                )}
            </div>

            {/* Print Only */}
            <div className="print-only">
                {printData.length > 0 && <MonthlyChallanPrint studentsData={printData} />}
            </div>

            <style>{`
                .print-only { display: none; }
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                }
            `}</style>
        </div>
    )
}
