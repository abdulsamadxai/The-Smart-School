import React from 'react'

const fmtRs = (v) => (v !== undefined && v !== null && v !== '') ? `Rs.\xA0${v}` : ''

export default function ReceiptPrint({ form }) {
    const d = new Date()
    const dateStr = d.toLocaleDateString('en-GB').split('/').join('-')
    const receiptNo = `SS-${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
    const balance = (Number(form.totalFee) || 0) - (Number(form.amountPaid) || 0)

    const copyBlock = (label) => (
        <div className="r-receipt">
            <div className="r-header">
                <img src="/tss-logo.png" alt="The Smart School" className="r-logo-img" />
                <div className="r-school-title">
                    <div className="r-school-name">The Smart School</div>
                    <div className="r-campus">Bara Kahu Campus Islamabad</div>
                    <div className="r-phone">051-2322122</div>
                    <div className="r-tag">ADMISSION RECEIPT</div>
                </div>
                <div className="r-info">
                    {label}<br />
                    <span className="r-dated">Dated: <b>{dateStr}</b></span><br />
                    <span className="r-receiptno">Receipt#: <b>{receiptNo}</b></span>
                </div>
            </div>

            <div className="r-row two">
                <Field lbl="Student Name:" val={form.studentName} />
                <Field lbl="Father Name:" val={form.fatherName} />
            </div>
            <div className="r-row two">
                <Field lbl="Class:" val={form.className} />
                <Field lbl="Total Fee:" val={fmtRs(form.totalFee)} />
            </div>
            <div className="r-row two">
                <Field lbl="Monthly Fee" val={fmtRs(form.monthlyFee)} />
                <Field lbl="Admission Fee" val={fmtRs(form.admissionFee)} />
            </div>
            <div className="r-row three">
                <Field lbl="Security Fee" val={fmtRs(form.security)} />
                <Field lbl="Annual Fee" val={fmtRs(form.annualFee)} />
                <Field lbl="Other Dues" val={fmtRs(form.otherDues)} />
            </div>
            <div className="r-row one">
                <Field lbl="Parents Contact #:" val={form.parentsContact} />
            </div>
            <div className="r-row two">
                <Field lbl="Amount Paid:" val={fmtRs(form.amountPaid)} />
                <Field lbl="Balance:" val={fmtRs(balance)} />
            </div>

            <div className="r-sign-row">
                <div className="r-sign">Admin &amp; Account Officer Signature</div>
                <div className="r-sign">Parents Signature</div>
            </div>
        </div>
    )

    return (
        <div className="receipt-container print-mode">
            <style>{`
            @media print {
              @page { size: A4 portrait; margin: 0; }
              html, body { margin: 0 !important; padding: 0 !important; height: 100vh !important; overflow: hidden !important; background: white; }
              body * { visibility: hidden !important; }
              .print-mode, .print-mode * { visibility: visible !important; }
              .print-mode { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; padding: 10mm; box-sizing: border-box; overflow: hidden; page-break-after: avoid; }
            }
            
            /* The base container */
            .receipt-container { color: #111; font-family: Georgia, 'Times New Roman', serif; background: white; width: 100%; }
            .r-receipt { padding: 14px 18px; box-sizing: border-box; }
            .r-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 14px; }
              .r-logo-img { width: 90px; object-fit: contain; margin-right: 15px; }
              .r-school-title { flex: 1; text-align: center; }
              .r-school-name { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; font-style: italic; }
              .r-campus { text-decoration: underline; font-size: 15px; margin-top: 2px; }
              .r-phone { font-size: 12px; margin-top: 1px; }
              .r-tag { display: inline-block; background: #333; color: #fff; padding: 2px 14px; margin-top: 4px; letter-spacing: 1px; font-size: 13px; font-weight: bold; }
              .r-info { font-weight: bold; font-size: 15px; text-align: right; min-width: 150px; }
              .r-dated, .r-receiptno { font-weight: normal; font-size: 12px; }
              
              .r-row { display: flex; gap: 14px; margin-bottom: 10px; }
              .r-row.one .r-field { flex: 1 1 100%; }
              .r-row.two .r-field { flex: 1 1 48%; }
              .r-row.three .r-field { flex: 1 1 48%; }
              
              .r-field { display: flex; align-items: flex-end; gap: 6px; font-size: 14px; }
              .r-label { white-space: nowrap; font-weight: 500; }
              .r-line { flex: 1; border-bottom: 1px solid #777; min-height: 18px; padding-left: 4px; font-family: monospace; font-size: 15px; }
              
              .r-sign-row { display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; margin-bottom: 10px; }
              .r-sign { border-top: 1px solid #333; padding-top: 6px; width: 40%; text-align: center; font-style: italic; }
              
              .r-cut { border-top: 1px dashed #777; margin: 15px 0; text-align: center; font-size: 10px; letter-spacing: 4px; color: #555; position: relative; }
              .r-cut span { background: white; padding: 0 10px; position: relative; top: -7px; }
          `}</style>

            {copyBlock('Parent Copy')}
            <div className="r-cut"><span>✂ CUT HERE</span></div>
            {copyBlock('School Copy')}
        </div>
    )
}

function Field({ lbl, val }) {
    return (
        <div className="r-field">
            <span className="r-label">{lbl}</span>
            <span className="r-line">{val || ''}</span>
        </div>
    )
}
