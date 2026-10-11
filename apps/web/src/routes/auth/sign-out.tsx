// @if clerk
// import { useClerk } from "@clerk/tanstack-react-start";
// import { createFileRoute } from "@tanstack/react-router";
// import { useEffect } from "react";
//
// // Clerk signs out in the browser, so this runs on mount instead of in a loader.
// export const Route = createFileRoute("/auth/sign-out")({
//   component: SignOut,
// });
//
// function SignOut() {
//   const { signOut } = useClerk();
//   useEffect(() => {
//     void signOut({ redirectUrl: "/" });
//   }, [signOut]);
//   return null;
// }
// @endif
