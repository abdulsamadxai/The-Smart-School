import { useState, useEffect } from 'react'
import api from '../api/client'
import { toast } from 'react-hot-toast'

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

function StatCard({ icon, label, value, sub, color, bg }) {
    return (
        <div style={{
            background: bg || 'var(--bg-card)', borderRadius: '14px', padding: '1.35rem 1.5rem',
            border: '1.5px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', gap: '0.6rem',
            transition: 'transform 0.18s, box-shadow 0.18s', cursor: 'default',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 22px rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>{icon}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>{sub}</div>}
        </div>
    )
}

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


    // Check if clearance is met (no dues from FeeRecord)
    const hasClearance = selectedStudent && Number(selectedStudent.total_arrears) === 0
    const alreadyIssued = selectedStudent?.certificate_issued
    const unpaidCount = selectedStudent?.arrears?.length || 0
    const inp = { padding: '0.68rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', width: '100%' }

    return (
        <div style={{ padding: '2rem 2.5rem', minHeight: '100vh', background: 'var(--bg-base, #f4f1ef)' }}>

            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.75rem' }}>
                <div style={{ width: 46, height: 46, borderRadius: '11px', background: 'linear-gradient(135deg, #8B1A1A, #cf2e2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(139,26,26,0.25)' }}>🎓</div>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Certificate Issuance</h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Issue Leaving &amp; Character Certificates — outstanding dues verified from Fee Records</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <StatCard icon="🧑‍🎓" label="Eligible Students" value={stats.total_eligible} sub="Admitted or joined" color="#6366f1" bg="linear-gradient(145deg,#fff 0%,#f5f3ff 100%)" />
                <StatCard icon="📋" label="Leaving Certs" value={stats.leaving_issued} sub="School leaving certificates issued" color="#7c3aed" bg="linear-gradient(145deg,#fff 0%,#faf5ff 100%)" />
                <StatCard icon="🏅" label="Character Certs" value={stats.character_issued} sub="Character certificates issued" color="#0ea5e9" bg="linear-gradient(145deg,#fff 0%,#f0f9ff 100%)" />
                <StatCard icon="✅" label="Total Issued" value={stats.certificates_issued} sub="All certificate types combined" color="#10b981" bg="linear-gradient(145deg,#fff 0%,#f0fdf4 100%)" />
                <StatCard icon="⏳" label="Pending Issuance" value={stats.pending} sub="Students without any certificate" color={stats.pending > 0 ? '#f59e0b' : '#10b981'} bg="linear-gradient(145deg,#fff 0%,#fffbeb 100%)" />
            </div>

            {/* Search Panel */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>🔍 Find Student</div>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '160px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter by Class</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={inp}>
                            <option value="">— All Classes —</option>
                            {CLASS_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '260px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name or GR Number</label>
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Type student name or GR number…" style={inp} />
                    </div>
                    <button type="submit" disabled={searching} style={{ padding: '0.68rem 1.6rem', borderRadius: '8px', background: 'var(--brand-red-dark, #8B1A1A)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', opacity: searching ? 0.7 : 1 }}>
                        {searching ? '🔎 Searching…' : '🔎 Search'}
                    </button>
                    {(hasSearched || selectedStudent) && (
                        <button type="button" onClick={() => { setSearchResults([]); setHasSearched(false); setSelectedStudent(null); setSearchQuery(''); setSelectedClass('') }}
                            style={{ padding: '0.68rem 1rem', borderRadius: '8px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                            ✖ Clear
                        </button>
                    )}
                </form>

                {/* Search Results Table */}
                {searchResults.length > 0 && !selectedStudent && (
                    <div style={{ marginTop: '1.4rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {searchResults.length} student{searchResults.length !== 1 ? 's' : ''} found
                        </div>
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-base)', borderBottom: '2px solid var(--border)' }}>
                                        {['Student Name', 'GR Number', 'Class', 'Certificate Status', ''].map(h => (
                                            <th key={h} style={{ padding: '0.65rem 1rem', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchResults.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-base)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '0.72rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                                            <td style={{ padding: '0.72rem 1rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{s.gr_number || '—'}</td>
                                            <td style={{ padding: '0.72rem 1rem', color: 'var(--text-secondary)' }}>{s.class_enrolled || s.class_applied_for}</td>
                                            <td style={{ padding: '0.72rem 1rem' }}>
                                                {s.certificate_issued
                                                    ? <span style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '3px 9px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700 }}>✅ {s.certificate_issued.toUpperCase()}</span>
                                                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Not Issued</span>}
                                            </td>
                                            <td style={{ padding: '0.72rem 1rem', textAlign: 'right' }}>
                                                <button onClick={() => loadClearance(s.id)} style={{ padding: '0.36rem 1rem', background: '#111', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Open →</button>
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
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                    Loading student clearance data…
                </div>
            )}

            {/* Student Clearance & Certificate Panel */}
            {selectedStudent && !loadingClearance && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Student Identity Banner */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '1.25rem 1.5rem', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, #8B1A1A, #cf2e2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                                {selectedStudent.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedStudent.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <span>GR: <strong style={{ color: 'var(--text-secondary)' }}>{selectedStudent.gr_number || '—'}</strong></span>
                                    <span>Class: <strong style={{ color: 'var(--text-secondary)' }}>{selectedStudent.class_enrolled || selectedStudent.class_applied_for}</strong></span>
                                    <span>Father: <strong style={{ color: 'var(--text-secondary)' }}>{selectedStudent.father_name || '—'}</strong></span>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '0.85rem 1.3rem', borderRadius: '10px', background: hasClearance ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1.5px solid ${hasClearance ? '#10b981' : '#ef4444'}`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.8rem' }}>{hasClearance ? '✅' : '⚠️'}</div>
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: hasClearance ? '#065f46' : '#991b1b' }}>
                                    {hasClearance ? 'Clearance Granted' : `Dues: ${fmt(selectedStudent.total_arrears)}`}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: hasClearance ? '#047857' : '#b91c1c', marginTop: '0.1rem' }}>
                                    {hasClearance ? 'No pending fees — eligible to issue certificates' : `${unpaidCount} unpaid record${unpaidCount !== 1 ? 's' : ''} found in Fee Records`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Outstanding Dues Section — only shown when unpaid FeeRecords exist */}
                    {!hasClearance && (
                        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '1.5rem', border: '1.5px solid #fca5a5', boxShadow: '0 2px 8px rgba(239,68,68,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#991b1b' }}>🔴 Outstanding Fee Dues</div>
                                    <div style={{ fontSize: '0.76rem', color: '#b91c1c', marginTop: '0.2rem' }}>
                                        Source: Fee Records — only unpaid monthly fees &amp; arrear entries are listed
                                    </div>
                                </div>
                                <button onClick={() => printDuesChallan(selectedStudent)}
                                    style={{ padding: '0.5rem 1.1rem', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>
                                    🖨️ Generate Fee Dues Challan
                                </button>
                            </div>
                            <div style={{ overflowX: 'auto', border: '1px solid #fca5a5', borderRadius: '8px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: '#fef2f2', borderBottom: '1.5px solid #fca5a5' }}>
                                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.73rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fee Month / Description</th>
                                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.73rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Amount Due</th>
                                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.73rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', width: '160px' }}>Mark Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedStudent.arrears.map((a, idx) => (
                                            <tr key={a.record_id} style={{ borderBottom: '1px solid #fecaca', background: idx % 2 === 0 ? 'transparent' : '#fff5f5' }}>
                                                <td style={{ padding: '0.72rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.fee_month}</td>
                                                <td style={{ padding: '0.72rem 1rem', textAlign: 'right', color: '#991b1b', fontWeight: 800, fontSize: '0.93rem' }}>{fmt(a.amount_due)}</td>
                                                <td style={{ padding: '0.72rem 1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => a.record_id > 0 ? markFeePaid(a.record_id, 'Cash') : markAdmissionBalancePaid('Cash')}
                                                            style={{ padding: '0.3rem 0.7rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>💵 Cash</button>
                                                        <button onClick={() => a.record_id > 0 ? markFeePaid(a.record_id, 'Bank') : markAdmissionBalancePaid('Bank')}
                                                            style={{ padding: '0.3rem 0.7rem', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem', color: '#1e40af', fontWeight: 700 }}>🏦 Bank</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid #fca5a5', background: '#fef2f2' }}>
                                            <td style={{ padding: '0.82rem 1rem', fontWeight: 800, fontSize: '0.93rem', color: '#991b1b' }}>TOTAL OUTSTANDING DUES</td>
                                            <td style={{ padding: '0.82rem 1rem', textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: '#991b1b' }}>{fmt(selectedStudent.total_arrears)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div style={{ marginTop: '0.8rem', padding: '0.6rem 0.95rem', background: '#fff3cd', border: '1px solid #fbbf24', borderRadius: '6px', fontSize: '0.78rem', color: '#92400e' }}>
                                ⚠️ <strong>Note:</strong> Certificate issuance is locked until all outstanding dues are cleared. Mark dues as paid above or print the challan for the fee collection desk.
                            </div>
                        </div>
                    )}

                    {/* Certificate Issuance Form */}
                    <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '1.5rem', border: `1.5px solid ${hasClearance ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: hasClearance ? 1 : 0.5, pointerEvents: hasClearance ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid var(--border)' }}>
                            <span>🎓</span>
                            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Issue Official Certificates</h3>
                            {!hasClearance && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.73rem', fontWeight: 600, color: '#b91c1c', background: '#fef2f2', padding: '3px 9px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                                    🔒 Locked — Clear dues first
                                </span>
                            )}
                        </div>

                        {alreadyIssued && (
                            <div style={{ padding: '0.85rem 1.1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '1.2rem' }}>
                                <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '0.5rem', fontSize: '0.86rem' }}>
                                    ℹ️ Previously Issued: <span style={{ textTransform: 'uppercase' }}>{alreadyIssued}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    {(alreadyIssued === 'leaving' || alreadyIssued === 'both') && (
                                        <button onClick={() => printCert('leaving', selectedStudent)} style={{ padding: '0.36rem 1rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>🖨️ Reprint Leaving Certificate</button>
                                    )}
                                    {(alreadyIssued === 'character' || alreadyIssued === 'both') && (
                                        <button onClick={() => printCert('character', selectedStudent)} style={{ padding: '0.36rem 1rem', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>🖨️ Reprint Character Certificate</button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Certificate Type</label>
                                <select value={certType} onChange={e => setCertType(e.target.value)} style={inp}>
                                    <option value="leaving">📋 School Leaving Certificate</option>
                                    <option value="character">🏅 Character Certificate</option>
                                    <option value="both">📋 + 🏅 Both Certificates</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Conduct &amp; Character</label>
                                <select value={conduct} onChange={e => setConduct(e.target.value)} style={inp}>
                                    {['Excellent', 'Very Good', 'Good', 'Satisfactory'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Official Leaving Date</label>
                                <input type="date" value={leavingDate} onChange={e => setLeavingDate(e.target.value)} style={inp} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reason for Leaving</label>
                                <input value={leavingReason} onChange={e => setLeavingReason(e.target.value)} placeholder="e.g. Migration, Graduated, Transfer…" style={inp} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={issueCert} disabled={issuing || !hasClearance}
                                style={{ padding: '0.82rem 1.75rem', background: 'linear-gradient(135deg, #8B1A1A, #cf2e2e)', color: '#fff', border: 'none', borderRadius: '9px', cursor: hasClearance ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: '0.93rem', boxShadow: '0 4px 14px rgba(139,26,26,0.25)', opacity: issuing ? 0.7 : 1 }}>
                                {issuing ? '💾 Saving…' : '💾 Issue & Print Certificate'}
                            </button>
                            {hasClearance && (
                                <button onClick={() => printClearanceCert(selectedStudent)}
                                    style={{ padding: '0.82rem 1.4rem', background: 'transparent', color: '#065f46', border: '1.5px solid #10b981', borderRadius: '9px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                                    🖨️ Print No-Dues Clearance
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}
