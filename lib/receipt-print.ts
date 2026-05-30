import { formatCurrency } from "@/lib/currency";

export type PrintableReceipt = {
  receiptNumber: string;
  generatedAt: string | Date;
  transactionId: number;
  transaction: {
    amount: number;
    type: "ZAKAT_PAYMENT" | "DISTRIBUTION";
    method?: string | null;
    beneficiaryCategory?: "ORPHAN" | "POOR" | "EMERGENCY" | null;
  };
  user?: { name: string | null; email?: string | null };
};

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildReceiptHtml(input: PrintableReceipt) {
  const typeLabel = input.transaction.type === "ZAKAT_PAYMENT" ? "Donor Zakat Payment" : "Distribution";
  const metaLine =
    input.transaction.type === "ZAKAT_PAYMENT"
      ? `Method: <strong>${esc(input.transaction.method ?? "-")}</strong>`
      : `Category: <strong>${esc(input.transaction.beneficiaryCategory ?? "-")}</strong>`;

  const donorName = input.user?.name ?? "-";
  const donorEmail = input.user?.email ?? "-";
  const generated = new Date(input.generatedAt).toLocaleString();

  const amount = formatCurrency(input.transaction.amount);

  return `
  <html>
    <head>
      <title>Receipt ${esc(input.receiptNumber)}</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root{
          --bg:#f3f6f4;
          --card:#ffffff;
          --ink:#0f172a;
          --muted:#64748b;
          --green:#065F46;
          --green2:#2a6528;
          --gold:#C9A227;
          --border:rgba(15,23,42,.08);
          --shadow: 0 18px 45px rgba(2,6,23,.10);
        }
        *{box-sizing:border-box}
        body{
          margin:0;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          background: var(--bg);
          color: var(--ink);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .topbar{
          height:64px;
          background: linear-gradient(90deg, rgba(6,95,70,.12), rgba(201,162,39,.10));
          border-bottom:1px solid var(--border);
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 0 20px;
        }
        .brand{
          width:100%;
          max-width: 980px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        }
        .brand h1{
          margin:0;
          font-size:12px;
          letter-spacing:.14em;
          text-transform: uppercase;
          color: var(--green);
          font-weight: 800;
        }
        .pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          border:1px solid rgba(6,95,70,.22);
          background: rgba(6,95,70,.06);
          padding:8px 12px;
          border-radius: 999px;
          font-size:12px;
          color: var(--green);
          font-weight:700;
        }
        .wrap{
          padding: 26px 18px 40px;
          display:flex;
          justify-content:center;
        }
        .sheet{
          width: 100%;
          max-width: 980px;
          background: var(--card);
          border:1px solid var(--border);
          border-radius: 22px;
          box-shadow: var(--shadow);
          overflow:hidden;
        }
        .header{
          padding: 28px 28px 18px;
          border-bottom: 1px solid var(--border);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 18px;
        }
        .kicker{
          font-size:11px;
          letter-spacing:.14em;
          text-transform: uppercase;
          color: rgba(6,95,70,.85);
          font-weight:800;
        }
        .title{
          margin:6px 0 8px;
          font-size: 34px;
          line-height:1.05;
          color: var(--green);
          font-weight: 900;
        }
        .sub{
          margin:0;
          color: var(--muted);
          font-size: 13px;
          max-width: 560px;
        }
        .badges{
          display:flex;
          flex-direction:column;
          gap:10px;
          min-width: 190px;
        }
        .badge{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          border:1px solid rgba(15,23,42,.10);
          background: rgba(15,23,42,.02);
          padding:10px 12px;
          border-radius: 12px;
          font-size: 12px;
          color: rgba(15,23,42,.75);
          font-weight: 700;
        }
        .badge strong{ color: var(--green); }
        .grid{
          padding: 18px 28px 22px;
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .panel{
          border:1px solid var(--border);
          border-radius: 16px;
          padding: 16px 16px 14px;
          background: #fff;
        }
        .panel h3{
          margin:0 0 12px;
          font-size: 13px;
          color: var(--green);
          font-weight: 900;
          display:flex;
          align-items:center;
          gap:8px;
        }
        .row{
          display:flex;
          justify-content:space-between;
          gap: 12px;
          padding: 8px 0;
          border-top: 1px dashed rgba(15,23,42,.10);
        }
        .row:first-of-type{ border-top:none; padding-top:0; }
        .lbl{ color: rgba(15,23,42,.55); font-size: 11px; letter-spacing:.08em; text-transform: uppercase; font-weight:800; }
        .val{ color: rgba(15,23,42,.92); font-size: 13px; font-weight: 800; text-align:right; }
        .total{
          margin: 0 28px 26px;
          border-radius: 18px;
          background: linear-gradient(90deg, var(--green), var(--green2));
          color: #fff;
          padding: 18px 18px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 16px;
        }
        .total .label{
          font-size: 11px;
          letter-spacing:.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,.8);
          font-weight: 900;
        }
        .total .money{
          font-size: 34px;
          font-weight: 950;
          line-height:1;
          margin-top: 6px;
        }
        .quote{
          max-width: 420px;
          font-size: 12px;
          color: rgba(255,255,255,.85);
          font-style: italic;
          line-height:1.45;
          text-align:right;
        }
        .footer{
          padding: 10px 28px 26px;
          display:flex;
          justify-content:space-between;
          gap: 16px;
          color: rgba(15,23,42,.55);
          font-size: 11px;
        }
        .footer strong{ color: rgba(15,23,42,.75); }

        @media (max-width: 760px){
          .badges{ display:none; }
          .grid{ grid-template-columns: 1fr; padding: 16px 18px; }
          .header{ padding: 22px 18px 14px; }
          .title{ font-size: 28px; }
          .total{ margin: 0 18px 18px; flex-direction: column; align-items:flex-start; }
          .quote{ text-align:left; }
          .footer{ padding: 10px 18px 22px; flex-direction:column; }
        }

        @media print{
          .topbar{ display:none; }
          body{ background: #fff; }
          .wrap{ padding: 0; }
          .sheet{ border:none; box-shadow:none; border-radius:0; }
        }
      </style>
    </head>
    <body>
      <div class="topbar">
        <div class="brand">
          <h1>ONLINE ZAKAT MANAGEMENT SYSTEM</h1>
          <div class="pill">Official Receipt</div>
        </div>
      </div>

      <div class="wrap">
        <div class="sheet">
          <div class="header">
            <div>
              <div class="kicker">OFFICIAL RECEIPT</div>
              <div class="title">Receipt</div>
              <p class="sub">
                This document confirms a <strong>${esc(typeLabel)}</strong> transaction recorded by the platform.
              </p>
            </div>
            <div class="badges">
              <div class="badge">Receipt No <strong>${esc(input.receiptNumber)}</strong></div>
              <div class="badge">Type <strong>${esc(input.transaction.type)}</strong></div>
            </div>
          </div>

          <div class="grid">
            <div class="panel">
              <h3>Donor Information</h3>
              <div class="row">
                <div class="lbl">Full Name</div>
                <div class="val">${esc(donorName)}</div>
              </div>
              <div class="row">
                <div class="lbl">Email Address</div>
                <div class="val">${esc(donorEmail)}</div>
              </div>
            </div>

            <div class="panel">
              <h3>Transaction Details</h3>
              <div class="row">
                <div class="lbl">Receipt Number</div>
                <div class="val">${esc(input.receiptNumber)}</div>
              </div>
              <div class="row">
                <div class="lbl">Date of Issue</div>
                <div class="val">${esc(generated)}</div>
              </div>
              <div class="row">
                <div class="lbl">Contribution Type</div>
                <div class="val">${esc(typeLabel)}</div>
              </div>
              <div class="row">
                <div class="lbl">Meta</div>
                <div class="val">${metaLine}</div>
              </div>
              <div class="row">
                <div class="lbl">Transaction ID</div>
                <div class="val">#${esc(input.transactionId)}</div>
              </div>
            </div>
          </div>

          <div class="total">
            <div>
              <div class="label">Total Contribution Amount</div>
              <div class="money">${esc(amount)}</div>
            </div>
            <div class="quote">
              "The example of those who spend their wealth in the way of Allah is like a seed of grain which grows seven spikes..."
            </div>
          </div>

          <div class="footer">
            <div><strong>Validation Notice:</strong> This receipt is system-generated and linked to a SUCCESS transaction.</div>
            <div><strong>Generated:</strong> ${esc(generated)}</div>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
}

