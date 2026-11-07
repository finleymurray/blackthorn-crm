/**
 * Local development sign in. Active only when LOCAL_DEV_AUTH=1 and the app is
 * not a production build, so the CRM can run against a plain Postgres
 * database without Supabase Auth. Never enabled in a deployment.
 */
export const LOCAL_DEV_COOKIE = "bt_dev_staff";

export function localDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.LOCAL_DEV_AUTH === "1";
}
