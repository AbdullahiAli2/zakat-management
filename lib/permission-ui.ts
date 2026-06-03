export type PermissionAssignItem = { id: number; codename: string; name: string; enabled: boolean };

/** Longest-prefix match so COMMUNITY_DISTRIBUTIONS_* groups correctly. */
const MODULE_PREFIXES = [
  "COMMUNITY_DISTRIBUTIONS",
  "SYSTEM_WALLET",
  "DISTRIBUTIONS",
  "TRANSACTIONS",
  "PERMISSIONS",
  "BENEFICIARIES",
  "WALLETS",
  "GROUPS",
  "REPORTS",
  "RECEIPTS",
  "NISAB",
  "AUTH",
  "WALLET",
  "PROFILE",
  "ZAKAT",
  "DASHBOARD",
  "JOURNAL",
  "AUDIT",
  "USERS",
  "BACKUPS",
] as const;

export function moduleKeyForCodename(codename: string): string {
  for (const prefix of MODULE_PREFIXES) {
    if (codename === prefix || codename.startsWith(`${prefix}_`)) return prefix;
  }
  const idx = codename.indexOf("_");
  return idx > 0 ? codename.slice(0, idx) : codename;
}

export function formatModuleLabel(module: string) {
  return module
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function formatPermissionLabel(codename: string, name: string) {
  if (name.trim()) return name;
  const module = moduleKeyForCodename(codename);
  const action = codename.startsWith(`${module}_`) ? codename.slice(module.length + 1) : codename;
  return action
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export type PermissionModuleGroup = {
  module: string;
  label: string;
  items: PermissionAssignItem[];
};

export function groupPermissionsByModule(permissions: PermissionAssignItem[]): PermissionModuleGroup[] {
  const map = new Map<string, PermissionAssignItem[]>();
  for (const p of permissions) {
    const key = moduleKeyForCodename(p.codename);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, items]) => ({
      module,
      label: formatModuleLabel(module),
      items: items.sort((a, b) => a.codename.localeCompare(b.codename)),
    }));
}

export function filterModulesByApp(modules: PermissionModuleGroup[], appsFilter: string) {
  if (appsFilter === "ALL") return modules;
  return modules.filter((m) => m.module === appsFilter || m.module.startsWith(`${appsFilter}_`));
}

export function moduleFilterOptions(modules: PermissionModuleGroup[]) {
  return ["ALL", ...modules.map((m) => m.module).sort((a, b) => a.localeCompare(b))];
}

export function allPermissionsInModules(modules: PermissionModuleGroup[]) {
  return modules.flatMap((m) => m.items);
}
