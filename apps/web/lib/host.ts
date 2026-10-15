// Host helpers shared by proxy.ts and server code (no Next request APIs here).
export const hostname = (host: string | null) => (host ?? '').split(',')[0]!.trim().split(':')[0]!.toLowerCase();
export const rootHost = () => process.env.ROOT_HOST ?? 'localhost';
export const isRootHost = (host: string) => host === rootHost();
// The platform admin area lives on its own host (admin.<root>), never on an institute host.
export const isAdminHost = (host: string) => host === `admin.${rootHost()}`;
