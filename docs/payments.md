# Optional Payments

This starter ships without a billing provider selected. Pick one provider and keep the other out of the dependency graph.

## Dodo Payments

Install:

```bash
bun add @dodopayments/convex --cwd packages/backend
```

Set Convex env:

```bash
cd packages/backend
bunx convex env set DODO_PAYMENTS_API_KEY replace_me
bunx convex env set DODO_PAYMENTS_ENVIRONMENT test_mode
bunx convex env set DODO_PAYMENTS_WEBHOOK_SECRET replace_me
```

Wire the component in `packages/backend/convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import dodopayments from "@dodopayments/convex/convex.config";

const app = defineApp();
app.use(dodopayments);

export default app;
```

Then add a `packages/backend/convex/dodo.ts` client with an `identify` function based on the WorkOS subject claim.

Use Dodo when you want its merchant/payment platform and Convex-native checkout, customer portal, and webhook functions.
