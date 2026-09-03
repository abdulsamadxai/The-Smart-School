import { useState, useEffect } from 'react'
import api from '../api/client'
import { toast } from 'react-hot-toast'
import styles from './ChallansPage.module.css'

const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`
const todayDisplay = () => new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
const todayISO = () => new Date().toISOString().split('T')[0]

// DOB words
const oneW = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tenW = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function n2w(n) {
    if (n < 20) return oneW[n]
    if (n < 100) return tenW[Math.floor(n / 10)] + (n % 10 ? '-' + oneW[n % 10] : '')
    if (n < 1000) return oneW[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + n2w(n % 100) : '')
    return n.toString()
}
function dobInWords(dob) {
    try {
        const d = new Date(dob)
        return `${n2w(d.getDate())} ${d.toLocaleString('en-PK', { month: 'long' })} ${n2w(d.getFullYear())}`
    } catch { return String(dob) }
}

const CLASS_ORDER = ['Playgroup', 'Nursery', 'Prep', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']

export default function CertificatesPage() {
    const [stats, setStats] = useState({ total_eligible: 0, certificates_issued: 0, leaving_issued: 0, character_issued: 0, pending: 0 })

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedClass, setSelectedClass] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [hasSearched, setHasSearched] = useState(false)

    const [selectedStudent, setSelectedStudent] = useState(null)
    const [loadingClearance, setLoadingClearance] = useState(false)

    // Form
    const [certType, setCertType] = useState('leaving')
    const [leavingDate, setLeavingDate] = useState(todayISO())
    const [conduct, setConduct] = useState('Good')
    const [leavingReason, setLeavingReason] = useState('')
    const [issuing, setIssuing] = useState(false)

    useEffect(() => { loadStats() }, [])

    async function loadStats() {
        try {
            const { data } = await api.get('/certificates/stats')
            setStats(data)
        } catch (e) {
            console.error("Stats Error", e)
        }
    }

    async function handleSearch(e) {
        if (e) e.preventDefault()
        const q = searchQuery.trim()

        if (q.length === 0 && !selectedClass) {
            toast.error("Please enter a name or select a class")
            return
        }
        if (!selectedClass && q.length < 2) {
            toast.error("Please enter at least 2 characters")
            return
        }

        setSearching(true)
        setSelectedStudent(null)
        try {
            const params = {}
            if (q) params.q = q
            if (selectedClass) params.class_name = selectedClass

            const { data } = await api.get('/certificates/search', { params })
            setSearchResults(data)
            setHasSearched(true)
            if (data.length === 0) toast.error("No students found matching your query")
        } catch (error) {
            toast.error("Search failed. Check console.")
            console.error("Search Error", error)
        } finally {
            setSearching(false)
        }
    }

    async function loadClearance(id) {
        setLoadingClearance(true)
        setSearchResults([])
        try {
            const { data } = await api.get(`/certificates/student/${id}/clearance`)
            setSelectedStudent(data)
            if (data.conduct_remarks) setConduct(data.conduct_remarks)
            if (data.leaving_date) setLeavingDate(data.leaving_date)
            window.scrollTo({ top: 300, behavior: 'smooth' })
        } catch (error) {
            toast.error("Failed to load clearance data")
            console.error(error)
        } finally {
            setLoadingClearance(false)
        }
    }

    async function issueCert() {
        if (!selectedStudent) return
        setIssuing(true)
        try {
            const { data } = await api.post(`/certificates/student/${selectedStudent.student_id}/issue`, {
                cert_type: certType,
                leaving_date: leavingDate,
                leaving_reason: leavingReason,
                conduct_remarks: conduct,
            })
            toast.success(data.message)
            await loadClearance(selectedStudent.student_id)
            await loadStats()

            // Print flow
            const s = { ...selectedStudent, conduct_remarks: conduct, leaving_date: leavingDate, leaving_reason: leavingReason }
            if (certType === 'both') {
                printCert('leaving', s)
                setTimeout(() => printCert('character', s), 1500)
            } else {
                printCert(certType, s)
            }
        } catch (e) {
            toast.error('Failed to issue certificate')
        } finally {
            setIssuing(false)
        }
    }

    async function markNormalFeePaid(recordId, method) {
        try {
            await api.put(`/fees/records/${recordId}/toggle-status`, null, { params: { payment_method: method } })
            toast.success(`Fee marked as Paid via ${method}`)
            await loadClearance(selectedStudent.student_id)
        } catch (e) {
            toast.error("Failed to mark fee as paid")
        }
    }

    async function markAdmissionBalancePaid(method) {
        try {
            await api.post(`/certificates/student/${selectedStudent.student_id}/pay-admission`, null, { params: { method } })
            toast.success(`Admission Balance paid via ${method}`)
            await loadClearance(selectedStudent.student_id)
        } catch (e) {
            toast.error("Failed to mark admission balance as paid")
        }
    }

    // ── HTML Print Templates ──────────────────────────────────────────────
    const schoolHeader = `
        <div style="display:flex;align-items:center;gap:16px;border-bottom:3px double #111;padding-bottom:14px;margin-bottom:4px">
            <img src="/tss-logo.png" alt="TSS Logo" style="width:80px;height:80px;object-fit:contain"/>
            <div style="flex:1">
                <div style="font-size:24px;font-weight:700;letter-spacing:1px">The Smart School</div>
                <div style="font-size:12px;color:#555;margin-top:3px">Bara Kahu Campus, Islamabad</div>
                <div style="font-size:12px;color:#555">An Excellent Educational Institution</div>
            </div>
            <div style="width:90px;height:90px;border:2px dashed #bbb;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa;text-align:center">Official<br/>Stamp</div>
        </div>`

    const baseCss = `
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Times New Roman',serif;padding:40px;color:#000;line-height:1.6}
        h2{text-align:center;font-size:18px;font-weight:700;margin:18px 0 16px;text-transform:uppercase;letter-spacing:3px;text-decoration:underline}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ccc;padding:8px 12px;font-size:13px}
        th{background:#f5f5f5}
        .stamp-row{margin-top:60px;display:flex;justify-content:space-between}
        .sig{border-top:2px solid #333;padding-top:8px;text-align:center;min-width:180px;font-size:12px;color:#555}
        @media print{ button{display:none} body{padding:20px} }`

    function printClearanceChallan(s) {
        const rows = s.arrears.map((a, i) => `<tr><td>${i + 1}</td><td>${a.fee_month}</td><td style="text-align:right;font-weight:700;">Rs. ${Number(a.amount_due).toLocaleString('en-PK')}</td></tr>`).join('')
        const win = window.open('', '_blank', 'width=860,height=700')
        win.document.write(`<!DOCTYPE html><html><head><title>Clearance Challan – ${s.name}</title><style>${baseCss}</style></head><body>
            ${schoolHeader}
            <h2 style="text-decoration:none;border-top:2px solid #111;border-bottom:2px solid #111;padding:6px 0">Clearance / Dues Challan</h2>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:16px 0;font-size:13.5px">
                <div>Student Name: <strong>${s.name}</strong></div>
                <div>GR Number: <strong>${s.gr_number || '—'}</strong></div>
                <div>Class: <strong>${s.class_enrolled || s.class_applied_for}</strong></div>
                <div>Date of Issue: <strong>${todayDisplay()}</strong></div>
            </div>
            ${s.arrears.length === 0 ? `<div style="margin-top:20px;padding:14px;background:#d1fae5;border:1px solid #10b981;border-radius:6px;text-align:center;font-weight:700;color:#065f46">✅ No Outstanding Dues — Clearance Granted</div>`
                : `<table><thead><tr><th>#</th><th>Fee Month</th><th style="text-align:right">Amount Due</th></tr></thead><tbody>${rows}
                   <tr style="background:#fff3cd;font-weight:700"><td colspan="2" style="text-align:right">TOTAL DUES</td><td style="text-align:right">Rs. ${parseFloat(s.total_arrears).toLocaleString('en-PK')}</td></tr>
                   </tbody></table>`}
            <div class="stamp-row">
                <div class="sig"><div style="margin-bottom:40px"></div>Accounts Officer</div>
                <div class="sig"><div style="margin-bottom:40px"></div>Principal / Head of School</div>
            </div>
            <br/><button onclick="window.print()" style="padding:10px 20px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Print Challan</button>
            <script>setTimeout(()=>window.print(),500)</script>
        </body></html>`)
        win.document.close()
    }

    function printCert(type, s) {
        const serial = `TSS-${type === 'leaving' ? 'LC' : 'CC'}-${s.student_id}-${new Date().getFullYear()}`
        const lDate = s.leaving_date ? new Date(s.leaving_date).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : todayDisplay()
        const admDate = s.registered_at ? new Date(s.registered_at).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
        const cnd = s.conduct_remarks || 'Good'

        let detailRows = ''
        if (type === 'leaving') {
            const fields = [
                ['Serial No.', serial], ['Student Name', s.name], ['Father Name', s.father_name || '—'],
                ['Date of Birth', s.date_of_birth], ['DOB in Words', dobInWords(s.date_of_birth)],
                ['Admission No.', s.gr_number || '—'], ['Admission Date', admDate], ['Leaving Date', lDate],
                ['Last Class Studied', s.class_enrolled || s.class_applied_for], ['Reason for Leaving', s.leaving_reason || 'Personal'],
                ['Conduct', cnd], ['Date of Issue', todayDisplay()]
            ]
            detailRows = fields.map(item => `<tr><td style="width:42%;background:#fafafa;font-weight:600">${item[0]}</td><td><strong>${item[1]}</strong></td></tr>`).join('')
        }

        const bodyHtml = type === 'leaving' ? `
            <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:10px 0">
                ${detailRows}
            </table>` : `
            <div style="font-size:14px;text-align:justify;margin:10px 0">
                <p style="margin-bottom:12px"><strong>TO WHOM IT MAY CONCERN</strong></p>
                <p style="margin-bottom:12px">This is to certify that <strong>${s.name}</strong>, son/daughter of <strong>${s.father_name || '—'}</strong>, bearing Admission Number <strong>${s.gr_number || '—'}</strong>, was a bonafide student of <strong>The Smart School, Bara Kahu Campus</strong> from <strong>${admDate}</strong> to <strong>${lDate}</strong> in Class <strong>${s.class_enrolled || s.class_applied_for}</strong>.</p>
                <p style="margin-bottom:12px">During his/her tenure, his/her conduct was found to be <strong>${cnd}</strong>.</p>
                <p>We wish him/her success in future endeavours.</p>
                <table style="width:50%;margin-top:24px"><tr><td style="background:#fafafa;font-weight:600">Serial No</td><td><strong>${serial}</strong></td></tr></table>
            </div>`

        const win = window.open('', '_blank', 'width=860,height=760')
        win.document.write(`<!DOCTYPE html><html><head><title>${type} Certificate</title><style>${baseCss}</style></head><body>
            ${schoolHeader}
            <h2>${type === 'leaving' ? 'School Leaving Certificate' : 'Character Certificate'}</h2>
            ${bodyHtml}
            <div class="stamp-row">
                <div class="sig"><div style="margin-bottom:50px"></div>Class Teacher</div>
                <div class="sig"><div style="margin-bottom:50px"></div>Principal / Head of Institution</div>
            </div>
            <br/><button onclick="window.print()" style="padding:10px 20px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ Print Certificate</button>
            <script>setTimeout(()=>window.print(),600)</script>
        </body></html>`)
        win.document.close()
    }

    // ── Render ────────────────────────────────────────────────────────────
    const cardStyle = (borderColor) => ({
        background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px',
        border: '1px solid var(--border)', borderLeft: `4px solid ${borderColor}`,
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
    })

    // Check if clearance is met (no dues)
    const hasClearance = selectedStudent && Number(selectedStudent.total_arrears) === 0
    const alreadyIssued = selectedStudent?.certificate_issued

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>🎓 Issue Certificates</h1>
                <p className={styles.subtitle}>Robust Control Panel for Leaving and Character Certificates</p>
            </div>

            {/* Smart Stats Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={cardStyle('var(--text-secondary)')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stats.total_eligible}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Students</div>
                </div>
                <div style={cardStyle('#10b981')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{stats.certificates_issued}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Certs Issued</div>
                </div>
                <div style={cardStyle('#7c3aed')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed' }}>{stats.leaving_issued}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Leaving Certs</div>
                </div>
                <div style={cardStyle('#0ea5e9')}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0ea5e9' }}>{stats.character_issued}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Character Certs</div>
                </div>
            </div>

            {/* Manual Search Form */}
            <div className={styles.formCard} style={{ marginBottom: '1.5rem' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className={styles.formGroup} style={{ marginBottom: 0, minWidth: '150px' }}>
                        <label>🎓 Filter by Class</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value="">-- All Classes --</option>
                            {CLASS_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className={styles.formGroup} style={{ marginBottom: 0, flex: 1, minWidth: '250px' }}>
                        <label>🔍 Find Student (Name or GR Number)</label>
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Type name or exact GR number..."
                        />
                    </div>
                    <button type="submit" disabled={searching} className={styles.primaryBtn} style={{ padding: '0.7rem 1.7rem', height: '100%', marginBottom: '2px' }}>
                        {searching ? '🔎 Searching...' : '🔎 Search'}
                    </button>
                    {(hasSearched || selectedStudent) && (
                        <button type="button" onClick={() => { setSearchResults([]); setHasSearched(false); setSelectedStudent(null); setSearchQuery(''); setSelectedClass(''); }} style={{ padding: '0.7rem 1.2rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', height: '100%', marginBottom: '2px' }}>
                            ✖ Clear
                        </button>
                    )}
                </form>

                {/* Search Results Table */}
                {searchResults.length > 0 && !selectedStudent && (
                    <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Search Results ({searchResults.length})</h4>
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border)' }}>
                                    <tr>
                                        <th style={{ padding: '0.8rem 1rem' }}>Name</th>
                                        <th style={{ padding: '0.8rem 1rem' }}>GR Num</th>
                                        <th style={{ padding: '0.8rem 1rem' }}>Class</th>
                                        <th style={{ padding: '0.8rem 1rem' }}>Cert Status</th>
                                        <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResults.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>{s.name}</td>
                                            <td style={{ padding: '0.8rem 1rem' }}>{s.gr_number || '—'}</td>
                                            <td style={{ padding: '0.8rem 1rem' }}>{s.class_enrolled || s.class_applied_for}</td>
                                            <td style={{ padding: '0.8rem 1rem' }}>
                                                {s.certificate_issued ? (
                                                    <span style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                        {s.certificate_issued.toUpperCase()} ISSUED
                                                    </span>
                                                ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>}
                                            </td>
                                            <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                                                <button onClick={() => loadClearance(s.id)} style={{ padding: '0.4rem 1rem', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                                    Select →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {loadingClearance && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }} /> Loading Clearance Data...
                </div>
            )}

            {/* Clearance & Issuance Dashboard */}
            {selectedStudent && !loadingClearance && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Status Overview Card */}
                    <div className={styles.formCard} style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.2rem', color: 'var(--brand-red)' }}>{selectedStudent.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                GR: <strong>{selectedStudent.gr_number || '—'}</strong> &nbsp;|&nbsp;
                                Class: <strong>{selectedStudent.class_enrolled || selectedStudent.class_applied_for}</strong> &nbsp;|&nbsp;
                                Father: <strong>{selectedStudent.father_name || '—'}</strong>
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.5rem', background: hasClearance ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '8px', border: `1px solid ${hasClearance ? '#10b981' : '#ef4444'}`, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ fontSize: '2.5rem' }}>{hasClearance ? '✅' : '⚠️'}</div>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: hasClearance ? '#065f46' : '#991b1b' }}>
                                    {hasClearance ? 'Clearance Granted' : `Outstanding Dues: ${fmt(selectedStudent.total_arrears)}`}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: hasClearance ? '#047857' : '#b91c1c' }}>
                                    {hasClearance ? 'Eligible to issue certificates' : `Student has ${selectedStudent.arrears.length} unpaid month(s)`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dues List */}
                    {!hasClearance && (
                        <div className={styles.formCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', color: '#991b1b' }}>Unpaid Fee Months (Clearance Pending)</h3>
                                <button onClick={() => printClearanceChallan(selectedStudent)} style={{ padding: '0.5rem 1rem', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                    🖨️ Print Dues Challan
                                </button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <tbody>
                                    {selectedStudent.arrears.map(a => (
                                        <tr key={a.record_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.8rem 0', fontWeight: 600 }}>{a.fee_month}</td>
                                            <td style={{ padding: '0.8rem 0', textAlign: 'right', color: '#991b1b', fontWeight: 800 }}>{fmt(a.amount_due)}</td>
                                            <td style={{ padding: '0.8rem 0', textAlign: 'right', width: '140px' }}>
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => a.record_id > 0 ? markNormalFeePaid(a.record_id, 'Cash') : markAdmissionBalancePaid('Cash')} style={{ padding: '0.3rem 0.6rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                                                        💵 Cash
                                                    </button>
                                                    <button onClick={() => a.record_id > 0 ? markNormalFeePaid(a.record_id, 'Bank') : markAdmissionBalancePaid('Bank')} style={{ padding: '0.3rem 0.6rem', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
                                                        🏦 Bank
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                                        <td style={{ padding: '1rem 0', fontWeight: 800, fontSize: '1.1rem' }}>TOTAL DUE</td>
                                        <td style={{ padding: '1rem 0', textAlign: 'right', color: '#991b1b', fontWeight: 800, fontSize: '1.1rem' }}>{fmt(selectedStudent.total_arrears)}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Issuance Form */}
                    <div className={styles.formCard} style={{ opacity: hasClearance ? 1 : 0.6, pointerEvents: hasClearance ? 'auto' : 'none' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                            🎓 Issue Official Certificates
                        </h3>

                        {alreadyIssued && (
                            <div style={{ padding: '1rem', background: '#f8fafc', borderLeft: '4px solid #3b82f6', marginBottom: '1.5rem', borderRadius: '0 8px 8px 0' }}>
                                <p style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.5rem' }}>ⓘ Previously Issued: {alreadyIssued.toUpperCase()}</p>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {(alreadyIssued === 'leaving' || alreadyIssued === 'both') && (
                                        <button onClick={() => printCert('leaving', selectedStudent)} style={{ padding: '0.4rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Reprint Leaving Cert</button>
                                    )}
                                    {(alreadyIssued === 'character' || alreadyIssued === 'both') && (
                                        <button onClick={() => printCert('character', selectedStudent)} style={{ padding: '0.4rem 1rem', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🖨️ Reprint Character Cert</button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className={styles.formGroup}>
                                <label>Select Certificate to Issue</label>
                                <select value={certType} onChange={e => setCertType(e.target.value)} style={{ padding: '0.8rem', fontSize: '1rem' }}>
                                    <option value="leaving">📋 Leaving Certificate</option>
                                    <option value="character">🏅 Character Certificate</option>
                                    <option value="both">📋 + 🏅 Both Certificates</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Conduct / Character Remark</label>
                                <select value={conduct} onChange={e => setConduct(e.target.value)} style={{ padding: '0.8rem', fontSize: '1rem' }}>
                                    {['Excellent', 'Very Good', 'Good', 'Satisfactory'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Official Leaving Date</label>
                                <input type="date" value={leavingDate} onChange={e => setLeavingDate(e.target.value)} style={{ padding: '0.8rem' }} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Reason for Leaving</label>
                                <input value={leavingReason} onChange={e => setLeavingReason(e.target.value)} placeholder="e.g. Migration, Graduated..." style={{ padding: '0.8rem' }} />
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                            <button onClick={issueCert} disabled={issuing || !hasClearance} style={{ padding: '0.9rem 2rem', background: '#111', color: '#fff', border: 'none', borderRadius: '8px', cursor: hasClearance ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '1rem' }}>
                                {issuing ? 'Saving...' : '💾 Save to Record & Print Certificates'}
                            </button>
                            {hasClearance && (
                                <button onClick={() => printClearanceChallan(selectedStudent)} style={{ padding: '0.9rem 1.5rem', background: 'transparent', color: '#111', border: '2px solid #111', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '1rem' }}>
                                    🖨️ Print Final Clearance
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
