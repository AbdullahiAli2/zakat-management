import { formatCurrency } from "@/lib/currency";

export type PrintableTransaction = {
  id: number;
  date: string | Date;
  amount: number;
  type: "ZAKAT_PAYMENT" | "DISTRIBUTION" | "DEPOSIT";
  status: "PENDING" | "SUCCESS" | "FAILED" | string;
  reference: string | null;
  method: string | null;
  beneficiaryCategory: "ORPHAN" | "POOR" | "EMERGENCY" | null;
  user?: { name: string | null; email: string | null };
};

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildTransactionHtml(t: PrintableTransaction) {
  const date = new Date(t.date).toLocaleString();
  const amount = formatCurrency(t.amount);
  const typeLabel = t.type === "ZAKAT_PAYMENT" ? "Zakat Payment" : t.type === "DISTRIBUTION" ? "Distribution" : "Deposit";
  const showDonor = t.type === "ZAKAT_PAYMENT";

  const statusColor =
    t.status === "SUCCESS"
      ? "background:#dcfce7;color:#166534;border-color:rgba(22,101,52,.15)"
      : t.status === "PENDING"
        ? "background:#fef3c7;color:#92400e;border-color:rgba(146,64,14,.15)"
        : "background:#fee2e2;color:#991b1b;border-color:rgba(153,27,27,.15)";

  const typeColor =
    t.type === "ZAKAT_PAYMENT"
      ? "background:#e0f2fe;color:#075985;border-color:rgba(7,89,133,.15)"
      : t.type === "DISTRIBUTION"
        ? "background:#fef3c7;color:#92400e;border-color:rgba(146,64,14,.15)"
        : "background:#e0e7ff;color:#3730a3;border-color:rgba(55,48,163,.15)";

  const metaLine =
    t.type === "ZAKAT_PAYMENT"
      ? `Method: ${t.method ?? "-"}`
      : t.type === "DISTRIBUTION"
        ? `Category: ${t.beneficiaryCategory ?? "-"}`
        : `Method: ${t.method ?? "-"}`;

  return `
  <html>
    <head>
      <title>Transaction Statement ${esc(t.id)}</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root{
          --bg:#f6f8f6;
          --card:#ffffff;
          --ink:#0f172a;
          --muted:#64748b;
          --green:#065F46;
          --border:rgba(15,23,42,.08);
          --shadow: 0 18px 45px rgba(2,6,23,.10);
        }
        *{box-sizing:border-box}
        body{
          margin:0;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
          background: var(--bg);
          color: var(--ink);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .top{
          background: #fff;
          border-bottom:1px solid var(--border);
          padding: 18px 18px;
          display:flex;
          justify-content:center;
        }
        .top .inner{
          width:100%;
          max-width: 980px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
        }
        .brand{
          font-weight: 900;
          letter-spacing:.12em;
          text-transform: uppercase;
          color: var(--green);
          font-size: 12px;
        }
        .right{
          display:flex;
          gap: 10px;
          align-items:center;
          color: rgba(15,23,42,.65);
          font-size: 12px;
          font-weight: 800;
        }
        .pill{
          border:1px solid rgba(6,95,70,.22);
          background: rgba(6,95,70,.06);
          padding:8px 12px;
          border-radius: 999px;
          color: var(--green);
          font-weight: 900;
        }
        .wrap{
          padding: 18px 18px 36px;
          display:flex;
          justify-content:center;
        }
        .sheet{
          width:100%;
          max-width: 980px;
          background: var(--card);
          border:1px solid var(--border);
          border-radius: 22px;
          box-shadow: var(--shadow);
          overflow:hidden;
        }
        .hero{
          padding: 22px 24px;
          border-bottom:1px solid var(--border);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 16px;
        }
        .hero h1{
          margin:0;
          font-size: 26px;
          color: var(--green);
          font-weight: 950;
        }
        .hero p{
          margin:6px 0 0;
          color: var(--muted);
          font-size: 13px;
        }
        .tags{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .tag{
          border:1px solid var(--border);
          padding: 8px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          background:#fff;
          color: rgba(15,23,42,.78);
        }
        .tag.status{ ${statusColor}; }
        .tag.type{ ${typeColor}; }
        .summary{
          padding: 18px 24px;
          display:grid;
          grid-template-columns: 1.1fr .9fr .9fr;
          gap: 12px;
        }
        .box{
          border:1px solid var(--border);
          border-radius: 16px;
          padding: 14px 14px 12px;
          background:#fff;
        }
        .k{ font-size: 11px; letter-spacing:.12em; text-transform: uppercase; color: rgba(15,23,42,.5); font-weight:900; }
        .v{ margin-top: 8px; font-size: 22px; font-weight: 950; color: rgba(15,23,42,.92); }
        .grid{
          padding: 0 24px 18px;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .row{
          display:flex;
          justify-content:space-between;
          gap: 12px;
          padding: 8px 0;
          border-top: 1px dashed rgba(15,23,42,.10);
        }
        .row:first-of-type{ border-top:none; padding-top:0; }
        .lbl{ color: rgba(15,23,42,.55); font-size: 11px; letter-spacing:.08em; text-transform: uppercase; font-weight:900; }
        .val{ color: rgba(15,23,42,.92); font-size: 13px; font-weight: 900; text-align:right; }
        .footer{
          padding: 10px 24px 20px;
          border-top:1px solid var(--border);
          display:flex;
          justify-content:space-between;
          gap: 12px;
          color: rgba(15,23,42,.55);
          font-size: 11px;
        }
        @media (max-width: 860px){
          .summary{ grid-template-columns: 1fr; }
          .grid{ grid-template-columns: 1fr; }
          .tags{ justify-content:flex-start; }
        }
        @media print{
          body{ background:#fff; }
          .top{ display:none; }
          .wrap{ padding: 0; }
          .sheet{ border:none; box-shadow:none; border-radius:0; }
        }
      </style>
    </head>
    <body>
      <div class="top">
        <div class="inner">
          <div class="brand">ONLINE ZAKAT MANAGEMENT SYSTEM</div>
          <div class="right">
            <div>STATEMENT ID: <strong>TX-${esc(t.id)}</strong></div>
            <div class="pill">System Generated</div>
          </div>
        </div>
      </div>

      <div class="wrap">
        <div class="sheet">
          <div class="hero">
            <div>
              <h1>Transaction Statement</h1>
              <p>${esc(typeLabel)} • ${esc(metaLine)} • Ref: ${esc(t.reference ?? "-")}</p>
            </div>
            <div class="tags">
              <div class="tag type">${esc(t.type)}</div>
              <div class="tag status">${esc(t.status)}</div>
            </div>
          </div>

          <div class="summary">
            <div class="box">
              <div class="k">Amount</div>
              <div class="v">${esc(amount)}</div>
            </div>
            <div class="box">
              <div class="k">Date</div>
              <div class="v" style="font-size:16px;">${esc(date)}</div>
            </div>
            <div class="box">
              <div class="k">Type</div>
              <div class="v" style="font-size:16px;">${esc(typeLabel)}</div>
            </div>
          </div>

          <div class="grid">
            ${
              showDonor
                ? `<div class="box">
                    <div class="k">Donor Information</div>
                    <div class="row"><div class="lbl">Full Name</div><div class="val">${esc(t.user?.name ?? "-")}</div></div>
                    <div class="row"><div class="lbl">Email</div><div class="val">${esc(t.user?.email ?? "-")}</div></div>
                  </div>`
                : `<div class="box">
                    <div class="k">System Info</div>
                    <div class="row"><div class="lbl">Generated By</div><div class="val">Admin / System</div></div>
                    <div class="row"><div class="lbl">Purpose</div><div class="val">${esc(typeLabel)}</div></div>
                  </div>`
            }
            <div class="box">
              <div class="k">Details</div>
              <div class="row"><div class="lbl">Transaction ID</div><div class="val">#${esc(t.id)}</div></div>
              <div class="row"><div class="lbl">Reference</div><div class="val">${esc(t.reference ?? "-")}</div></div>
              <div class="row"><div class="lbl">Status</div><div class="val">${esc(t.status)}</div></div>
              <div class="row"><div class="lbl">${t.type === "DISTRIBUTION" ? "Category" : "Method"}</div><div class="val">${esc(t.type === "DISTRIBUTION" ? (t.beneficiaryCategory ?? "-") : (t.method ?? "-"))}</div></div>
            </div>
          </div>

          <div class="footer">
            <div>This statement is system-generated and reflects the actual transaction state.</div>
            <div>Printed: ${esc(new Date().toLocaleString())}</div>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
}

