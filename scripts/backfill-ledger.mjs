import { backfillAccountingLedger } from "../lib/accounting/backfill.js";

backfillAccountingLedger()
  .then((r) => {
    console.log("Ledger backfill complete:", r);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
