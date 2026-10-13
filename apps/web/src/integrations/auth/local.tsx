import { createServerFn } from "@tanstack/react-start";
import type { AuthIntegration } from "./types";
import { demoMode, demoOwnerId, localMode } from "../../server/settings";
const getSession = createServerFn().handler(async () => {
  const local = await localMode();
  if (!local && !(await demoMode()))
    throw new Error("Demo identity is disabled outside explicit prototype modes");
  return {
    viewer: {
      id: local ? "local-prototype-owner" : demoOwnerId,
      email: "local@prototype.invalid",
      name: local ? "Local workspace" : "Shared demo workspace",
    },
    accessToken: null,
  };
});
export const localAuth: AuthIntegration = {
  label: "Local prototype",
  middleware: [],
  Provider: ({ children }) => children,
  getSession,
  signInHref: () => "/",
  signUpHref: "/",
  signOutHref: "/",
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
    fetchAccessToken: async () => null,
  }),
};
