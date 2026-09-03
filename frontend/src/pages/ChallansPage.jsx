import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { getStudents } from '../api/client'
import api from '../api/client'
import ReceiptPrint from '../components/ReceiptPrint'
import styles from './ChallansPage.module.css'

// Helper: format Rs.
const fmt = (n) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`

export default function ChallansPage() {
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)

    const [form, setForm] = useState({
        studentId: '',
        studentName: '',
        fatherName: '',
        className: '',
        parentsContact: '',
        motherContact: '',
        // ---- Fee fields ----
        monthlyFee: '',
        scholarshipPct: '0',        // % waiver on monthly fee
        siblingDiscountPct: '0',    // % sibling discount on monthly fee
        orphanDiscountPct: '0',     // % orphan discount on monthly fee
        admissionFee: '',
        admissionScholarshipPct: '0', // % waiver on admission fee
        security: '',
        securityScholarshipPct: '0', // % waiver on security fee
        annualFee: '',              // FIXED – no scholarship
        otherDues: '',
        amountPaid: '',
    })

    useEffect(() => {
        async function fetchAdmitted() {
            try {
                const res = await getStudents()
                setStudents(res.data.filter(s => s.stage === 'admitted'))
            } catch {
                toast.error('Failed to load students')
            } finally {
                setLoading(false)
            }
        }
        fetchAdmitted()
    }, [])

    function handleSelectStudent(e) {
        const id = e.target.value
        if (!id) {
            setForm(f => ({ ...f, studentId: '', studentName: '', fatherName: '', className: '', parentsContact: '', motherContact: '' }))
            return
        }
        const s = students.find(x => x.id.toString() === id)
        if (s) {
            setForm(f => ({
                ...f,
                studentId: s.id,
                studentName: s.name,
                fatherName: s.parent_name || '—',
                className: s.class_applied_for,
                parentsContact: s.father_contact_number || '',
                motherContact: s.mother_contact_number || '',

                // Pre-fill previously saved challan data if exists
                monthlyFee: s.challan_monthly_fee ?? '',
                scholarshipPct: s.challan_scholarship_pct ?? '0',
                siblingDiscountPct: s.challan_sibling_discount_pct ?? '0',
                orphanDiscountPct: s.challan_orphan_discount_pct ?? '0',
                admissionFee: s.challan_admission_fee ?? '',
                admissionScholarshipPct: s.challan_admission_scholarship_pct ?? '0',
                security: s.challan_security ?? '',
                securityScholarshipPct: s.challan_security_scholarship_pct ?? '0',
                annualFee: s.challan_annual_fee ?? '',
                otherDues: s.challan_other_dues ?? '',
                amountPaid: s.challan_amount_paid ?? '',
            }))
        }
    }

    function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

    // ---- Computed values ----
    const calc = useMemo(() => {
        const monthly = Number(form.monthlyFee) || 0
        const scholarshipWaiver = monthly * (Number(form.scholarshipPct) / 100)
        const siblingWaiver = monthly * (Number(form.siblingDiscountPct) / 100)
        const orphanWaiver = monthly * (Number(form.orphanDiscountPct) / 100)
        const monthlyAfterWaiver = Math.max(0, monthly - scholarshipWaiver - siblingWaiver - orphanWaiver)

        const admission = Number(form.admissionFee) || 0
        const admissionWaiver = admission * (Number(form.admissionScholarshipPct) / 100)
        const admissionAfterWaiver = Math.max(0, admission - admissionWaiver)

        const security = Number(form.security) || 0
        const securityWaiver = security * (Number(form.securityScholarshipPct) / 100)
        const securityAfterWaiver = Math.max(0, security - securityWaiver)

        const annual = Number(form.annualFee) || 0   // fixed
        const other = Number(form.otherDues) || 0

        const totalWaivers = scholarshipWaiver + siblingWaiver + orphanWaiver + admissionWaiver + securityWaiver
        const totalFee = monthlyAfterWaiver + admissionAfterWaiver + securityAfterWaiver + annual + other
        const amountPaid = Number(form.amountPaid) || 0
        const balance = totalFee - amountPaid

        return {
            monthly, scholarshipWaiver, siblingWaiver, orphanWaiver,
            monthlyAfterWaiver,
            admission, admissionWaiver, admissionAfterWaiver,
            security, securityWaiver, securityAfterWaiver,
            annual, other,
            totalWaivers, totalFee, amountPaid, balance
        }
    }, [form])

    async function handlePrint() {
        if (!form.studentId) return toast.error('Please select a student first')

        // Auto-save challan data to database before printing
        const savePromise = api.patch(`/students/${form.studentId}/save-challan`, {
            monthly_fee: calc.monthly,
            scholarship_pct: Number(form.scholarshipPct),
            sibling_discount_pct: Number(form.siblingDiscountPct),
            orphan_discount_pct: Number(form.orphanDiscountPct),
            admission_fee: calc.admission,
            admission_scholarship_pct: Number(form.admissionScholarshipPct),
            security: calc.security,
            security_scholarship_pct: Number(form.securityScholarshipPct),
            annual_fee: calc.annual,
            other_dues: calc.other,
            amount_paid: calc.amountPaid,
        });

        toast.promise(savePromise, {
            loading: 'Saving challan details...',
            success: 'Saved successfully!',
            error: 'Failed to save! Check console.'
        })

        try {
            const result = await savePromise;

            // Re-update the local list of students with the new fields returned from save-challan
            setStudents(prev => prev.map(st => st.id === form.studentId ? { ...st, ...result.data } : st))

            // Auto-confirm joining when challan is printed
            // This marks the student as 'Joined' automatically upon receipt printing
            try {
                await api.patch(`/students/${form.studentId}/confirm-joining`, {
                    joined: true,
                    not_joined_reason: null
                })
            } catch (joinErr) {
                // Non-blocking — student may already be joined, or it's a non-admitted stage
                console.warn('Auto join skipped:', joinErr?.response?.data?.detail)
            }

            // Delay print slightly to allow toast to render & avoid cancelling network requests in some browsers
            setTimeout(() => {
                window.print()
            }, 500)
        } catch (error) {
            console.error("Save Challan Error:", error)
            // Still allow them to print even if save fails, after a timeout
            setTimeout(() => {
                window.print()
            }, 500)
        }
    }

    if (loading) return <div style={{ padding: '2rem' }}><div className="spinner" /> Loading...</div>

    const pctOptions = [0, 5, 10, 15, 20, 25, 30, 33, 40, 50, 60, 70, 75, 80, 90, 100]

    // Build print-ready form data
    const printForm = {
        ...form,
        totalFee: calc.totalFee,
        amountPaid: calc.amountPaid,
        monthlyFee: calc.monthlyAfterWaiver,
        admissionFee: calc.admissionAfterWaiver,
        security: calc.securityAfterWaiver,
        annualFee: calc.annual,
        otherDues: calc.other,
        balance: calc.balance,
    }

    return (
        <div className={styles.page}>
            <div className="no-print">
                <div className={styles.header}>
                    <h1 className={styles.title}>Admission Fee Challan</h1>
                    <p className={styles.subtitle}>Generate and print admission fee receipts for admitted students.</p>
                </div>

                <div className={styles.layout}>
                    {/* ---- Entry Form ---- */}
                    <div className={styles.formCard}>
                        <h2 className={styles.sectionTitle}>Challan Details</h2>

                        <div className={styles.formGroup}>
                            <label>Select Admitted Student</label>
                            <select value={form.studentId} onChange={handleSelectStudent}>
                                <option value="">-- Choose a student --</option>
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.gr_number || 'No GR'} — {s.class_applied_for})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {form.studentId && (<>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Student Name</label>
                                    <input value={form.studentName} onChange={e => update('studentName', e.target.value)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Father/Guardian Name</label>
                                    <input value={form.fatherName} onChange={e => update('fatherName', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Class</label>
                                    <input value={form.className} onChange={e => update('className', e.target.value)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Father Contact #</label>
                                    <input value={form.parentsContact} onChange={e => update('parentsContact', e.target.value)} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Mother Contact #</label>
                                    <input value={form.motherContact} onChange={e => update('motherContact', e.target.value)} />
                                </div>
                            </div>

                            {/* ===================== FEE BREAKDOWN ===================== */}
                            <h2 className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>Fee Breakdown (Rs.)</h2>

                            {/* ------- Monthly Fee + Discounts ------- */}
                            <div className={styles.feeBlock}>
                                <div className={styles.feeBlockTitle}>Monthly Fee</div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Monthly Fee (Rs.)</label>
                                        <input type="number" min="0" value={form.monthlyFee} onChange={e => update('monthlyFee', e.target.value)} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Scholarship % Waiver</label>
                                        <select value={form.scholarshipPct} onChange={e => update('scholarshipPct', e.target.value)}>
                                            {pctOptions.map(p => <option key={p} value={p}>{p}%{p > 0 ? ` (−${fmt(calc.monthly * p / 100)})` : ' — None'}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Sibling Discount %</label>
                                        <select value={form.siblingDiscountPct} onChange={e => update('siblingDiscountPct', e.target.value)}>
                                            {pctOptions.map(p => <option key={p} value={p}>{p}%{p > 0 ? ` (−${fmt(calc.monthly * p / 100)})` : ' — None'}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Orphan Discount %</label>
                                        <select value={form.orphanDiscountPct} onChange={e => update('orphanDiscountPct', e.target.value)}>
                                            {pctOptions.map(p => <option key={p} value={p}>{p}%{p > 0 ? ` (−${fmt(calc.monthly * p / 100)})` : ' — None'}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <div></div>
                                    <div className={styles.formGroup}>
                                        <label>Monthly After Waivers</label>
                                        <div className={styles.calcResult}>{fmt(calc.monthlyAfterWaiver)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* ------- Admission Fee ------- */}
                            <div className={styles.feeBlock}>
                                <div className={styles.feeBlockTitle}>Admission Fee</div>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Admission Fee (Rs.)</label>
                                        <input type="number" min="0" value={form.admissionFee} onChange={e => update('admissionFee', e.target.value)} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Scholarship % Waiver</label>
                                        <select value={form.admissionScholarshipPct} onChange={e => update('admissionScholarshipPct', e.target.value)}>
                                            {pctOptions.map(p => <option key={p} value={p}>{p}%{p > 0 ? ` (−${fmt(calc.admission * p / 100)})` : ' — None'}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {calc.admissionWaiver > 0 && (
                                    <div className={styles.waiverNote}>Waiver applied: −{fmt(calc.admissionWaiver)}</div>
                                )}
                            </div>

                            {/* ------- Security Fee ------- */}
                            <div className={styles.feeBlock}>
                                <div className={styles.feeBlockTitle}>Security Fee</div>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Security Fee (Rs.)</label>
                                        <input type="number" min="0" value={form.security} onChange={e => update('security', e.target.value)} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Scholarship % Waiver</label>
                                        <select value={form.securityScholarshipPct} onChange={e => update('securityScholarshipPct', e.target.value)}>
                                            {pctOptions.map(p => <option key={p} value={p}>{p}%{p > 0 ? ` (−${fmt(calc.security * p / 100)})` : ' — None'}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {calc.securityWaiver > 0 && (
                                    <div className={styles.waiverNote}>Waiver applied: −{fmt(calc.securityWaiver)}</div>
                                )}
                            </div>

                            {/* ------- Fixed Fees ------- */}
                            <div className={styles.feeBlock}>
                                <div className={styles.feeBlockTitle}>Fixed Fees <span className={styles.fixedTag}>No scholarship applicable</span></div>
                                <div className={styles.formRow}>
                                    <div className={styles.formGroup}>
                                        <label>Annual Fee (Rs.) — Fixed</label>
                                        <input type="number" min="0" value={form.annualFee} onChange={e => update('annualFee', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* ------- Other Dues ------- */}
                            <div className={styles.formGroup}>
                                <label>Other Dues (Rs.)</label>
                                <input type="number" min="0" value={form.otherDues} onChange={e => update('otherDues', e.target.value)} />
                            </div>

                            {/* ------- Summary ------- */}
                            <div className={styles.feeSummary}>
                                <div className={styles.summaryRow}>
                                    <span>Total Waivers / Scholarships</span>
                                    <span className={styles.discountAmt}>−{fmt(calc.totalWaivers)}</span>
                                </div>
                                <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                    <span>Total Fee Payable</span>
                                    <span className={styles.totalAmt}>{fmt(calc.totalFee)}</span>
                                </div>
                                <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                                    <label>Amount Paid (Rs.)</label>
                                    <input type="number" min="0" value={form.amountPaid} onChange={e => update('amountPaid', e.target.value)} />
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>Balance Remaining</span>
                                    <span className={calc.balance > 0 ? styles.balanceOwed : styles.balancePaid}>{fmt(calc.balance)}</span>
                                </div>
                            </div>

                            <div className={styles.printBtnWrap}>
                                <button className="btn btn-primary" onClick={handlePrint}>🖨️ Print Receipt</button>
                            </div>
                        </>)}
                    </div>

                    {/* ---- Preview ---- */}
                    <div>
                        {!form.studentId ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem' }}>
                                Select a student to see the preview.
                            </div>
                        ) : (
                            <div className={styles.printPreview}>
                                <ReceiptPrint form={printForm} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden Printable Area */}
            <div className="print-mode" style={{ display: 'none' }}>
                <ReceiptPrint form={printForm} />
            </div>
            <style>{`
                @media print { 
                    .no-print { display: none !important; }
                    .print-mode { display: block !important; } 
                }
            `}</style>
        </div>
    )
}
