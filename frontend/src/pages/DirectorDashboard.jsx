import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import api from '../api/client'

const formatCurrency = (val) =>
    `Rs. ${Number(val || 0).toLocaleString('en-PK')}`

const getLocalDateStr = (d = new Date()) => {
    return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

function StatCard({ icon, badge, label, value, sub, color, bgGradient, borderColor }) {
    return (
        <div style={{
            background: bgGradient || 'var(--bg-card)',
            borderRadius: '14px',
            padding: '1.4rem 1.6rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            border: `1.5px solid ${borderColor || 'var(--border)'}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '0.75rem',
            position: 'relative',
            transition: 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '160px'
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                    }}>
                        {icon}
                    </div>
                    <div>
                        <div style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {label}
                        </div>
                    </div>
                </div>
                {badge && (
                    <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: 'rgba(0,0,0,0.06)',
                        color: color || 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                    }}>
                        {badge}
                    </span>
                )}
            </div>

            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: color || 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                {value}
            </div>

            {sub && (
                <div style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    paddingTop: '0.5rem',
                    marginTop: '0.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                }}>
                    <span>{sub}</span>
                </div>
            )}
        </div>
    )
}

export default function DirectorDashboard() {
    const navigate = useNavigate()
    const [selectedDate, setSelectedDate] = useState(getLocalDateStr())
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [activeSection, setActiveSection] = useState('all') // 'all' | 'financial' | 'daily'
    const [filterTab, setFilterTab] = useState('all') // 'all' | 'Cash' | 'Bank'
    const [tableSearch, setTableSearch] = useState('')

    const pollingRef = useRef(null)

    // Define loadStats BEFORE the useEffect hooks that use it
    const loadStats = useCallback(async (dateStr, showSpinner = false) => {
        try {
            if (showSpinner) setLoading(true)
            else setRefreshing(true)

            const { data } = await api.get('/director/stats', {
                params: { date: dateStr }
            })
            setStats(data)
        } catch (err) {
            if (err.response?.status === 403) {
                toast.error('Access denied. Director credentials required.')
                navigate('/')
            } else {
                toast.error('Failed to load director stats')
            }
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [navigate])

    useEffect(() => {
        loadStats(selectedDate, true)
    }, [selectedDate, loadStats])

    // Auto-sync polling every 20 seconds
    useEffect(() => {
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = setInterval(() => {
            loadStats(selectedDate, false)
        }, 20000)

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
        }
    }, [selectedDate, loadStats])

    const setQuickDate = useCallback((offsetDays) => {
        const d = new Date()
        d.setDate(d.getDate() + offsetDays)
        setSelectedDate(getLocalDateStr(d))
    }, [])

    // Printable slip report for Director
    const printDailySlip = useCallback((method) => {
        if (!stats?.daily_records) return
        const records = stats.daily_records.filter(
            r => (r.payment_method || '').toLowerCase() === method.toLowerCase()
        )
        if (records.length === 0) {
            return toast.error(`No ${method} payments recorded on ${selectedDate}.`)
        }
        const total = records.reduce((sum, r) => sum + Number(r.amount_due || 0), 0)
        const slipInfo = method.toLowerCase() === 'cash' ? stats.daily_cash : stats.daily_bank

        const rowsHtml = records.map((r, i) => `
            <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><strong>${r.student_name}</strong></td>
                <td>${r.parent_name || '—'}</td>
                <td style="text-align:center;">${r.gr_number || '—'}</td>
                <td style="text-align:center;">${r.class_applied_for || '—'}</td>
                <td style="text-align:center;">${r.fee_month}</td>
                <td style="text-align:right; font-weight:700;">Rs. ${Number(r.amount_due).toLocaleString('en-PK')}</td>
                <td style="text-align:center; font-size:11px; color:#555;">${r.cleared_at || '—'}</td>
            </tr>
        `).join('')

        const win = window.open('', '_blank', 'width=950,height=750')
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Official Daily ${method} Slip – ${selectedDate}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Times New Roman', serif; padding: 36px; color: #111; }
                    .header { text-align: center; margin-bottom: 24px; border-bottom: 3px double #111; padding-bottom: 18px; }
                    .header h1 { font-size: 22px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
                    .header h2 { font-size: 15px; font-weight: 600; color: #444; margin-bottom: 8px; }
                    .badge { display: inline-block; background: ${method.toLowerCase() === 'cash' ? '#15803d' : '#1d4ed8'}; color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; }
                    .meta-grid { display: flex; justify-content: space-between; margin-top: 14px; font-size: 12.5px; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
                    th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-size: 12px; border: 1px solid #ccc; font-weight: 700; }
                    td { padding: 8px 10px; font-size: 12px; border: 1px solid #ddd; }
                    tr:nth-child(even) { background: #fafafa; }
                    .total-row { font-weight: 800; background: #eef2ff !important; font-size: 13.5px; }
                    .slip-status-box { margin-top: 20px; padding: 10px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; display: flex; justify-content: space-between; }
                    .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                    .sig { border-top: 1.5px solid #444; padding-top: 8px; min-width: 220px; text-align: center; font-size: 12.5px; color: #333; }
                    @media print { .no-print { display: none; } body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>The Smart School – Bara Kahu Campus</h1>
                    <h2>Official Daily Fee Collection Slip</h2>
                    <span class="badge">${method.toLowerCase() === 'cash' ? '💵' : '🏦'} Daily ${method} Report</span>
                    <div class="meta-grid">
                        <span>Collection Date: <strong>${selectedDate}</strong></span>
                        <span>Total Records: <strong>${records.length}</strong></span>
                        <span>Total Amount: <strong>Rs. ${total.toLocaleString('en-PK')}</strong></span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="text-align:center; width:35px;">#</th>
                            <th>Student Name</th>
                            <th>Parent Name</th>
                            <th style="text-align:center; width:75px;">GR No.</th>
                            <th style="text-align:center; width:70px;">Class</th>
                            <th style="text-align:center; width:90px;">Fee Month</th>
                            <th style="text-align:right; width:110px;">Amount (Rs.)</th>
                            <th style="text-align:center; width:110px;">Cleared At</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="total-row">
                            <td colspan="6" style="text-align:right;">TOTAL ${method.toUpperCase()} COLLECTED:</td>
                            <td style="text-align:right;">Rs. ${total.toLocaleString('en-PK')}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>

                <div class="slip-status-box">
                    <span>Official Slip Status: <strong>${slipInfo?.slip_printed ? '✅ PRINTED by ' + (slipInfo?.printed_by || 'Admin') + ' (' + (slipInfo?.printed_at || '') + ')' : '⏳ PENDING OFFICIAL ADMIN PRINT'}</strong></span>
                    <span>Printed Date: <strong>${new Date().toLocaleString('en-PK')}</strong></span>
                </div>

                <div class="footer">
                    <div class="sig">
                        <strong>Fee Officer / Cashier</strong><br/>
                        <span style="font-size:11px; color:#666;">Verified & Handed Over</span>
                    </div>
                    <div class="sig">
                        <strong>Director / Principal</strong><br/>
                        <span style="font-size:11px; color:#666;">Approved & Received</span>
                    </div>
                </div>

                <div style="margin-top:25px;" class="no-print">
                    <button onclick="window.print()" style="padding:9px 22px; background:#111; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13.5px; font-weight:600;">
                        🖨️ Print Slip Now
                    </button>
                </div>
                <script>setTimeout(() => window.print(), 600)</script>
            </body>
            </html>
        `)
        win.document.close()
    }, [stats, selectedDate])

    // Filtered daily transaction rows
    const filteredDailyRecords = useMemo(() => {
        if (!stats?.daily_records) return []
        let list = stats.daily_records

        if (filterTab !== 'all') {
            list = list.filter(r => (r.payment_method || '').toLowerCase() === filterTab.toLowerCase())
        }

        if (tableSearch.trim()) {
            const q = tableSearch.toLowerCase()
            list = list.filter(r =>
                (r.student_name || '').toLowerCase().includes(q) ||
                (r.parent_name || '').toLowerCase().includes(q) ||
                (r.gr_number || '').toLowerCase().includes(q) ||
                (r.class_applied_for || '').toLowerCase().includes(q)
            )
        }

        return list
    }, [stats?.daily_records, filterTab, tableSearch])

    const formattedSelectedDate = useMemo(() => {
        try {
            const [y, m, d] = selectedDate.split('-')
            const dateObj = new Date(y, m - 1, d)
            return dateObj.toLocaleDateString('en-PK', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })
        } catch {
            return selectedDate
        }
    }, [selectedDate])

    const isToday = selectedDate === getLocalDateStr()

    // Combined daily total
    const dailyTotalCombined = (stats?.daily_cash?.total || 0) + (stats?.daily_bank?.total || 0)
    const dailyCountCombined = (stats?.daily_cash?.count || 0) + (stats?.daily_bank?.count || 0)
    const cashPercent = dailyTotalCombined > 0 ? Math.round(((stats?.daily_cash?.total || 0) / dailyTotalCombined) * 100) : 0
    const bankPercent = dailyTotalCombined > 0 ? (100 - cashPercent) : 0

    return (
        <div style={{ padding: '2rem 2.5rem', minHeight: '100vh', background: 'var(--bg-base, #f4f1ef)' }}>
            {/* TOP BAR / EXECUTIVE HEADER */}
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '1.4rem 1.8rem',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
                    {/* Left: Brand & Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--brand-red-dark, #8B1A1A), var(--brand-red, #cf2e2e))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.75rem', flexShrink: 0,
                            boxShadow: '0 4px 14px rgba(139,26,26,0.25)',
                            color: '#fff'
                        }}>👔</div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                                    Director's Executive Suite
                                </h1>
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                                    borderRadius: '12px', background: 'var(--brand-red-pale, rgba(207,46,46,0.08))',
                                    color: 'var(--brand-red, #cf2e2e)', border: '1px solid rgba(207,46,46,0.2)'
                                }}>
                                    EXECUTIVE
                                </span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.25rem' }}>
                                The Smart School – Bara Kahu Campus · Comprehensive Financial, Annual & Daily Oversight
                            </p>
                        </div>
                    </div>

                    {/* Right: Quick Campus Health & Sync controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                        {/* Student Ratio pill */}
                        {stats && (
                            <div style={{
                                padding: '0.45rem 0.95rem',
                                background: 'var(--bg-base, #f4f1ef)',
                                borderRadius: '10px',
                                border: '1px solid var(--border)',
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem'
                            }}>
                                <span>🧑‍🎓</span>
                                <span>Enrollment: <strong style={{ color: 'var(--text-primary)' }}>{stats.total_admitted}</strong> admitted / {stats.total_students} registered</span>
                            </div>
                        )}

                        {/* Live Sync Badge */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem',
                            padding: '0.45rem 0.95rem', background: 'var(--bg-base, #f4f1ef)',
                            borderRadius: '10px', border: '1px solid var(--border)',
                            fontSize: '0.78rem', color: 'var(--text-muted)'
                        }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: '#16a34a', display: 'inline-block',
                                boxShadow: '0 0 0 2px rgba(22,163,74,0.2)'
                            }} />
                            <span>Live Sync (20s)</span>
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={() => loadStats(selectedDate, false)}
                            disabled={refreshing}
                            style={{
                                padding: '0.45rem 1rem',
                                background: 'var(--brand-red-dark, #8B1A1A)',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                boxShadow: '0 2px 8px rgba(139,26,26,0.2)'
                            }}
                            title="Refresh financial data now"
                        >
                            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s' }}>
                                🔄
                            </span>
                            {refreshing ? 'Updating…' : 'Sync Now'}
                        </button>
                    </div>
                </div>

                {/* Section Filter Pills */}
                <div style={{
                    display: 'flex', gap: '0.5rem', marginTop: '1.25rem',
                    borderTop: '1px solid var(--border)', paddingTop: '1rem'
                }}>
                    <button
                        onClick={() => setActiveSection('all')}
                        style={{
                            padding: '0.4rem 0.95rem',
                            borderRadius: '8px',
                            border: activeSection === 'all' ? '1.5px solid var(--brand-red)' : '1px solid var(--border)',
                            background: activeSection === 'all' ? 'var(--brand-red-pale)' : 'transparent',
                            color: activeSection === 'all' ? 'var(--brand-red)' : 'var(--text-secondary)',
                            fontWeight: activeSection === 'all' ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        📋 Complete Executive Overview
                    </button>
                    <button
                        onClick={() => setActiveSection('financial')}
                        style={{
                            padding: '0.4rem 0.95rem',
                            borderRadius: '8px',
                            border: activeSection === 'financial' ? '1.5px solid var(--brand-red)' : '1px solid var(--border)',
                            background: activeSection === 'financial' ? 'var(--brand-red-pale)' : 'transparent',
                            color: activeSection === 'financial' ? 'var(--brand-red)' : 'var(--text-secondary)',
                            fontWeight: activeSection === 'financial' ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        🏛️ Institutional & Annual Revenue (6 Cards)
                    </button>
                    <button
                        onClick={() => setActiveSection('daily')}
                        style={{
                            padding: '0.4rem 0.95rem',
                            borderRadius: '8px',
                            border: activeSection === 'daily' ? '1.5px solid var(--brand-red)' : '1px solid var(--border)',
                            background: activeSection === 'daily' ? 'var(--brand-red-pale)' : 'transparent',
                            color: activeSection === 'daily' ? 'var(--brand-red)' : 'var(--text-secondary)',
                            fontWeight: activeSection === 'daily' ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                        }}
                    >
                        ⚡ Daily Cash & Bank Counter Audit
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1.25rem' }} />
                    Loading Director's Financial Suite…
                </div>
            ) : stats ? (
                <>
                    {/* ============================================================== */}
                    {/* SECTION 1: INSTITUTIONAL FINANCIAL & ANNUAL REVENUE (6 CARDS)  */}
                    {/* ============================================================== */}
                    {(activeSection === 'all' || activeSection === 'financial') && (
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            padding: '1.75rem',
                            border: '1px solid var(--border)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                            marginBottom: '2rem'
                        }}>
                            {/* Section Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.4rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>🏛️</span>
                                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                            Institutional Revenue & Fee Structure Overview
                                        </h2>
                                    </div>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.2rem' }}>
                                        Recurring tuition, annual charges (billed after 1 year), admission revenue, and security reserves
                                    </p>
                                </div>
                                <span style={{
                                    fontSize: '0.74rem', fontWeight: 600, padding: '4px 10px',
                                    borderRadius: '8px', background: 'var(--bg-base)', color: 'var(--text-muted)',
                                    border: '1px solid var(--border)'
                                }}>
                                    Session 2025–2026
                                </span>
                            </div>

                            {/* 6 Balanced KPI Cards: 3x2 Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                gap: '1.2rem'
                            }}>
                                {/* Card 1: Current Month Tuition */}
                                <StatCard
                                    icon="📅"
                                    badge="Monthly Tuition"
                                    label="Current Month Fee Income"
                                    value={formatCurrency(stats.total_monthly_fee)}
                                    sub="Net monthly tuition cleared for this month"
                                    color="#cf2e2e"
                                    borderColor="rgba(207,46,46,0.25)"
                                    bgGradient="linear-gradient(145deg, #ffffff 0%, #fff5f5 100%)"
                                />

                                {/* Card 2: Annual Fee (Charged after 1 year) [NEW CARD] */}
                                <StatCard
                                    icon="📜"
                                    badge="Annual Charges"
                                    label="Annual Fee (After 1 Year)"
                                    value={formatCurrency(stats.total_annual_fee)}
                                    sub="Charged annually per student after 1 year of enrollment"
                                    color="#7c3aed"
                                    borderColor="#ddd6fe"
                                    bgGradient="linear-gradient(145deg, #ffffff 0%, #faf5ff 100%)"
                                />

                                {/* Card 3: Projected Annual Tuition */}
                                <StatCard
                                    icon="📈"
                                    badge="Yearly Run Rate"
                                    label="Projected Annual Income"
                                    value={formatCurrency(stats.projected_annual_fee)}
                                    sub="Sum of all cleared fee records for current year"
                                    color="#1d4ed8"
                                    borderColor="#bfdbfe"
                                    bgGradient="linear-gradient(145deg, #ffffff 0%, #eff6ff 100%)"
                                />

                                {/* Card 4: Admission Fees Collected */}
                                <StatCard
                                    icon="🏛️"
                                    badge="One-Time Capital"
                                    label="Admission Fees Collected"
                                    value={formatCurrency(stats.total_collected)}
                                    sub="Non-refundable fee from saved admission challans"
                                    color="#d97706"
                                    borderColor="#fde68a"
                                    bgGradient="linear-gradient(145deg, #ffffff 0%, #fffbeb 100%)"
                                />

                                {/* Card 5: Security Fee Collected */}
                                <StatCard
                                    icon="🔒"
                                    badge="Refundable Liability"
                                    label="Security Deposit Held"
                                    value={formatCurrency(stats.total_security)}
                                    sub="Held in trust, refundable upon student leaving"
                                    color="#0d9488"
                                    borderColor="#99f6e4"
                                    bgGradient="linear-gradient(145deg, #ffffff 0%, #f0fdfa 100%)"
                                />

                                {/* Card 6: Enrollment Health & Conversion Rate */}
                                <StatCard
                                    icon="🧑‍🎓"
                                    badge="Campus Health"
                                    label="Enrollment Conversion"
                                    value={`${stats.total_admitted} Admitted`}
                                    sub={`${stats.total_students} registered inquiries (${Math.round((stats.total_admitted / (stats.total_students || 1)) * 100)}% conversion rate)`}
                                    color="#8B1A1A"
                                    borderColor="rgba(139,26,26,0.25)"
                                    bgGradient="linear-gradient(145deg, #ffffff 0%, #fbf7f6 100%)"
                                />
                            </div>

                            {/* Informative Guidance Banner */}
                            <div style={{
                                marginTop: '1.25rem',
                                padding: '0.85rem 1.25rem',
                                borderRadius: '10px',
                                background: 'rgba(207,46,46,0.04)',
                                border: '1px solid rgba(207,46,46,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)'
                            }}>
                                <span style={{ fontSize: '1rem' }}>ℹ️</span>
                                <span>
                                    <strong>Fee Structure Rationale:</strong> The <strong>Annual Fee</strong> is charged once per academic year after 1 year of study to cover annual examinations, library, software, and campus facility upkeep. Monthly fees reflect net tuition after applied scholarships/discounts.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* SECTION 2: DAILY COUNTER COLLECTIONS & SLIP PRINT SYNC         */}
                    {/* ============================================================== */}
                    {(activeSection === 'all' || activeSection === 'daily') && (
                        <div style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            padding: '1.75rem',
                            border: '1px solid var(--border)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                            marginBottom: '2rem'
                        }}>
                            {/* Date Filter & Section Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                marginBottom: '1.5rem',
                                borderBottom: '1px solid var(--border)',
                                paddingBottom: '1.2rem'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.25rem' }}>⚡</span>
                                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                            Daily Counter Collections & Official Slip Print Sync
                                        </h2>
                                    </div>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.2rem' }}>
                                        Real-time tracking of Cash & Bank payments cleared at fee counters with official slip verification
                                    </p>
                                </div>

                                {/* Date Filter Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                        Date:
                                    </span>

                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                                        style={{
                                            padding: '0.45rem 0.85rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-strong, #ccc)',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            background: 'var(--bg-input, #fff)',
                                            cursor: 'pointer'
                                        }}
                                    />

                                    <button
                                        onClick={() => setQuickDate(0)}
                                        style={{
                                            padding: '0.42rem 0.85rem',
                                            borderRadius: '6px',
                                            border: isToday ? '1.5px solid var(--brand-red)' : '1px solid var(--border)',
                                            background: isToday ? 'var(--brand-red-pale)' : 'var(--bg-card)',
                                            color: isToday ? 'var(--brand-red)' : 'var(--text-secondary)',
                                            fontWeight: isToday ? 700 : 500,
                                            fontSize: '0.78rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📅 Today
                                    </button>

                                    <button
                                        onClick={() => setQuickDate(-1)}
                                        style={{
                                            padding: '0.42rem 0.85rem',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-secondary)',
                                            fontWeight: 500,
                                            fontSize: '0.78rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ⏮️ Yesterday
                                    </button>
                                </div>
                            </div>

                            {/* Active Date Banner */}
                            <div style={{
                                padding: '0.65rem 1rem',
                                borderRadius: '8px',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border)',
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                marginBottom: '1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                <div>
                                    Auditing collection records for: <strong style={{ color: 'var(--text-primary)' }}>{formattedSelectedDate}</strong>
                                </div>
                                <div>
                                    Total Daily Cleared: <strong style={{ color: 'var(--brand-red-dark)' }}>{formatCurrency(dailyTotalCombined)}</strong> ({dailyCountCombined} payment{dailyCountCombined === 1 ? '' : 's'})
                                </div>
                            </div>

                            <StatsCards stats={stats} printDailySlip={printDailySlip} dailyTotalCombined={dailyTotalCombined} cashPercent={cashPercent} bankPercent={bankPercent} />

                            {/* Detailed Daily Transactions Table */}
                            <DailySlipsTable 
                                filteredDailyRecords={filteredDailyRecords} 
                                stats={stats} 
                                filterTab={filterTab} 
                                setFilterTab={setFilterTab} 
                                tableSearch={tableSearch} 
                                setTableSearch={setTableSearch} 
                                formattedSelectedDate={formattedSelectedDate} 
                                formatCurrency={formatCurrency} 
                            />
                        </div>
                    )}
                </>
            ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '5rem' }}>No data available.</div>
            )}
        </div>
    )
}


const StatsCards = React.memo(({ stats, printDailySlip, dailyTotalCombined, cashPercent, bankPercent }) => {
    return (
        <>
            {/* 3 Prominent Daily Cards: Cash, Bank, Combined */}
            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                                gap: '1.25rem',
                                marginBottom: '1.75rem'
                            }}>
                                {/* Card A: Daily Cash */}
                                <div style={{
                                    background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%)',
                                    borderRadius: '14px',
                                    padding: '1.5rem',
                                    border: '1.5px solid #86efac',
                                    boxShadow: '0 4px 18px rgba(22,163,74,0.06)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '0.9rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: '10px',
                                                background: '#dcfce7', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: '1.5rem'
                                            }}>💵</div>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    Daily Cash Intake
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
                                                    {stats.daily_cash?.count || 0} Cash Payment{stats.daily_cash?.count === 1 ? '' : 's'}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => printDailySlip('Cash')}
                                            disabled={!stats.daily_cash?.count}
                                            style={{
                                                padding: '0.45rem 0.85rem',
                                                background: stats.daily_cash?.count ? '#15803d' : '#e2e8f0',
                                                color: stats.daily_cash?.count ? '#fff' : '#94a3b8',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.76rem',
                                                fontWeight: 700,
                                                cursor: stats.daily_cash?.count ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                boxShadow: stats.daily_cash?.count ? '0 2px 6px rgba(21,128,61,0.25)' : 'none'
                                            }}
                                            title="Preview and print official daily cash slip"
                                        >
                                            🖨️ View / Print Slip
                                        </button>
                                    </div>

                                    <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#15803d', letterSpacing: '-0.5px' }}>
                                        {formatCurrency(stats.daily_cash?.total)}
                                    </div>

                                    {/* Slip status */}
                                    <div style={{
                                        padding: '0.55rem 0.85rem',
                                        borderRadius: '8px',
                                        background: stats.daily_cash?.slip_printed ? '#dcfce7' : '#fef3c7',
                                        border: `1px solid ${stats.daily_cash?.slip_printed ? '#86efac' : '#fde68a'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.74rem'
                                    }}>
                                        <div style={{
                                            color: stats.daily_cash?.slip_printed ? '#166534' : '#92400e',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}>
                                            <span>{stats.daily_cash?.slip_printed ? '✅' : '⏳'}</span>
                                            <span>
                                                {stats.daily_cash?.slip_printed
                                                    ? `Slip Printed by ${stats.daily_cash.printed_by || 'Admin'}`
                                                    : 'Slip Pending Admin Print'}
                                            </span>
                                        </div>
                                        {stats.daily_cash?.slip_printed && stats.daily_cash?.printed_at && (
                                            <span style={{ color: '#166534', fontSize: '0.7rem' }}>
                                                {stats.daily_cash.printed_at}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Card B: Daily Bank */}
                                <div style={{
                                    background: 'linear-gradient(145deg, #ffffff 0%, #eff6ff 100%)',
                                    borderRadius: '14px',
                                    padding: '1.5rem',
                                    border: '1.5px solid #93c5fd',
                                    boxShadow: '0 4px 18px rgba(29,78,216,0.06)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '0.9rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: '10px',
                                                background: '#dbeafe', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: '1.5rem'
                                            }}>🏦</div>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    Daily Bank Intake
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>
                                                    {stats.daily_bank?.count || 0} Bank Payment{stats.daily_bank?.count === 1 ? '' : 's'}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => printDailySlip('Bank')}
                                            disabled={!stats.daily_bank?.count}
                                            style={{
                                                padding: '0.45rem 0.85rem',
                                                background: stats.daily_bank?.count ? '#1d4ed8' : '#e2e8f0',
                                                color: stats.daily_bank?.count ? '#fff' : '#94a3b8',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontSize: '0.76rem',
                                                fontWeight: 700,
                                                cursor: stats.daily_bank?.count ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                boxShadow: stats.daily_bank?.count ? '0 2px 6px rgba(29,78,216,0.25)' : 'none'
                                            }}
                                            title="Preview and print official daily bank slip"
                                        >
                                            🖨️ View / Print Slip
                                        </button>
                                    </div>

                                    <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#1d4ed8', letterSpacing: '-0.5px' }}>
                                        {formatCurrency(stats.daily_bank?.total)}
                                    </div>

                                    {/* Slip status */}
                                    <div style={{
                                        padding: '0.55rem 0.85rem',
                                        borderRadius: '8px',
                                        background: stats.daily_bank?.slip_printed ? '#dbeafe' : '#fef3c7',
                                        border: `1px solid ${stats.daily_bank?.slip_printed ? '#93c5fd' : '#fde68a'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.74rem'
                                    }}>
                                        <div style={{
                                            color: stats.daily_bank?.slip_printed ? '#1e40af' : '#92400e',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}>
                                            <span>{stats.daily_bank?.slip_printed ? '✅' : '⏳'}</span>
                                            <span>
                                                {stats.daily_bank?.slip_printed
                                                    ? `Slip Printed by ${stats.daily_bank.printed_by || 'Admin'}`
                                                    : 'Slip Pending Admin Print'}
                                            </span>
                                        </div>
                                        {stats.daily_bank?.slip_printed && stats.daily_bank?.printed_at && (
                                            <span style={{ color: '#1e40af', fontSize: '0.7rem' }}>
                                                {stats.daily_bank.printed_at}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Card C: Combined Total & Split */}
                                <div style={{
                                    background: 'linear-gradient(145deg, #ffffff 0%, #fbf7f6 100%)',
                                    borderRadius: '14px',
                                    padding: '1.5rem',
                                    border: '1.5px solid var(--border-strong, #d4b8b0)',
                                    boxShadow: '0 4px 18px rgba(0,0,0,0.04)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '0.9rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '10px',
                                            background: 'var(--brand-red-pale)', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', fontSize: '1.5rem'
                                        }}>📊</div>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-red-dark)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                Total Daily Collections
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                Cash + Bank Combined Intake
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--brand-red-dark, #8B1A1A)', letterSpacing: '-0.5px' }}>
                                        {formatCurrency(dailyTotalCombined)}
                                    </div>

                                    {/* Visual Split Bar */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, marginBottom: '4px' }}>
                                            <span style={{ color: '#15803d' }}>💵 Cash {cashPercent}%</span>
                                            <span style={{ color: '#1d4ed8' }}>🏦 Bank {bankPercent}%</span>
                                        </div>
                                        <div style={{ height: 7, borderRadius: 4, background: '#e2e8f0', display: 'flex', overflow: 'hidden' }}>
                                            <div style={{ width: `${cashPercent}%`, background: '#16a34a' }} />
                                            <div style={{ width: `${bankPercent}%`, background: '#2563eb' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
        </>
    );
});


const DailySlipsTable = React.memo(({
    filteredDailyRecords, stats, filterTab, setFilterTab, tableSearch, setTableSearch, formattedSelectedDate, formatCurrency
}) => {
    return (
                            <div style={{
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    padding: '1rem 1.25rem',
                                    background: 'var(--bg-base)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem',
                                    borderBottom: '1px solid var(--border)'
                                }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        📋 Cleared Transactions Log ({filteredDailyRecords.length})
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        {/* Filter Tabs */}
                                        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
                                            <button
                                                onClick={() => setFilterTab('all')}
                                                style={{
                                                    padding: '0.3rem 0.65rem',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: filterTab === 'all' ? 'var(--brand-red-dark)' : 'transparent',
                                                    color: filterTab === 'all' ? '#fff' : 'var(--text-muted)',
                                                    fontWeight: filterTab === 'all' ? 700 : 500,
                                                    fontSize: '0.74rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                All ({stats.daily_records?.length || 0})
                                            </button>
                                            <button
                                                onClick={() => setFilterTab('Cash')}
                                                style={{
                                                    padding: '0.3rem 0.65rem',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: filterTab === 'Cash' ? '#15803d' : 'transparent',
                                                    color: filterTab === 'Cash' ? '#fff' : 'var(--text-muted)',
                                                    fontWeight: filterTab === 'Cash' ? 700 : 500,
                                                    fontSize: '0.74rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                💵 Cash ({stats.daily_cash?.count || 0})
                                            </button>
                                            <button
                                                onClick={() => setFilterTab('Bank')}
                                                style={{
                                                    padding: '0.3rem 0.65rem',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: filterTab === 'Bank' ? '#1d4ed8' : 'transparent',
                                                    color: filterTab === 'Bank' ? '#fff' : 'var(--text-muted)',
                                                    fontWeight: filterTab === 'Bank' ? 700 : 500,
                                                    fontSize: '0.74rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🏦 Bank ({stats.daily_bank?.count || 0})
                                            </button>
                                        </div>

                                        {/* Search */}
                                        <input
                                            type="text"
                                            placeholder="Search student or GR#…"
                                            value={tableSearch}
                                            onChange={e => setTableSearch(e.target.value)}
                                            style={{
                                                padding: '0.35rem 0.75rem',
                                                fontSize: '0.78rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                background: 'var(--bg-input, #fff)',
                                                width: 175
                                            }}
                                        />
                                    </div>
                                </div>

                                {filteredDailyRecords.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📭</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            No Collections Found on {formattedSelectedDate}
                                        </div>
                                        <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>
                                            No fee records were marked as cleared on this date. Select another date using the date controls above.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>#</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>Student Name</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>Parent Name</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>GR No.</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Class</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Fee Month</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>Amount</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Method</th>
                                                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Cleared At</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredDailyRecords.map((r, i) => {
                                                    const isCash = (r.payment_method || '').toLowerCase() === 'cash'
                                                    return (
                                                        <tr
                                                            key={r.id}
                                                            style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)' }}>{i + 1}</td>
                                                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                {r.student_name}
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>
                                                                {r.parent_name || '—'}
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                                                {r.gr_number || '—'}
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                                                <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', fontSize: '0.74rem', fontWeight: 600 }}>
                                                                    {r.class_applied_for || '—'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 500 }}>
                                                                {r.fee_month}
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: isCash ? '#15803d' : '#1d4ed8' }}>
                                                                {formatCurrency(r.amount_due)}
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '3px 10px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 700,
                                                                    background: isCash ? '#dcfce7' : '#dbeafe',
                                                                    color: isCash ? '#15803d' : '#1d4ed8',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem'
                                                                }}>
                                                                    {isCash ? '💵 Cash' : '🏦 Bank'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                                {r.cleared_at || '—'}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

    );
});
