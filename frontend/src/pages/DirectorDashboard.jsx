import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import api from '../api/client'

const formatCurrency = (val) =>
    `Rs. ${Number(val || 0).toLocaleString('en-PK')}`

function KpiCard({ icon, label, value, sub, color = 'var(--brand-red)' }) {
    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem 2rem',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            transition: 'transform 0.15s, box-shadow 0.15s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(139,26,26,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)' }}
        >
            <div style={{ fontSize: '2rem' }}>{icon}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
    )
}

export default function DirectorDashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadStats()
    }, [])

    async function loadStats() {
        try {
            setLoading(true)
            const { data } = await api.get('/director/stats')
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
        }
    }

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    return (
        <div style={{ padding: '2rem 2.5rem', minHeight: '100vh', background: 'var(--bg-base)' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem', borderBottom: '2px solid var(--border)', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--brand-red-dark), var(--brand-red))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', flexShrink: 0
                    }}>👔</div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            Director's Dashboard
                        </h1>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.2rem' }}>
                            Bara Kahu Campus · {today}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                    Loading financial overview…
                </div>
            ) : stats ? (
                <>
                    {/* Section: Student Summary */}
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        📊 Student Overview
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <KpiCard icon="🧑‍🎓" label="Total Registered" value={stats.total_students} color="var(--text-primary)" />
                        <KpiCard icon="✅" label="Total Admitted" value={stats.total_admitted} color="var(--green)" />
                    </div>

                    {/* Section: Financial Summary */}
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        💰 Financial Overview
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <KpiCard
                            icon="📅"
                            label="Total Monthly Fee Income"
                            value={formatCurrency(stats.total_monthly_fee)}
                            sub="Net of all discounts"
                            color="var(--brand-red)"
                        />
                        <KpiCard
                            icon="📈"
                            label="Projected Annual Income"
                            value={formatCurrency(stats.projected_annual_fee)}
                            sub="Monthly × 12"
                            color="var(--brand-red-dark)"
                        />
                        <KpiCard
                            icon="🏦"
                            label="Admission Fees Collected"
                            value={formatCurrency(stats.total_collected)}
                            sub="From admission challans"
                            color="var(--gold)"
                        />
                        <KpiCard
                            icon="🔒"
                            label="Security Fee Collected"
                            value={formatCurrency(stats.total_security)}
                            sub="Refundable security deposits"
                            color="var(--blue)"
                        />
                    </div>

                    {/* Note */}
                    <div style={{
                        background: 'var(--brand-red-pale)', border: '1px solid rgba(207,46,46,0.2)',
                        borderRadius: 'var(--radius)', padding: '0.875rem 1.25rem',
                        fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '1rem'
                    }}>
                        ℹ️ Financial figures are calculated from saved Admission Fee Challans. Monthly fees reflect net amounts after scholarships and discounts. Data updates automatically as challans are saved and new admissions are processed.
                    </div>
                </>
            ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '5rem' }}>No data available.</div>
            )}
        </div>
    )
}
