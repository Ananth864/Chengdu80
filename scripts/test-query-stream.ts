import assert from "node:assert/strict";
import { createRequire } from "node:module";

const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url).href);
const integrationRequire = createRequire(webRequire.resolve("@tanstack/react-router-ssr-query"));
const { setupCoreRouterSsrQueryIntegration } = await import(
  integrationRequire.resolve("@tanstack/router-ssr-query-core")
);
const { QueryClient, dehydrate } = await import(webRequire.resolve("@tanstack/react-query"));
const errors: unknown[][] = [];
const originalError = console.error;
console.error = (...args) => errors.push(args);
try {
  for (const withData of [false, true]) {
    const queryClient = new QueryClient();
    const router: any = { isServer: false, options: {} };
    setupCoreRouterSsrQueryIntegration({ router, queryClient, handleRedirects: false });
    const source = new QueryClient();
    source.setQueryData(["stream-regression"], { value: 42 });
    const stream = new ReadableStream({
      start(controller) {
        if (withData) controller.enqueue(dehydrate(source));
        controller.close();
      },
    });
    await router.options.hydrate({ queryStream: stream });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(
      errors,
      [],
      "A closed query stream must not hydrate undefined: " + String(errors),
    );
    if (withData) assert.deepEqual(queryClient.getQueryData(["stream-regression"]), { value: 42 });
    source.clear();
    queryClient.clear();
    console.log(
      "PASS " +
        (withData
          ? "Streamed query data hydrates before a clean close"
          : "An empty query stream closes without the mutations TypeError"),
    );
  }
} finally {
  console.error = originalError;
}
