export type Settings = Record<string, string | undefined>;
export async function settings(): Promise<Settings> {
  return typeof process !== "undefined" ? process.env : {};
}
export const demoOwnerId = "shared-prototype-owner";
export async function demoMode() {
  return (await settings()).CD80_DEMO_MODE === "1";
}
export async function localMode() {
  return (await settings()).CD80_LOCAL_MODE === "1";
}
