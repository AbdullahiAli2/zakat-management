import type { ZodError } from "zod";

/** Human-readable labels for form/API field keys */
export const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  password: "Password",
  newPassword: "New password",
  currentPassword: "Current password",
  phone: "Phone number",
  age: "Age",
  gender: "Gender",
  country: "Country",
  city: "City",
  address: "Address",
  role: "Role",
  name: "Name",
  title: "Title",
  amount: "Amount",
  beneficiaryCount: "Beneficiary count",
  beneficiaryId: "Beneficiary",
  distributionType: "Distribution type",
  category: "Category",
  nationalId: "National ID",
  familySize: "Family size",
  monthlyIncome: "Monthly income",
  accountId: "Account",
  zakatType: "Zakat type",
  method: "Payment method",
  nisabValue: "Nisab value",
  goldPricePerGram: "Gold price per gram",
  balance: "Balance",
  codename: "Permission code",
  groupId: "Group",
  permissionId: "Permission",
  backupName: "Backup name",
  reportType: "Report type",
  fromDate: "From date",
  toDate: "To date",
  location: "Location",
  notes: "Notes",
  code: "Wallet code",
  walletType: "Wallet type",
  chartAccountId: "Chart account",
  status: "Status",
  totalAssets: "Total assets",
  liabilities: "Liabilities",
  zakatYear: "Zakat year",
  description: "Description",
  lines: "Journal lines",
};

export type ValidationErrorBody = {
  ok: false;
  error: string;
  fieldErrors: Record<string, string>;
  details?: ReturnType<ZodError["flatten"]>;
};

function humanizeFieldKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function fieldLabel(path: PropertyKey[]): string {
  const key = String(path[0] ?? "field");
  return FIELD_LABELS[key] ?? humanizeFieldKey(key);
}

type ZodIssue = ZodError["issues"][number];

function friendlyIssueMessage(issue: ZodIssue): string {
  const label = fieldLabel(issue.path);
  const fieldKey = String(issue.path[0] ?? "");
  const custom = issue.message?.trim();

  if (custom && !/^too small|^too big|^invalid |^expected /i.test(custom)) {
    return custom;
  }

  const code = issue.code as string;

  if (fieldKey === "age" && code === "too_big") {
    return "This isn't a valid age.";
  }

  if (fieldKey === "age" && code === "too_small") {
    return "Age must be at least 1.";
  }

  if (code === "too_small") {
    const min = "minimum" in issue ? issue.minimum : undefined;
    if (typeof min === "number") {
      if (min === 1) return `${label} is required.`;
      if (String(issue.message ?? "").toLowerCase().includes("string")) {
        return `${label} must be at least ${min} characters.`;
      }
      return `${label} must be at least ${min}.`;
    }
  }

  if (code === "too_big") {
    const max = "maximum" in issue ? issue.maximum : undefined;
    if (typeof max === "number") {
      if (String(issue.message ?? "").toLowerCase().includes("string")) {
        return `${label} must be at most ${max} characters.`;
      }
      return `${label} must be at most ${max}.`;
    }
  }

  if (code === "invalid_format") {
    const format = "format" in issue ? issue.format : undefined;
    if (format === "email") return "Please enter a valid email address.";
    return `Please enter a valid ${label.toLowerCase()}.`;
  }

  if (code === "invalid_value") {
    return `Please select a valid ${label.toLowerCase()}.`;
  }

  if (code === "invalid_type") {
    return `${label} is required.`;
  }

  if (code === "custom") {
    return custom || `Please check ${label.toLowerCase()}.`;
  }

  return custom || `Please check ${label.toLowerCase()}.`;
}

/** Map Zod issues to one message per field (first issue wins per field). */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = friendlyIssueMessage(issue);
  }
  return out;
}

export function firstZodErrorMessage(error: ZodError): string {
  const fieldErrors = zodFieldErrors(error);
  const firstField = Object.values(fieldErrors)[0];
  if (firstField) return firstField;

  const formErrors = error.flatten().formErrors;
  if (formErrors[0]) return formErrors[0];

  return "Please check your input and try again.";
}

export function validationErrorBody(error: ZodError): ValidationErrorBody {
  const fieldErrors = zodFieldErrors(error);
  return {
    ok: false,
    error: Object.values(fieldErrors)[0] ?? firstZodErrorMessage(error),
    fieldErrors,
    details: error.flatten(),
  };
}

/** Pick the best message from an API error payload (RTK or fetch JSON). */
export function resolveApiErrorMessage(payload: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!payload || typeof payload !== "object") return fallback;

  const data = payload as {
    error?: string;
    fieldErrors?: Record<string, string>;
    details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  };

  if (data.fieldErrors) {
    const first = Object.values(data.fieldErrors).find(Boolean);
    if (first) return first;
  }

  const nested = data.details?.fieldErrors;
  if (nested) {
    for (const messages of Object.values(nested)) {
      const first = messages?.[0];
      if (first) return first;
    }
  }

  if (data.details?.formErrors?.[0]) return data.details.formErrors[0];

  const msg = data.error?.trim();
  if (msg && msg !== "Invalid request" && msg !== "Invalid query") return msg;

  return fallback;
}

/** Common business-rule messages returned by the API */
export function friendlyBusinessError(message: string): string {
  const map: Record<string, string> = {
    "Invalid request": "Please check the form and fix the highlighted fields.",
    "Invalid query": "Please check your filters and try again.",
    Unauthorized: "Please log in to continue.",
    Forbidden: "You do not have permission to perform this action.",
    "Email already in use": "This email is already registered. Try logging in or use another email.",
    "Register failed": "Registration failed. Please check your details and try again.",
    "Login failed": "Login failed. Please check your email and password.",
    "Invalid credentials": "Incorrect email or password.",
    "Email already exists": "This email is already in use. Choose a different email.",
    "Insufficient zakat wallet balance": "Not enough balance in the zakat wallet for this action.",
    "Insufficient ZAKAT wallet balance": "Not enough balance in the zakat wallet for this action.",
    "Zakat wallet is not available":
      "The Zakat system wallet is not set up. Ask an administrator to run: npm run db:seed",
    "Required GL accounts are not configured":
      "Accounting accounts are missing. Ask an administrator to run: npm run db:seed",
    "Community distribution not found": "Community distribution was not found.",
    "Only pending distributions can be approved": "Only pending distributions can be approved.",
    "Insufficient account balance": "Payment amount is more than your wallet balance.",
    "You must create account and have balance before paying zakat":
      "Add funds to your wallet before paying zakat.",
    "Payment is below Nisab (85g gold) and cannot be approved":
      "Your balance is below the Nisab threshold. No zakat is due until your wealth reaches Nisab.",
    "Zakat for this cycle is already fulfilled": "You have already paid your zakat for this cycle.",
    "You already have a zakat payment pending admin approval":
      "You already submitted zakat and it is waiting for admin approval. You cannot pay again until it is approved or rejected.",
  };

  // Dynamic: "You must pay the full zakat amount due (250.00)"
  if (message.startsWith("You must pay the full zakat amount due")) {
    const match = message.match(/\(([^)]+)\)/);
    const due = match?.[1] ?? "";
    return due
      ? `You must pay the full amount due ($${due}). Partial payments are not allowed.`
      : "You must pay the full zakat amount due. Partial payments are not allowed.";
  }

  return map[message] ?? message;
}

export function resolveFriendlyError(payload: unknown, fallback?: string): string {
  const raw = resolveApiErrorMessage(payload, fallback ?? "Something went wrong. Please try again.");
  return friendlyBusinessError(raw);
}
