import React from 'react'

const fmtRs = (v) => {
    if (v === null || v === undefined || v === '') return '—'
    const num = Number(v)
    if (isNaN(num) || num === 0) return '—'
    return `Rs.\xA0${num}`
}

export default function MonthlyChallanPrint({ studentsData }) {
    return (
        <div className="mcp-root">
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 6mm; }
                    html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; background: white; }
                    body * { visibility: hidden !important; }
                    .mcp-root, .mcp-root * { visibility: visible !important; }
                    .mcp-root { position: absolute; left: 0; top: 0; width: 100%; }
                }

                .mcp-root {
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 9px;
                    color: #000;
                    background: #fff;
                }

                /* Each student = one row = one landscape A4 page */
                .mcp-student-page {
                    display: flex;
                    flex-direction: row;
                    gap: 4mm;
                    width: 100%;
                    box-sizing: border-box;
                    page-break-after: always;
                    page-break-inside: avoid;
                    height: 190mm; /* A4 landscape height minus margins */
                    align-items: stretch;
                }

                /* Each copy takes exactly 1/3 of the page width */
                .mcp-copy {
                    flex: 1;
                    border: 1px solid #333;
                    box-sizing: border-box;
                    padding: 5px 7px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                /* Vertical dashed divider between copies */
                .mcp-divider {
                    width: 0;
                    border-left: 1px dashed #888;
                    margin: 0;
                    flex-shrink: 0;
                }

                /* Header */
                .mcp-hdr {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    border-bottom: 1.5px solid #333;
                    padding-bottom: 4px;
                    margin-bottom: 4px;
                }
                .mcp-logo { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
                .mcp-school { flex: 1; text-align: center; }
                .mcp-school-name { font-size: 11px; font-weight: 800; font-style: italic; line-height: 1.2; }
                .mcp-campus { font-size: 8px; }
                .mcp-copy-label { text-align: right; font-size: 8px; font-weight: 700; color: #555; min-width: 60px; }

                /* Receipt tag */
                .mcp-tag {
                    text-align: center;
                    background: #222;
                    color: #fff;
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    padding: 2px 6px;
                    margin: 3px 0;
                }

                /* Student Info rows */
                .mcp-row {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 2px;
                    align-items: flex-end;
                    font-size: 8.5px;
                }
                .mcp-label { color: #444; white-space: nowrap; flex-shrink: 0; }
                .mcp-val {
                    border-bottom: 1px solid #555;
                    min-width: 50px;
                    flex: 1;
                    font-weight: 600;
                    padding: 0 2px;
                    font-size: 8.5px;
                }

                /* Fee Table */
                .mcp-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 4px;
                    font-size: 8.5px;
                }
                .mcp-table th, .mcp-table td {
                    border: 1px solid #444;
                    padding: 2px 4px;
                }
                .mcp-table th {
                    background: #eee;
                    font-weight: 700;
                }
                .mcp-table td:last-child {
                    text-align: right;
                    font-weight: 600;
                    min-width: 50px;
                }

                /* Bank details */
                .mcp-bank {
                    margin-top: 4px;
                    font-size: 7.5px;
                    line-height: 1.5;
                    border-top: 1px solid #bbb;
                    padding-top: 3px;
                }
                .mcp-notes {
                    margin-top: 3px;
                    font-size: 7px;
                    color: #555;
                    border-top: 1px solid #ddd;
                    padding-top: 2px;
                    line-height: 1.4;
                }
            `}</style>

            {studentsData.map((data, idx) => {
                const monthly = Number(data.monthlyFee) || 0
                const fine = Number(data.fine) || 0
                const otherDues = Number(data.otherDues) || 0
                const arrears = Number(data.arrears) || 0
                const total = monthly + fine + otherDues + arrears

                const copies = ['Bank Copy', 'School Copy', 'Student Copy']

                return (
                    <div key={idx} className="mcp-student-page">
                        {copies.map((copyLabel, ci) => (
                            <React.Fragment key={copyLabel}>
                                <div className="mcp-copy">
                                    {/* Header */}
                                    <div className="mcp-hdr">
                                        <img src="/tss-logo.png" className="mcp-logo" alt="TSS" />
                                        <div className="mcp-school">
                                            <div className="mcp-school-name">The Smart School</div>
                                            <div className="mcp-campus">Bara Kahu Campus, Islamabad</div>
                                            <div className="mcp-campus">051-2322122</div>
                                        </div>
                                        <div className="mcp-copy-label">{copyLabel}</div>
                                    </div>

                                    <div className="mcp-tag">FEE CHALLAN</div>

                                    {/* Student Info */}
                                    <div className="mcp-row">
                                        <span className="mcp-label">Issue Date:</span>
                                        <span className="mcp-val">{data.issueDate}</span>
                                        <span className="mcp-label">Due Date:</span>
                                        <span className="mcp-val">{data.dueDate}</span>
                                    </div>
                                    <div className="mcp-row">
                                        <span className="mcp-label">Fee for Month of:</span>
                                        <span className="mcp-val">{data.monthOf}</span>
                                    </div>
                                    <div className="mcp-row">
                                        <span className="mcp-label">Student Name:</span>
                                        <span className="mcp-val">{data.student.name}</span>
                                    </div>
                                    <div className="mcp-row">
                                        <span className="mcp-label">Roll #:</span>
                                        <span className="mcp-val">{data.student.gr_number || '—'}</span>
                                        <span className="mcp-label">Class:</span>
                                        <span className="mcp-val">{data.student.class_applied_for}</span>
                                    </div>

                                    {/* Fee Table */}
                                    <table className="mcp-table">
                                        <thead>
                                            <tr>
                                                <th>Description</th>
                                                <th>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td>Tuition Fee</td><td>{fmtRs(monthly)}</td></tr>
                                            <tr><td>Fine</td><td>{fmtRs(fine)}</td></tr>
                                            {otherDues > 0 && <tr><td>Other Dues</td><td>{fmtRs(otherDues)}</td></tr>}
                                            {arrears > 0 && <tr><td style={{ color: 'var(--brand-red)' }}>Previous Arrears</td><td>{fmtRs(arrears)}</td></tr>}
                                            <tr><td style={{ fontWeight: 700 }}>Total</td><td>{fmtRs(total)}</td></tr>
                                            <tr><td style={{ fontWeight: 700 }}>Pay By Due Date</td><td>{fmtRs(total)}</td></tr>
                                        </tbody>
                                    </table>

                                    {/* Bank Details */}
                                    <div className="mcp-bank">
                                        <strong>Payment Terms:</strong><br />
                                        Collection Account: 6010184834000013<br />
                                        Branch Code: 0274<br />
                                        Account: The Smart School Murree Road Bhara Kahu<br />
                                        <em>Branch: Bank of Punjab, Main Murree Road, Barakahu</em>
                                    </div>

                                    <div className="mcp-notes">
                                        A fine of Rs. 50/- per day will be charged after due date.<br />
                                        Editing this challan is strictly prohibited.<br />
                                        <em>System generated — no signature required.</em>
                                    </div>
                                </div>
                                {ci < 2 && <div className="mcp-divider" />}
                            </React.Fragment>
                        ))}
                    </div>
                )
            })}
        </div>
    )
}
