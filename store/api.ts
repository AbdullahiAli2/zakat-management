/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApi } from "@reduxjs/toolkit/query/react";
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { resolveFriendlyError } from "@/lib/validation-messages";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
  details?: unknown;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "",
  credentials: "include",
  prepareHeaders: (headers) => {
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");
    return headers;
  },
  // Avoid browser/Next caching of GET APIs (critical for live Nisab on donor dashboards).
  fetchFn: (input, init) => fetch(input, { ...init, cache: "no-store" }),
});

export const api = createApi({
  reducerPath: "api",
  tagTypes: ["Auth", "User", "Permissions", "Accounts", "ZakatSummary", "Transactions", "Reports", "SystemWallet"],
  keepUnusedDataFor: 5,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  baseQuery: async (args, apiApi, extraOptions) => {
    const result = await rawBaseQuery(args, apiApi, extraOptions);
    if (result.error) return result;

    const data = result.data as ApiEnvelope<unknown>;
    if (data && typeof data === "object" && "ok" in data && data.ok === false) {
      const friendly = resolveFriendlyError(data);
      return {
        error: {
          status: 400,
          data: { ...data, error: friendly },
        },
      } as unknown as typeof result;
    }

    return result;
  },
  endpoints: (builder) => ({
    getMe: builder.query<{ id: number; name: string; email: string; role: string; avatarUrl?: string | null } | null, void>({
      query: () => ({ url: "/api/auth/me", method: "GET" }),
      transformResponse: (response: {
        user: { id: number; name: string; email: string; role: string; avatarUrl?: string | null } | null;
      }) => response.user,
      providesTags: ["Auth", "User"],
      keepUnusedDataFor: 0,
    }),
    getMyPermissions: builder.query<{ all: boolean; permissions: string[] }, void>({
      query: () => ({ url: "/api/auth/permissions", method: "GET" }),
      transformResponse: (response: any) => response.data,
      providesTags: ["Auth", "Permissions"],
      keepUnusedDataFor: 0,
    }),
    getAccountsMe: builder.query<
      { balance: string; totalZakatPaid: string; accounts: Array<{ id: number; name: string; status: string; balance: string; createdAt: string }> },
      void
    >({
      query: () => ({ url: "/api/accounts/me", method: "GET" }),
      transformResponse: (response: { data: { balance: string; totalZakatPaid: string; accounts: Array<{ id: number; name: string; status: string; balance: string; createdAt: string }> } }) => response.data,
      providesTags: [{ type: "Accounts", id: "LIST" }],
    }),
    createMyAccount: builder.mutation<{ ok: true }, { name: string; balance?: number }>({
      query: (body) => ({ url: "/api/accounts/me", method: "POST", body }),
      transformResponse: (response: any) => response,
      invalidatesTags: [{ type: "Accounts", id: "LIST" }, { type: "ZakatSummary", id: "LIST" }],
    }),
    updateMyAccount: builder.mutation<{ ok: true }, { id: number; name?: string; balance?: number; status?: "ACTIVE" | "SUSPENDED" }>({
      query: ({ id, ...body }) => ({ url: `/api/accounts/me/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Accounts", id: "LIST" },
        { type: "Accounts", id },
        { type: "ZakatSummary", id: "LIST" },
        { type: "ZakatSummary", id },
      ],
    }),
    deleteMyAccount: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/accounts/me/${id}`, method: "DELETE" }),
      transformResponse: (response: any) => response,
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Accounts", id: "LIST" },
        { type: "Accounts", id },
        { type: "ZakatSummary", id: "LIST" },
        { type: "ZakatSummary", id },
      ],
    }),
    getTransactions: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          date: string | Date;
          amount: string;
          type: string;
          method: string;
          status: string;
          reference: string | null;
        }>;
      },
      {
        page?: number;
        pageSize?: number;
        dateFrom?: string;
        dateTo?: string;
        method?: string;
        status?: string;
      }
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.dateFrom) sp.set("dateFrom", params.dateFrom);
        if (params?.dateTo) sp.set("dateTo", params.dateTo);
        if (params?.method) sp.set("method", params.method);
        if (params?.status) sp.set("status", params.status);
        const qs = sp.toString();
        return { url: `/api/transactions${qs ? `?${qs}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
      providesTags: [{ type: "Transactions", id: "LIST" }],
    }),
    payZakat: builder.mutation<
      {
        paymentId: number;
        user: { id: number; name: string; email: string };
        amount: string;
        date: string;
        zakatType: string;
        nisabValue: string;
      },
      { amount: number; zakatType: string; method: string; accountId?: number }
    >({
      query: (body) => ({
        url: "/api/zakat/pay",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.receipt,
      invalidatesTags: (_result, _error, arg) => [
        { type: "Accounts", id: "LIST" },
        { type: "ZakatSummary", id: "LIST" },
        ...(arg.accountId ? [{ type: "ZakatSummary" as const, id: arg.accountId }] : []),
        { type: "Transactions", id: "LIST" },
      ],
    }),
    getAdminZakatPayments: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          userId: number;
          accountId: number | null;
          amount: number;
          zakatType: string;
          method: string;
          status: "PENDING" | "APPROVED" | "REJECTED";
          referenceNumber: string | null;
          nisabChecked: boolean;
          createdAt: string;
          approvedAt: string | null;
          user: { name: string | null; email: string | null };
          account: { name: string | null };
        }>;
      },
      { page?: number; pageSize?: number; status?: "PENDING" | "APPROVED" | "REJECTED" } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.status) sp.set("status", params.status);
        return { url: `/api/admin/zakat-payments${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    approveZakatPayment: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/zakat/approve/${id}`, method: "POST" }),
      transformResponse: (response: any) => response,
      invalidatesTags: [
        { type: "ZakatSummary", id: "LIST" },
        { type: "ZakatSummary", id: "NISAB" },
        { type: "Accounts", id: "LIST" },
        { type: "Transactions", id: "LIST" },
        { type: "SystemWallet", id: "PRIMARY" },
      ],
    }),
    rejectZakatPayment: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/zakat/reject/${id}`, method: "POST" }),
      transformResponse: (response: any) => response,
      invalidatesTags: [
        { type: "ZakatSummary", id: "LIST" },
        { type: "Accounts", id: "LIST" },
        { type: "Transactions", id: "LIST" },
      ],
    }),
    getZakatSummary: builder.query<
      {
        accountBalance: string | null;
        nisabValue: string;
        goldPricePerGram: string;
        nisabUpdatedAt: string | null;
        rate: string;
        calculatedZakat: string | null;
        paidThisCycle: string | null;
        pendingThisCycle: string | null;
        hasPendingPayment: boolean;
        remainingDue: string | null;
        belowNisab: boolean | null;
        zakatDue: boolean | null;
      },
      { amount?: number; accountId?: number }
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.amount) sp.set("amount", String(params.amount));
        if (params?.accountId) sp.set("accountId", String(params.accountId));
        return { url: `/api/zakat/summary${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, arg) => [
        { type: "ZakatSummary", id: "LIST" },
        { type: "ZakatSummary", id: "NISAB" },
        ...(arg?.accountId ? [{ type: "ZakatSummary" as const, id: arg.accountId }] : []),
      ],
      keepUnusedDataFor: 0,
    }),
    getNotifications: builder.query<
      {
        unreadCount: number;
        page: number;
        pageSize: number;
        total: number;
        items: Array<{ id: number; title: string; message: string; isRead: boolean; createdAt: string }>;
      },
      { page?: number; pageSize?: number } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params && params.page) sp.set("page", String(params.page));
        if (params && params.pageSize) sp.set("pageSize", String(params.pageSize));
        return { url: `/api/notifications${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    markNotificationsRead: builder.mutation<{ ok: true }, { all?: boolean; ids?: number[] }>({
      query: (body) => ({
        url: "/api/notifications/mark-read",
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response,
    }),
    getAdminOverview: builder.query<
      {
        totalUsers: number;
        totalTransactions: number;
        totalZakatCollected: string;
        currentNisab: string;
        totalDistributed: string;
        remainingBalance: string;
        beneficiariesSupported: number;
      },
      void
    >({
      query: () => ({ url: "/api/admin/overview", method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    getAdminAudit: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        modules?: string[];
        items: Array<{
          id: number;
          userId: number | null;
          path: string;
          action: string;
          module: string;
          ip: string;
          browser: string;
          os: string;
          createdAt: string;
          user?: { name: string; email: string } | null;
        }>;
      },
      { page?: number; pageSize?: number; q?: string; module?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.q) sp.set("q", params.q);
        if (params?.module) sp.set("module", params.module);
        return { url: `/api/admin/audit${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    getAdminActivity: builder.query<
      Array<{ day: string; count: number; totalAmount: string }>,
      { days?: number } | void
    >({
      query: (params) => {
        const days = params && params.days ? params.days : 7;
        return { url: `/api/admin/activity?days=${days}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data.points,
    }),
    getAdminReports: builder.query<
      Array<{ id: number; reportType: string | null; generatedAt: string; generatedBy: string | null }>,
      void
    >({
      query: () => ({ url: "/api/admin/reports", method: "GET" }),
      transformResponse: (response: any) => response.data,
      providesTags: ["Reports"],
    }),
    generateAdminReport: builder.mutation<
      { id: number; reportType: string; generatedAt: string; payload: unknown },
      {
        reportType:
          | "DONOR_LIST"
          | "ZAKAT_PAYMENTS"
          | "ZAKAT_SUMMARY"
          | "TRANSACTION_LEDGER"
          | "DISTRIBUTION_SUMMARY"
          | "BENEFICIARY_LIST";
      }
    >({
      query: (body) => ({ url: "/api/admin/reports", method: "POST", body }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ["Reports"],
    }),
    getAdminNisab: builder.query<{ id: number; goldPricePerGram: number; nisabValue: number; updatedAt: string } | null, void>({
      query: () => ({ url: "/api/admin/nisab", method: "GET" }),
      transformResponse: (response: any) => response.data,
      providesTags: [{ type: "ZakatSummary", id: "NISAB" }],
      keepUnusedDataFor: 0,
    }),
    updateAdminNisab: builder.mutation<
      { goldPricePerGram: number; nisabValue: number; updatedAt?: string },
      { goldPricePerGram: number }
    >({
      query: (body) => ({ url: "/api/admin/nisab", method: "PUT", body }),
      transformResponse: (response: any) => response.data,
      // Donor above/below Nisab is derived from the live threshold — refresh summaries after update.
      invalidatesTags: [
        { type: "ZakatSummary", id: "NISAB" },
        { type: "ZakatSummary", id: "LIST" },
      ],
    }),
    getSystemWallet: builder.query<{ id: number | null; balance: number; updatedAt: string | null }, void>({
      query: () => ({ url: "/api/admin/system-wallet", method: "GET" }),
      transformResponse: (response: any) => response.data,
      providesTags: [{ type: "SystemWallet", id: "PRIMARY" }],
    }),
    adjustSystemWallet: builder.mutation<{ balance: number }, { amount: number; mode: "ADD" | "SUBTRACT"; reason?: string }>({
      query: (body) => ({ url: "/api/admin/system-wallet", method: "PATCH", body }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: [{ type: "SystemWallet", id: "PRIMARY" }],
    }),
    getAdminWallets: builder.query<
      {
        items: Array<{
          id: number;
          code: string;
          name: string;
          walletType: string;
          chartAccountId: number;
          status: string;
          balance: number;
          createdAt: string;
          updatedAt: string;
        }>;
      },
      { walletType?: string; status?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.walletType) sp.set("walletType", params.walletType);
        if (params?.status) sp.set("status", params.status);
        return { url: `/api/admin/wallets${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    createAdminWallet: builder.mutation<
      { ok: true; data: { id: number; code: string; name: string; walletType: string; balance: number } },
      { code: string; name: string; walletType: "MAIN" | "ZAKAT" | "SADAQAH" | "EMERGENCY" | "OPERATIONS"; chartAccountId: number }
    >({
      query: (body) => ({ url: "/api/admin/wallets", method: "POST", body }),
      transformResponse: (response: any) => response,
    }),
    suspendAdminWallet: builder.mutation<{ ok: true; data: unknown }, { id: number; status: "ACTIVE" | "SUSPENDED" }>({
      query: ({ id, status }) => ({ url: `/api/admin/wallets/${id}`, method: "PATCH", body: { status } }),
      transformResponse: (response: any) => response,
    }),
    getAdminWalletBalance: builder.query<{ walletId: number; code: string; balance: number; computedFrom: string }, number>({
      query: (id) => ({ url: `/api/admin/wallets/${id}/balance`, method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    getAdminWalletLedger: builder.query<
      { page: number; pageSize: number; total: number; balance: number; items: Array<Record<string, unknown>> },
      { id: number; page?: number; pageSize?: number }
    >({
      query: ({ id, page, pageSize }) => {
        const sp = new URLSearchParams();
        if (page) sp.set("page", String(page));
        if (pageSize) sp.set("pageSize", String(pageSize));
        return { url: `/api/admin/wallets/${id}/ledger${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    getAdminWalletTransactions: builder.query<
      { page: number; pageSize: number; total: number; items: Array<Record<string, unknown>> },
      { id: number; page?: number; pageSize?: number }
    >({
      query: ({ id, page, pageSize }) => {
        const sp = new URLSearchParams();
        if (page) sp.set("page", String(page));
        if (pageSize) sp.set("pageSize", String(pageSize));
        return { url: `/api/admin/wallets/${id}/transactions${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    getAdminBeneficiaries: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          firstName: string | null;
          lastName: string | null;
          fullName: string;
          phone: string | null;
          gender: "male" | "female" | null;
          category: "POOR" | "ORPHAN" | "WIDOW" | "DISABLED" | "STUDENT" | "EMERGENCY";
          address: string | null;
          nationalId: string | null;
          familySize: number | null;
          monthlyIncome: number | null;
          status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
          verifiedBy: number | null;
          verifiedAt: string | null;
          createdAt: string;
        }>;
      },
      { page?: number; pageSize?: number; category?: string; status?: string; q?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.category) sp.set("category", params.category);
        if (params?.status) sp.set("status", params.status);
        if (params?.q) sp.set("q", params.q);
        return { url: `/api/admin/beneficiaries${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    createAdminBeneficiary: builder.mutation<
      { ok: true; data: { id: number } },
      {
        firstName?: string;
        lastName?: string;
        phone?: string;
        gender?: "male" | "female";
        category: "POOR" | "ORPHAN" | "WIDOW" | "DISABLED" | "STUDENT" | "EMERGENCY";
        nationalId?: string;
        familySize?: number;
        monthlyIncome?: number;
        address?: string;
      }
    >({
      query: (body) => ({ url: "/api/admin/beneficiaries", method: "POST", body }),
      transformResponse: (response: any) => response,
    }),
    updateAdminBeneficiary: builder.mutation<
      { ok: true },
      {
        id: number;
        firstName?: string;
        lastName?: string;
        phone?: string;
        gender?: "male" | "female" | null;
        category?: "POOR" | "ORPHAN" | "WIDOW" | "DISABLED" | "STUDENT" | "EMERGENCY";
        nationalId?: string | null;
        familySize?: number | null;
        monthlyIncome?: number | null;
        address?: string | null;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/api/admin/beneficiaries/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response,
    }),
    verifyAdminBeneficiary: builder.mutation<
      { ok: true },
      { id: number; status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" }
    >({
      query: ({ id, status }) => ({ url: `/api/admin/beneficiaries/${id}/verify`, method: "POST", body: { status } }),
      transformResponse: (response: any) => response,
    }),
    deleteAdminBeneficiary: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/beneficiaries/${id}`, method: "DELETE" }),
      transformResponse: (response: any) => response,
    }),
    getAdminDistributions: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          beneficiaryId: number;
          beneficiaryName: string;
          beneficiaryCategory: "POOR" | "ORPHAN" | "WIDOW" | "DISABLED" | "STUDENT" | "EMERGENCY";
          distributionType: "FOOD" | "CASH" | "MEDICAL" | "EDUCATION" | "WATER" | "EMERGENCY";
          status: "PENDING" | "APPROVED" | "COMPLETED";
          amount: number;
          notes: string | null;
          createdAt: string;
          adminId: number;
          adminName: string | null;
        }>;
      },
      { page?: number; pageSize?: number; category?: string; status?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.category) sp.set("category", params.category);
        if (params?.status) sp.set("status", params.status);
        return { url: `/api/admin/distributions${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    getAdminDistributionSummary: builder.query<
      {
        total: number;
        individualTotal: number;
        communityTotal: number;
        items: Array<{
          category: "POOR" | "ORPHAN" | "WIDOW" | "DISABLED" | "STUDENT" | "EMERGENCY" | "COMMUNITY";
          amount: number;
          percent: number;
        }>;
      },
      void
    >({
      query: () => ({ url: "/api/admin/distributions/summary", method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    createAdminDistribution: builder.mutation<
      { ok: true },
      {
        beneficiaryId: number;
        distributionType: "FOOD" | "CASH" | "MEDICAL" | "EDUCATION" | "WATER" | "EMERGENCY";
        amount: number;
        notes?: string;
        status?: "PENDING" | "APPROVED" | "COMPLETED";
      }
    >({
      query: (body) => ({ url: "/api/admin/distributions", method: "POST", body }),
      transformResponse: (response: any) => response,
      invalidatesTags: [{ type: "SystemWallet", id: "PRIMARY" }, { type: "Transactions", id: "LIST" }],
    }),
    updateAdminDistribution: builder.mutation<
      { ok: true },
      {
        id: number;
        beneficiaryId?: number;
        distributionType?: "FOOD" | "CASH" | "MEDICAL" | "EDUCATION" | "WATER" | "EMERGENCY";
        amount?: number;
        status?: "PENDING" | "APPROVED" | "COMPLETED";
        notes?: string | null;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/api/admin/distributions/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response,
      invalidatesTags: [{ type: "SystemWallet", id: "PRIMARY" }, { type: "Transactions", id: "LIST" }],
    }),
    deleteAdminDistribution: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/distributions/${id}`, method: "DELETE" }),
      transformResponse: (response: any) => response,
      invalidatesTags: [{ type: "SystemWallet", id: "PRIMARY" }, { type: "Transactions", id: "LIST" }],
    }),
    getAdminCommunityDistributions: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          adminId: number;
          adminName: string | null;
          transactionId: number | null;
          title: string;
          distributionType: "FOOD" | "CASH" | "MEDICAL" | "EDUCATION" | "WATER" | "EMERGENCY";
          beneficiaryCount: number;
          amount: number;
          location: string | null;
          status: "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
          notes: string | null;
          approvedBy: number | null;
          approverName: string | null;
          approvedAt: string | null;
          completedAt: string | null;
          distributionDate: string | null;
          createdAt: string;
        }>;
      },
      { page?: number; pageSize?: number; status?: string; q?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.status) sp.set("status", params.status);
        if (params?.q) sp.set("q", params.q);
        return { url: `/api/admin/community-distributions${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    createAdminCommunityDistribution: builder.mutation<
      { ok: true; data: { id: number } },
      {
        title: string;
        distributionType: "FOOD" | "CASH" | "MEDICAL" | "EDUCATION" | "WATER" | "EMERGENCY";
        beneficiaryCount: number;
        amount: number;
        location?: string;
        notes?: string;
        distributionDate?: string;
      }
    >({
      query: (body) => ({ url: "/api/admin/community-distributions", method: "POST", body }),
      transformResponse: (response: any) => response,
    }),
    updateAdminCommunityDistribution: builder.mutation<
      { ok: true },
      {
        id: number;
        title?: string;
        distributionType?: "FOOD" | "CASH" | "MEDICAL" | "EDUCATION" | "WATER" | "EMERGENCY";
        beneficiaryCount?: number;
        amount?: number;
        location?: string | null;
        notes?: string | null;
        distributionDate?: string | null;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/api/admin/community-distributions/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response,
    }),
    deleteAdminCommunityDistribution: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/community-distributions/${id}`, method: "DELETE" }),
      transformResponse: (response: any) => response,
      invalidatesTags: [{ type: "SystemWallet", id: "PRIMARY" }, { type: "Transactions", id: "LIST" }],
    }),
    approveAdminCommunityDistribution: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/community-distributions/${id}/approve`, method: "POST" }),
      transformResponse: (response: any) => response,
      invalidatesTags: [{ type: "SystemWallet", id: "PRIMARY" }, { type: "Transactions", id: "LIST" }],
    }),
    completeAdminCommunityDistribution: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/community-distributions/${id}/complete`, method: "POST" }),
      transformResponse: (response: any) => response,
    }),
    getAdminReceipts: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          transactionId: number;
          receiptNumber: string;
          generatedAt: string;
          transactionType: "ZAKAT_PAYMENT" | "DISTRIBUTION";
          paymentMethod: string | null;
          beneficiaryCategory: "ORPHAN" | "POOR" | "WIDOW" | "DISABLED" | "STUDENT" | "EMERGENCY" | null;
          amount: number;
          transactionDate: string;
          user: { name: string | null; email: string | null };
        }>;
      },
      { page?: number; pageSize?: number; q?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.q) sp.set("q", params.q);
        return { url: `/api/admin/receipts${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    getAdminAccounts: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          userId: number;
          name: string;
          balance: number;
          status: "ACTIVE" | "SUSPENDED";
          createdAt: string;
          user: { name: string | null; email: string | null };
        }>;
      },
      { page?: number; pageSize?: number; q?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        if (params?.q) sp.set("q", params.q);
        return { url: `/api/admin/accounts${sp.toString() ? `?${sp.toString()}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    createAdminAccount: builder.mutation<{ ok: true }, { userId?: number; fullName?: string; name: string; balance?: number; status?: "ACTIVE" | "SUSPENDED" }>({
      query: (body) => ({ url: "/api/admin/accounts", method: "POST", body }),
      transformResponse: (response: any) => response,
    }),
    updateAdminAccount: builder.mutation<{ ok: true }, { id: number; name?: string; balance?: number; status?: "ACTIVE" | "SUSPENDED" }>({
      query: ({ id, ...body }) => ({ url: `/api/admin/accounts/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response,
    }),
    deleteAdminAccount: builder.mutation<{ ok: true }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/accounts/${id}`, method: "DELETE" }),
      transformResponse: (response: any) => response,
    }),
    searchUsers: builder.query<
      {
        page: number;
        pageSize: number;
        total: number;
        items: Array<{
          id: number;
          name: string;
          email: string;
          role: string;
          isActive: boolean;
          lastLogin: string | null;
          createdAt: string;
          phone: string | null;
          age: number | null;
          gender: "male" | "female" | null;
          country: string | null;
          city: string | null;
          address: string | null;
        }>;
      },
      { q?: string; role?: string; isActive?: boolean; page?: number; pageSize?: number }
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set("q", params.q);
        if (params?.role) sp.set("role", params.role);
        if (typeof params?.isActive === "boolean") sp.set("isActive", String(params.isActive));
        if (params?.page) sp.set("page", String(params.page));
        if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
        const qs = sp.toString();
        return { url: `/api/users/search${qs ? `?${qs}` : ""}`, method: "GET" };
      },
      transformResponse: (response: any) => response.data,
    }),
    updateUserRole: builder.mutation<
      { id: number; name: string; email: string; isActive: boolean; role: string },
      { id: number; role: string; isActive?: boolean }
    >({
      query: ({ id, ...body }) => ({
        url: `/api/users/${id}/role`,
        method: "POST",
        body,
      }),
      transformResponse: (response: any) => response.data,
    }),
    createAdminUser: builder.mutation<
      { id: number; name: string; email: string; isActive: boolean; role: string },
      {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        phone: string;
        age: number;
        gender: "male" | "female";
        country: string;
        city: string;
        address: string;
        role: "SUPERUSER" | "ADMIN";
        isActive: boolean;
      }
    >({
      query: (body) => ({ url: "/api/admin/users", method: "POST", body }),
      transformResponse: (response: any) => response.data,
    }),
    updateAdminUser: builder.mutation<
      { id: number; name: string; email: string; isActive: boolean; role: string },
      {
        id: number;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        age?: number;
        gender?: "male" | "female";
        country?: string;
        city?: string;
        address?: string;
        role?: "SUPERUSER" | "ADMIN" | "DONOR";
        isActive?: boolean;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/api/admin/users/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response.data,
    }),
    deleteAdminUser: builder.mutation<{ ok: boolean }, { id: number }>({
      query: ({ id }) => ({ url: `/api/admin/users/${id}`, method: "DELETE" }),
    }),
    resetUserPassword: builder.mutation<{ ok: boolean }, { id: number; newPassword: string }>({
      query: ({ id, ...body }) => ({ url: `/api/admin/users/${id}/reset-password`, method: "POST", body }),
    }),
    getGroups: builder.query<Array<{ id: number; name: string; usersCount: number; permissionsCount: number }>, void>({
      query: () => ({ url: "/api/groups", method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    createGroup: builder.mutation<{ id: number; name: string }, { name: string }>({
      query: (body) => ({ url: "/api/groups", method: "POST", body }),
      transformResponse: (response: any) => response.data,
    }),
    updateGroup: builder.mutation<{ id: number; name: string }, { id: number; name: string }>({
      query: ({ id, ...body }) => ({ url: `/api/groups/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response.data,
    }),
    deleteGroup: builder.mutation<{ ok: boolean }, { id: number }>({
      query: ({ id }) => ({ url: `/api/groups/${id}`, method: "DELETE" }),
    }),
    getPermissions: builder.query<Array<{ id: number; codename: string; name: string }>, void>({
      query: () => ({ url: "/api/permissions", method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    createPermission: builder.mutation<{ id: number; codename: string; name: string }, { codename: string; name: string }>({
      query: (body) => ({ url: "/api/permissions", method: "POST", body }),
      transformResponse: (response: any) => response.data,
    }),
    updatePermission: builder.mutation<{ id: number; codename: string; name: string }, { id: number; codename?: string; name?: string }>({
      query: ({ id, ...body }) => ({ url: `/api/permissions/${id}`, method: "PATCH", body }),
      transformResponse: (response: any) => response.data,
    }),
    deletePermission: builder.mutation<{ ok: boolean }, { id: number }>({
      query: ({ id }) => ({ url: `/api/permissions/${id}`, method: "DELETE" }),
    }),
    getUserPermissions: builder.query<Array<{ id: number; codename: string; name: string; enabled: boolean }>, { userId: number }>({
      query: ({ userId }) => ({ url: `/api/admin/users/${userId}/permissions`, method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    toggleUserPermission: builder.mutation<{ ok: boolean }, { userId: number; permissionId: number; enabled: boolean }>({
      query: ({ userId, ...body }) => ({ url: `/api/admin/users/${userId}/permissions`, method: "POST", body }),
    }),
    updateUserPermissions: builder.mutation<{ ok: boolean }, { userId: number; permissionIds: number[] }>({
      query: ({ userId, permissionIds }) => ({
        url: `/api/admin/users/${userId}/permissions`,
        method: "PUT",
        body: { permissionIds },
      }),
    }),
    getUserGroups: builder.query<Array<{ id: number; name: string; enabled: boolean }>, { userId: number }>({
      query: ({ userId }) => ({ url: `/api/admin/users/${userId}/groups`, method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    toggleUserGroup: builder.mutation<{ ok: boolean }, { userId: number; groupId: number; enabled: boolean }>({
      query: ({ userId, ...body }) => ({ url: `/api/admin/users/${userId}/groups`, method: "POST", body }),
    }),
    updateUserGroups: builder.mutation<{ ok: boolean }, { userId: number; groupIds: number[] }>({
      query: ({ userId, groupIds }) => ({ url: `/api/users/${userId}/groups`, method: "PUT", body: { groupIds } }),
    }),
    getGroupPermissions: builder.query<Array<{ id: number; codename: string; name: string; enabled: boolean }>, { groupId: number }>({
      query: ({ groupId }) => ({ url: `/api/groups/${groupId}/permissions`, method: "GET" }),
      transformResponse: (response: any) => response.data,
    }),
    updateGroupPermissions: builder.mutation<{ ok: boolean }, { groupId: number; permissionIds: number[] }>({
      query: ({ groupId, permissionIds }) => ({ url: `/api/groups/${groupId}/permissions`, method: "PUT", body: { permissionIds } }),
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetMyPermissionsQuery,
  useGetAccountsMeQuery,
  useCreateMyAccountMutation,
  useUpdateMyAccountMutation,
  useDeleteMyAccountMutation,
  useGetTransactionsQuery,
  usePayZakatMutation,
  useGetAdminZakatPaymentsQuery,
  useApproveZakatPaymentMutation,
  useRejectZakatPaymentMutation,
  useGetZakatSummaryQuery,
  useGetNotificationsQuery,
  useMarkNotificationsReadMutation,
  useGetAdminOverviewQuery,
  useGetAdminAuditQuery,
  useGetAdminActivityQuery,
  useGetAdminReportsQuery,
  useGenerateAdminReportMutation,
  useGetAdminNisabQuery,
  useUpdateAdminNisabMutation,
  useGetSystemWalletQuery,
  useAdjustSystemWalletMutation,
  useGetAdminWalletsQuery,
  useCreateAdminWalletMutation,
  useSuspendAdminWalletMutation,
  useGetAdminWalletBalanceQuery,
  useGetAdminWalletLedgerQuery,
  useGetAdminWalletTransactionsQuery,
  useGetAdminBeneficiariesQuery,
  useCreateAdminBeneficiaryMutation,
  useUpdateAdminBeneficiaryMutation,
  useVerifyAdminBeneficiaryMutation,
  useDeleteAdminBeneficiaryMutation,
  useGetAdminDistributionsQuery,
  useGetAdminDistributionSummaryQuery,
  useCreateAdminDistributionMutation,
  useUpdateAdminDistributionMutation,
  useDeleteAdminDistributionMutation,
  useGetAdminCommunityDistributionsQuery,
  useCreateAdminCommunityDistributionMutation,
  useUpdateAdminCommunityDistributionMutation,
  useDeleteAdminCommunityDistributionMutation,
  useApproveAdminCommunityDistributionMutation,
  useCompleteAdminCommunityDistributionMutation,
  useGetAdminReceiptsQuery,
  useGetAdminAccountsQuery,
  useCreateAdminAccountMutation,
  useUpdateAdminAccountMutation,
  useDeleteAdminAccountMutation,
  useSearchUsersQuery,
  useUpdateUserRoleMutation,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useResetUserPasswordMutation,
  useGetGroupsQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useGetPermissionsQuery,
  useCreatePermissionMutation,
  useUpdatePermissionMutation,
  useDeletePermissionMutation,
  useGetUserPermissionsQuery,
  useToggleUserPermissionMutation,
  useUpdateUserPermissionsMutation,
  useGetUserGroupsQuery,
  useToggleUserGroupMutation,
  useUpdateUserGroupsMutation,
  useGetGroupPermissionsQuery,
  useUpdateGroupPermissionsMutation,
} = api;

