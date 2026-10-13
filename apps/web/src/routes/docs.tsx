import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@web-starter/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@web-starter/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@web-starter/ui/components/table";
import { BookOpen, Download, FileCode2, ShieldCheck } from "lucide-react";
import { protocols, capabilityContracts } from "../lib/contracts";
import { download } from "../lib/client";
import { protocolInstructions, sampleBundle } from "../lib/samples";

export const Route = createFileRoute("/docs")({ component: Docs });

const nav = [
  { href: "#source", label: "Source format" },
  { href: "#sdk", label: "Browser SDK" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#protocols", label: "Protocols" },
  { href: "#verification", label: "Verification" },
  { href: "#privacy", label: "Privacy and updates" },
] as const;

function Docs() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-12 max-w-2xl">
        <span className="mb-3 block text-[10px] font-bold tracking-wide text-muted-foreground">
          PUBLIC DEVELOPER DOCUMENTATION · CONTRACT V1
        </span>
        <h1 className="my-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Build an app. Bring its source.
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use these protocols and APIs in any coding tool. Import the completed source into
          Chengdu80, pass the release checks, and accept its preview.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3.5">
          <a
            href="/api/docs"
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <BookOpen size={15} /> Machine-readable contract
          </a>
          <Button
            variant="outline"
            onClick={() =>
              download(
                "portfolio-example.cd80.json",
                JSON.stringify(sampleBundle(protocols[0].defaultSpec), null, 2),
              )
            }
          >
            <Download /> Download working source example
          </Button>
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-14">
        <aside className="flex flex-row flex-wrap gap-3 text-[11px] text-muted-foreground lg:sticky lg:top-8 lg:flex-col lg:gap-4 lg:self-start">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-foreground">
              {n.label}
            </a>
          ))}
        </aside>
        <article className="min-w-0 space-y-14">
          <section id="source" className="scroll-mt-8">
            <h2 className="mb-4 flex items-center gap-2.5 text-xl font-semibold tracking-tight">
              <FileCode2 size={20} /> Source format
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Upload one JSON source bundle with <code className="docs-code">manifest</code> and{" "}
              <code className="docs-code">files</code>, or select the five files below together. The
              first prototype supports self-contained browser applications and a pure JavaScript
              calculation module. It does not install packages or run arbitrary server frameworks.
            </p>
            <Table className="mb-4">
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Contract</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-primary/80">cd80.json</TableCell>
                  <TableCell>Manifest with schemaVersion, name, protocol, permissions</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-primary/80">index.html</TableCell>
                  <TableCell>
                    Body fragment. No scripts, executable handlers, forms, embedded frames, or
                    external resources.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-primary/80">app.js</TableCell>
                  <TableCell>
                    Browser JavaScript. May use top-level await. No module imports or remote
                    scripts.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-primary/80">calculations.js</TableCell>
                  <TableCell>
                    Self-contained ES module exporting analyze(input). Runs in a separate Worker.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-primary/80">style.css</TableCell>
                  <TableCell>
                    App styling. Fonts and other external resources are unavailable.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <pre className="docs-pre">
              {JSON.stringify(
                {
                  schemaVersion: 1,
                  name: "My portfolio app",
                  protocol: "portfolio",
                  permissions: [
                    "finance.calculate",
                    "storage.read",
                    "storage.write",
                    "market.prices",
                    "ai.explain",
                  ],
                },
                null,
                2,
              )}
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The upload limit is 250 KB. Imported updates must retain the app's existing protocol.
              Import source while an app is selected to create an update preview; choose New
              application first to create a separate app.
            </p>
          </section>
          <section id="sdk" className="scroll-mt-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Browser SDK</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              The host installs <code className="docs-code">window.cd80</code> before your app runs.
              Its calls use a validated message bridge. Applications receive no model, database, or
              provider credentials.
            </p>
            <pre className="docs-pre">{`const inputs = await cd80.call("storage.read", { key: "inputs" });
const result = await cd80.call("finance.calculate", inputs);
document.getElementById("result").textContent = JSON.stringify(result);
cd80.ready();

// Accepted apps may save shared inputs. Previews are read-only.
await cd80.call("storage.write", { key: "inputs", value: inputs });`}</pre>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Calls return a Promise and reject on missing permissions, invalid data, or unavailable
              services. Call <code className="docs-code">cd80.ready()</code> after rendering. Use
              DOM textContent or escape user data before inserting HTML.
            </p>
          </section>
          <section id="capabilities" className="scroll-mt-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Capability catalog</h2>
            <Table className="mb-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(capabilityContracts).map(([name, contract]) => (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-primary/80">{name}</TableCell>
                    <TableCell>{contract.input}</TableCell>
                    <TableCell>{contract.output}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              The key <code className="docs-code">inputs</code> initially contains the selected
              protocol's default input object. Storage keys contain 1–50 letters, digits,
              underscores, or hyphens. Shared data is limited to 150 KB. Calculation inputs and
              responses have size limits. No direct network access is allowed from app code.
            </p>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Read <code className="docs-code">_provenance</code> for the saved input dataset's
              origin. Keys beginning with an underscore are reserved and cannot be written by app
              code. Editing inputs changes their provenance to user-entered data. AI explanations
              use calculations recomputed on the server from the saved inputs.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Finance providers are adapters to this normalized contract. Tushare prices are
              unadjusted daily closes in CNY. Missing fundamentals remain missing. Fixture data is
              invented and clearly labelled. The Alpha Vantage public demo is a narrow platform
              connection test. In local mode, Strategy apps can load its fixed Shanghai stock
              history from Connections. It is not a production feed available to generated apps.
            </p>
          </section>
          <section id="protocols" className="scroll-mt-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Application protocols</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              The builder chooses its own UI and implementation under the confirmed specification
              and protocol. This explanatory plan does not execute a workflow graph.
            </p>
            <div className="space-y-5">
              {protocols.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="text-[15px]">
                      {p.name} · {p.id} · version 1
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5">
                      {p.rules.map((r) => (
                        <li key={r} className="text-sm leading-relaxed text-muted-foreground">
                          {r}
                        </li>
                      ))}
                    </ul>
                    <h4 className="mt-5 mb-2 text-[11px] font-semibold text-muted-foreground">
                      Independent verification fixture
                    </h4>
                    <pre className="docs-pre">{JSON.stringify(p.fixture, null, 2)}</pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      onClick={() =>
                        download(
                          `${p.id}-protocol.txt`,
                          protocolInstructions(p.defaultSpec),
                          "text/plain",
                        )
                      }
                    >
                      Download builder instructions
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          <section id="verification" className="scroll-mt-8">
            <h2 className="mb-4 flex items-center gap-2.5 text-xl font-semibold tracking-tight">
              <ShieldCheck size={20} /> Release checks
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Every build and source import checks its manifest, source syntax, required
              permissions, potential embedded credentials, HTML isolation, exported calculation
              function, protocol numerical fixture, boundary values, and invalid inputs. Calculation
              checks execute in workerd locally or Worker Loader when hosted, without provider
              secrets or outbound network.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These tests validate the published protocol contract. They do not certify every
              additional custom calculation. Review custom logic and the rendered preview before
              accepting it. Failed checks block execution and release acceptance. The stored SHA-256
              binds verification to the exact source bundle.
            </p>
          </section>
          <section id="privacy" className="scroll-mt-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">Privacy and updates</h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Login is deferred for the prototype. Hosted demo visitors share one workspace. In
              future account mode, apps are private to the owning account. All users allowed to
              access an app share its app data. Team membership and public publishing are deferred.
              Local mode is a labelled single-owner workspace bound to this computer; it is not
              hosted authentication.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A follow-up request or source import creates a verified preview. The accepted version
              keeps running. Preview storage is read-only, and accepting the preview retains shared
              app data. Protocol-changing imports require a new app.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
