import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(72),
  phone: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : typeof val === "string" ? val.trim() : val),
    z.string().min(4).max(50).optional(),
  ),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.enum(["MALE", "FEMALE"]),
  country: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(2).max(500),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Please enter a valid email address.").max(200),
  password: z.string().min(1, "Password is required.").min(8, "Password must be at least 8 characters.").max(72),
});

export const profileUpdateSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  phone: z.string().max(50).optional(),
  age: z.number().int().min(1).max(120).optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().optional(),
}).refine(
  (data) =>
    Object.values(data).some((value) => value !== undefined && value !== null && value !== ""),
  { message: "At least one profile field must be provided" },
);

export const updateUserRoleSchema = z.object({
  role: z.enum(["SUPERUSER", "ADMIN", "DONOR"]),
  isActive: z.boolean().optional(),
});

export const notificationsMarkReadSchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.coerce.number().int().positive()).optional(),
  })
  .refine((data) => data.all === true || (Array.isArray(data.ids) && data.ids.length > 0), {
    message: "Provide all=true or a non-empty ids array",
  });

export const adminCreateUserSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters.").max(100),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters.").max(100),
  email: z.string().trim().email("Please enter a valid email address.").max(255),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  phone: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : typeof val === "string" ? val.trim() : val),
    z.string().min(4, "Phone number must be at least 4 characters.").max(50).optional(),
  ),
  age: z.coerce.number().int().min(1, "Age must be at least 1.").max(120, "Please enter a valid age."),
  gender: z.enum(["MALE", "FEMALE"], { message: "Please select a gender." }),
  country: z.string().trim().min(2, "Country is required.").max(100),
  city: z.string().trim().min(2, "City is required.").max(100),
  address: z.string().trim().min(2, "Address is required.").max(500),
  role: z.enum(["SUPERUSER", "ADMIN", "DONOR"], { message: "Please select a role." }),
  isActive: z.boolean().default(true),
});

export const adminUpdateUserSchema = z
  .object({
    firstName: z.string().min(2).max(100).optional(),
    lastName: z.string().min(2).max(100).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().min(4).max(50).optional(),
    age: z.number().int().min(1).max(120).optional(),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    country: z.string().min(2).max(100).optional(),
    city: z.string().min(2).max(100).optional(),
    address: z.string().min(2).max(500).optional(),
    role: z.enum(["SUPERUSER", "ADMIN", "DONOR"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(72),
});

export const toggleUserPermissionSchema = z.object({
  permissionId: z.number().int().positive(),
  enabled: z.boolean(),
});

export const toggleUserGroupSchema = z.object({
  groupId: z.number().int().positive(),
  enabled: z.boolean(),
});

export const syncUserGroupsSchema = z.object({
  groupIds: z.array(z.number().int().positive()).default([]),
});

export const syncUserPermissionsSchema = z.object({
  permissionIds: z.array(z.number().int().positive()).default([]),
});

export const syncGroupPermissionsSchema = z.object({
  permissionIds: z.array(z.number().int().positive()).default([]),
});

export const groupCreateSchema = z.object({
  name: z.string().min(2).max(100),
});

export const groupUpdateSchema = z.object({
  name: z.string().min(2).max(100),
});

export const permissionCreateSchema = z.object({
  codename: z.string().min(2).max(100).regex(/^[A-Z0-9_]+$/, "Use uppercase and underscore only"),
  name: z.string().min(2).max(255),
});

export const permissionUpdateSchema = z.object({
  codename: z.string().min(2).max(100).regex(/^[A-Z0-9_]+$/, "Use uppercase and underscore only").optional(),
  name: z.string().min(2).max(255).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(72),
    newPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different",
    path: ["newPassword"],
  });

export const zakatCalculationSchema = z.object({
  totalAssets: z.coerce.number().nonnegative(),
  liabilities: z.coerce.number().nonnegative().default(0),
  zakatYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const beneficiaryVerifySchema = z.object({
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  notes: z.string().max(1000).optional(),
});

export const beneficiaryCreateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  category: z.enum(["POOR", "ORPHAN", "WIDOW", "DISABLED", "STUDENT", "EMERGENCY"]),
  nationalId: z.string().max(100).optional(),
  familySize: z.coerce.number().int().positive().optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  address: z.string().optional(),
});

export const reportGenerateSchema = z.object({
  reportType: z.enum([
    "DONOR_LIST",
    "ZAKAT_PAYMENTS",
    "ZAKAT_SUMMARY",
    "TRANSACTION_LEDGER",
    "DISTRIBUTION_SUMMARY",
    "BENEFICIARY_LIST",
  ]),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export const backupCreateSchema = z.object({
  backupName: z.string().min(2).max(255),
});

export const communityDistributionCreateSchema = z.object({
  title: z.string().trim().min(2).max(255),
  distributionType: z.enum(["FOOD", "CASH", "MEDICAL", "EDUCATION", "WATER", "EMERGENCY"]),
  beneficiaryCount: z.coerce.number().int().min(1),
  amount: z.coerce.number().positive(),
  location: z.string().max(255).optional(),
  notes: z.string().optional(),
  distributionDate: z.string().datetime().optional(),
});

export const communityDistributionUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(255).optional(),
    distributionType: z.enum(["FOOD", "CASH", "MEDICAL", "EDUCATION", "WATER", "EMERGENCY"]).optional(),
    beneficiaryCount: z.coerce.number().int().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    location: z.string().max(255).nullable().optional(),
    notes: z.string().nullable().optional(),
    distributionDate: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

export const createWalletSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric"),
  name: z.string().trim().min(2).max(255),
  walletType: z.enum(["MAIN", "ZAKAT", "SADAQAH", "EMERGENCY", "OPERATIONS"]),
  chartAccountId: z.coerce.number().int().positive(),
});

export const walletStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const manualJournalSchema = z.object({
  description: z.string().min(2).max(500),
  lines: z
    .array(
      z.object({
        accountId: z.coerce.number().int().positive(),
        walletId: z.coerce.number().int().positive().optional(),
        debit: z.coerce.number().nonnegative().optional(),
        credit: z.coerce.number().nonnegative().optional(),
        lineDescription: z.string().max(255).optional(),
      }),
    )
    .min(2),
});

