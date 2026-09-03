import { useState, useEffect, useMemo, useRef } from 'react'
import api from '../api/client'
import { getRole } from '../api/client'
import { toast } from 'react-hot-toast'
import styles from './ChallansPage.module.css'

const d = new Date()
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const YEARS = [d.getFullYear() - 2, d.getFullYear() - 1, d.getFullYear(), d.getFullYear() + 1]
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`
const today = () => new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })

export default function FeeRecordPage() {
    const role = getRole()  // 'admin' | 'cash_admin' | 'bank_admin' | 'director'

    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [allStudents, setAllStudents] = useState([])

    const [selectedMonth, setSelectedMonth] = useState(MONTHS[d.getMonth()])
    const [selectedYear, setSelectedYear] = useState(d.getFullYear())
    const [selectedClass, setSelectedClass] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    const [statusFilter, setStatusFilter] = useState('all')
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')  // 'all' | 'Cash' | 'Bank'
    const [feeAmountFilter, setFeeAmountFilter] = useState('')

    const printRef = useRef(null)

    const monthString = `${selectedMonth} ${selectedYear}`
    const classes = useMemo(() => [...new Set(allStudents.map(s => s.class_applied_for))].sort(), [allStudents])

    useEffect(() => {
        async function init() {
            setLoading(true)
            try {
                const res = await api.get('/students')
                const admitted = res.data.filter(s => s.stage === 'admitted' || s.stage === 'admitted (joined)' || s.joined === true)
                setAllStudents(admitted)
                await loadRecordsWithStudents(admitted, monthString, selectedClass)
            } catch {
                toast.error('Failed to load data')
                setLoading(false)
            }
        }
        init()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (allStudents.length > 0) {
            loadRecordsWithStudents(allStudents, monthString, selectedClass)
        }
    }, [selectedMonth, selectedYear, selectedClass]) // eslint-disable-line react-hooks/exhaustive-deps

    async function loadRecordsWithStudents(students, month, classFilter) {
        setLoading(true)
        try {
            const params = { month }
            if (classFilter) params.class_name = classFilter
            const { data } = await api.get('/fees/records', { params })
            const mapped = data.map(record => {
                const student = students.find(s => s.id === record.student_id)
                return student ? { ...record, student } : null
            }).filter(Boolean)
            setRecords(mapped)
        } catch {
            toast.error('Failed to load fee records')
        } finally {
            setLoading(false)
        }
    }

    // Mark fee as paid with the appropriate payment method
    async function markPaid(recordId, method) {
        try {
            const { data } = await api.put(`/fees/records/${recordId}/toggle-status?payment_method=${method}`)
            setRecords(prev => prev.map(r =>
                r.id === recordId ? { ...r, status: data.status, cleared_at: data.cleared_at, payment_method: data.payment_method } : r
            ))
            toast.success(`Marked as PAID (${method})`)
        } catch {
            toast.error('Failed to update status')
        }
    }

    // Toggle back to unpaid
    async function markUnpaid(recordId) {
        try {
            const { data } = await api.put(`/fees/records/${recordId}/toggle-status`)
            setRecords(prev => prev.map(r =>
                r.id === recordId ? { ...r, status: data.status, cleared_at: data.cleared_at, payment_method: null } : r
            ))
            toast.success('Marked as UNPAID')
        } catch {
            toast.error('Failed to update status')
        }
    }

    const filteredRecords = useMemo(() => {
        let list = records
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            list = list.filter(r =>
                r.student.name.toLowerCase().includes(q) ||
                (r.student.gr_number || '').toLowerCase().includes(q)
            )
        }
        if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
        if (paymentMethodFilter !== 'all') {
            list = list.filter(r => r.payment_method === paymentMethodFilter)
        }
        if (feeAmountFilter !== '' && !isNaN(Number(feeAmountFilter))) {
            list = list.filter(r => Number(r.amount_due) === Number(feeAmountFilter))
        }
        return list
    }, [records, searchQuery, statusFilter, paymentMethodFilter, feeAmountFilter])

    const totalRecords = filteredRecords.length
    const paidCount = filteredRecords.filter(r => r.status === 'paid').length
    const unpaidCount = filteredRecords.filter(r => r.status === 'unpaid').length
    const totalCollected = filteredRecords.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_due), 0)
    const totalPending = filteredRecords.filter(r => r.status === 'unpaid').reduce((s, r) => s + Number(r.amount_due), 0)

    // Today's records by method for printing
    const todayISO = new Date().toISOString().split('T')[0]
    function getTodayRecords(method) {
        return records.filter(r =>
            r.status === 'paid' &&
            r.payment_method === method &&
            r.cleared_at &&
            r.cleared_at.startsWith(todayISO)
        )
    }

    function printReport(method) {
        const todayRecords = getTodayRecords(method)
        if (todayRecords.length === 0) {
            return toast.error(`No ${method} payments collected today.`)
        }
        const total = todayRecords.reduce((s, r) => s + Number(r.amount_due), 0)
        const rows = todayRecords.map((r, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${r.student.name}</td>
                <td>${r.student.gr_number || '—'}</td>
                <td>${r.student.class_applied_for}</td>
                <td>${r.fee_month}</td>
                <td style="text-align:right; font-weight:700;">Rs. ${Number(r.amount_due).toLocaleString('en-PK')}</td>
            </tr>
        `).join('')

        const win = window.open('', '_blank', 'width=900,height=700')
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${method} Fee Report – ${today()}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Times New Roman', serif; padding: 40px; color: #111; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #111; padding-bottom: 20px; }
                    .header h1 { font-size: 22px; margin-bottom: 6px; }
                    .header h2 { font-size: 16px; font-weight: normal; color: #444; }
                    .badge { display: inline-block; background: ${method === 'Cash' ? '#15803d' : '#1d4ed8'}; color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-top: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
                    th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 13px; border: 1px solid #ddd; }
                    td { padding: 9px 12px; font-size: 13px; border: 1px solid #ddd; }
                    tr:nth-child(even) { background: #f9fafb; }
                    .total-row { font-weight: 700; background: #f3f4f6 !important; font-size: 14px; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; }
                    .sig { border-top: 1px solid #666; padding-top: 8px; min-width: 200px; text-align: center; font-size: 13px; color: #555; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>The Smart School – Bara Kahu Campus</h1>
                    <h2>Monthly Fee Collection Report</h2>
                    <span class="badge">${method === 'Cash' ? '💵' : '🏦'} ${method} Payments</span>
                    <p style="margin-top:12px; font-size:13px; color:#555;">
                        Date: <strong>${today()}</strong> &nbsp;|&nbsp;
                        Total Students: <strong>${todayRecords.length}</strong> &nbsp;|&nbsp;
                        Total Collected: <strong>Rs. ${total.toLocaleString('en-PK')}</strong>
                    </p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Student Name</th>
                            <th>GR Number</th>
                            <th>Class</th>
                            <th>Fee Month</th>
                            <th style="text-align:right;">Amount (Rs.)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr class="total-row">
                            <td colspan="5" style="text-align:right;">TOTAL COLLECTED</td>
                            <td style="text-align:right;">Rs. ${total.toLocaleString('en-PK')}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="footer">
                    <div class="sig">Admin Signature (${method})</div>
                    <div class="sig">Director / Principal</div>
                </div>
                <br/>
                <button class="no-print" onclick="window.print()" style="padding:10px 24px; background:#111; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; margin-top:20px;">
                    🖨️ Print Now
                </button>
                <script>setTimeout(() => window.print(), 600)</script>
            </body>
            </html>
        `)
        win.document.close()
    }

    const cardStyle = (borderColor) => ({
        background: 'var(--bg-card)',
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
    })

    // Determine what "Mark Paid" buttons to show based on role
    const canMarkCash = role === 'cash_admin' || role === 'admin'
    const canMarkBank = role === 'bank_admin' || role === 'admin'
    const canPrint = role !== 'director'

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 className={styles.title}>Fee Records</h1>
                        <p className={styles.subtitle}>Track monthly paid/unpaid status for all students.</p>
                    </div>
                    {/* Print Buttons — shown based on role */}
                    {canPrint && (
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {(canMarkCash) && (
                                <button
                                    onClick={() => printReport('Cash')}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: '#15803d',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.88rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    💵 Print Today's Cash Report
                                </button>
                            )}
                            {(canMarkBank) && (
                                <button
                                    onClick={() => printReport('Bank')}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: '#1d4ed8',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.88rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    🏦 Print Today's Bank Report
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={cardStyle('var(--text-secondary)')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalRecords}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Invoices</div>
                </div>
                <div style={cardStyle('#10b981')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{paidCount}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Paid Students</div>
                    <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>{fmt(totalCollected)}</div>
                </div>
                <div style={cardStyle('var(--brand-red)')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-red)' }}>{unpaidCount}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Unpaid Students</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--brand-red)', fontWeight: 700 }}>{fmt(totalPending)}</div>
                </div>
                <div style={cardStyle('#15803d')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#15803d' }}>
                        {records.filter(r => r.status === 'paid' && r.payment_method === 'Cash').length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>💵 Cash Paid</div>
                    <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>
                        {fmt(records.filter(r => r.status === 'paid' && r.payment_method === 'Cash').reduce((s, r) => s + Number(r.amount_due), 0))}
                    </div>
                </div>
                <div style={cardStyle('#1d4ed8')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d4ed8' }}>
                        {records.filter(r => r.status === 'paid' && r.payment_method === 'Bank').length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>🏦 Bank Paid</div>
                    <div style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 700 }}>
                        {fmt(records.filter(r => r.status === 'paid' && r.payment_method === 'Bank').reduce((s, r) => s + Number(r.amount_due), 0))}
                    </div>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className={styles.formCard} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className={styles.formGroup} style={{ minWidth: '130px' }}>
                        <label>Month</label>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ minWidth: '100px' }}>
                        <label>Year</label>
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ minWidth: '150px' }}>
                        <label>Class</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value=''>-- All Classes --</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ minWidth: '150px' }}>
                        <label>Payment Status</label>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value='all'>All Students</option>
                            <option value='unpaid'>⚠️ Pending Fees Only</option>
                            <option value='paid'>✅ Paid Only</option>
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ minWidth: '160px' }}>
                        <label>Payment Method</label>
                        <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)}>
                            <option value='all'>All Methods</option>
                            <option value='Cash'>💵 Cash Only</option>
                            <option value='Bank'>🏦 Bank Only</option>
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ minWidth: '160px' }}>
                        <label>Fee Amount (exact)</label>
                        <input
                            type='number'
                            value={feeAmountFilter}
                            onChange={e => setFeeAmountFilter(e.target.value)}
                            placeholder='e.g. 10000'
                        />
                    </div>
                    <div className={styles.formGroup} style={{ flex: 1, minWidth: '200px' }}>
                        <label>🔍 Search Student / GR Number</label>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder='Type name or GR number...'
                        />
                    </div>
                </div>

                {(statusFilter !== 'all' || paymentMethodFilter !== 'all' || feeAmountFilter !== '') && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {statusFilter !== 'all' && (
                            <span style={{ background: statusFilter === 'unpaid' ? 'var(--brand-red)' : '#10b981', color: '#fff', borderRadius: '20px', padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                                {statusFilter === 'unpaid' ? '⚠️ Pending Fees' : '✅ Paid'} · {filteredRecords.length} students
                            </span>
                        )}
                        {paymentMethodFilter !== 'all' && (
                            <span style={{ background: paymentMethodFilter === 'Cash' ? '#15803d' : '#1d4ed8', color: '#fff', borderRadius: '20px', padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                                {paymentMethodFilter === 'Cash' ? '💵 Cash' : '🏦 Bank'} · {filteredRecords.length} students
                            </span>
                        )}
                        {feeAmountFilter !== '' && (
                            <span style={{ background: 'var(--text-secondary)', color: '#fff', borderRadius: '20px', padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
                                Fee = Rs. {Number(feeAmountFilter).toLocaleString('en-PK')}
                            </span>
                        )}
                        <button
                            onClick={() => { setStatusFilter('all'); setPaymentMethodFilter('all'); setFeeAmountFilter('') }}
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                            Clear filters ×
                        </button>
                    </div>
                )}
            </div>

            {/* ── Table ── */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}><div className='spinner' /> Loading records...</div>
            ) : filteredRecords.length === 0 ? (
                <div className={styles.formCard} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                    <h3 style={{ color: 'var(--text-secondary)' }}>
                        {records.length === 0
                            ? `No fee records generated for ${monthString} yet.`
                            : 'No students match your current filters.'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        {records.length === 0
                            ? 'Go to Monthly Batch Challan to generate fees for this month.'
                            : 'Try adjusting the filters above.'}
                    </p>
                </div>
            ) : (
                <div className={styles.formCard} style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-primary)' }}>
                                    <th style={{ padding: '1rem' }}>Student Name</th>
                                    <th style={{ padding: '1rem' }}>GR Number</th>
                                    <th style={{ padding: '1rem' }}>Class</th>
                                    <th style={{ padding: '1rem' }}>Month</th>
                                    <th style={{ padding: '1rem' }}>Amount Due</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                    <th style={{ padding: '1rem' }}>Method</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map(r => (
                                    <tr key={r.id} style={{
                                        borderBottom: '1px solid var(--border)',
                                        background: r.status === 'paid'
                                            ? (r.payment_method === 'Cash' ? 'rgba(21,128,61,0.06)' : 'rgba(29,78,216,0.06)')
                                            : 'transparent'
                                    }}>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{r.student.name}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.student.gr_number || '—'}</td>
                                        <td style={{ padding: '0.85rem 1rem' }}>{r.student.class_applied_for}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.fee_month}</td>
                                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Rs.&nbsp;{Number(r.amount_due).toLocaleString('en-PK')}</td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            {r.status === 'paid'
                                                ? <span style={{ padding: '3px 10px', background: '#10b981', color: '#fff', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>✅ PAID</span>
                                                : <span style={{ padding: '3px 10px', background: 'var(--brand-red)', color: '#fff', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }}>⚠️ UNPAID</span>
                                            }
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            {r.payment_method
                                                ? <span style={{
                                                    padding: '3px 10px',
                                                    background: r.payment_method === 'Cash' ? '#15803d' : '#1d4ed8',
                                                    color: '#fff',
                                                    borderRadius: '20px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700
                                                }}>
                                                    {r.payment_method === 'Cash' ? '💵 Cash' : '🏦 Bank'}
                                                </span>
                                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                                            }
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                            {r.status === 'unpaid' ? (
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                    {canMarkCash && (
                                                        <button
                                                            onClick={() => markPaid(r.id, 'Cash')}
                                                            style={{
                                                                padding: '0.35rem 0.9rem',
                                                                background: '#15803d',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontWeight: 600,
                                                                fontSize: '0.82rem',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            💵 Cash ✔
                                                        </button>
                                                    )}
                                                    {canMarkBank && (
                                                        <button
                                                            onClick={() => markPaid(r.id, 'Bank')}
                                                            style={{
                                                                padding: '0.35rem 0.9rem',
                                                                background: '#1d4ed8',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontWeight: 600,
                                                                fontSize: '0.82rem',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            🏦 Bank ✔
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                // Only admin or the role that collected it can revert
                                                (role === 'admin' ||
                                                    (role === 'cash_admin' && r.payment_method === 'Cash') ||
                                                    (role === 'bank_admin' && r.payment_method === 'Bank')
                                                ) && (
                                                    <button
                                                        onClick={() => markUnpaid(r.id)}
                                                        style={{
                                                            padding: '0.35rem 0.9rem',
                                                            background: 'var(--bg-secondary)',
                                                            color: 'var(--text-primary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: 600,
                                                            fontSize: '0.83rem'
                                                        }}
                                                    >
                                                        Mark Unpaid
                                                    </button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
