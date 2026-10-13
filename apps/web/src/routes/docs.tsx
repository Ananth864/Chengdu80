import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@web-starter/ui/components/button";
import { BookOpen, Download, FileCode2, ShieldCheck } from "lucide-react";
import { protocols, capabilityContracts } from "../lib/contracts";
import { download } from "../lib/client";
import { protocolInstructions, sampleBundle } from "../lib/samples";

export const Route = createFileRoute("/docs")({ component: Docs });
function Docs() {
  return (
    <main className="docs-page">
      <div className="docs-heading">
        <span className="eyebrow">PUBLIC DEVELOPER DOCUMENTATION · CONTRACT V1</span>
        <h1>Build an app. Bring its source.</h1>
        <p>
          Use these protocols and APIs in any coding tool. Import the completed source into
          Chengdu80, pass the release checks, and accept its preview.
        </p>
        <div className="docs-buttons">
          <a className="doc-link" href="/api/docs">
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
      <div className="docs-layout">
        <aside>
          <a href="#source">Source format</a>
          <a href="#sdk">Browser SDK</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#protocols">Protocols</a>
          <a href="#verification">Verification</a>
          <a href="#privacy">Privacy and updates</a>
        </aside>
        <article>
          <section id="source">
            <h2>
              <FileCode2 size={20} /> Source format
            </h2>
            <p>
              Upload one JSON source bundle with <code>manifest</code> and <code>files</code>, or
              select the five files below together. The first prototype supports self-contained
              browser applications and a pure JavaScript calculation module. It does not install
              packages or run arbitrary server frameworks.
            </p>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Contract</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>cd80.json</td>
                  <td>Manifest with schemaVersion, name, protocol, permissions</td>
                </tr>
                <tr>
                  <td>index.html</td>
                  <td>
                    Body fragment. No scripts, executable handlers, forms, embedded frames, or
                    external resources.
                  </td>
                </tr>
                <tr>
                  <td>app.js</td>
                  <td>
                    Browser JavaScript. May use top-level await. No module imports or remote
                    scripts.
                  </td>
                </tr>
                <tr>
                  <td>calculations.js</td>
                  <td>
                    Self-contained ES module exporting analyze(input). Runs in a separate Worker.
                  </td>
                </tr>
                <tr>
                  <td>style.css</td>
                  <td>App styling. Fonts and other external resources are unavailable.</td>
                </tr>
              </tbody>
            </table>
            <pre>
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
            <p>
              The upload limit is 250 KB. Imported updates must retain the app's existing protocol.
              Import source while an app is selected to create an update preview; choose New
              application first to create a separate app.
            </p>
          </section>
          <section id="sdk">
            <h2>Browser SDK</h2>
            <p>
              The host installs <code>window.cd80</code> before your app runs. Its calls use a
              validated message bridge. Applications receive no model, database, or provider
              credentials.
            </p>
            <pre>{`const inputs = await cd80.call("storage.read", { key: "inputs" });
const result = await cd80.call("finance.calculate", inputs);
document.getElementById("result").textContent = JSON.stringify(result);
cd80.ready();

// Accepted apps may save shared inputs. Previews are read-only.
await cd80.call("storage.write", { key: "inputs", value: inputs });`}</pre>
            <p>
              Calls return a Promise and reject on missing permissions, invalid data, or unavailable
              services. Call <code>cd80.ready()</code> after rendering. Use DOM textContent or
              escape user data before inserting HTML.
            </p>
          </section>
          <section id="capabilities">
            <h2>Capability catalog</h2>
            <table>
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Request</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(capabilityContracts).map(([name, contract]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{contract.input}</td>
                    <td>{contract.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              The key <code>inputs</code> initially contains the selected protocol's default input
              object. Storage keys contain 1–50 letters, digits, underscores, or hyphens. Shared
              data is limited to 150 KB. Calculation inputs and responses have size limits. No
              direct network access is allowed from app code.
            </p>
            <p>
              Read <code>_provenance</code> for the saved input dataset's origin. Keys beginning
              with an underscore are reserved and cannot be written by app code. Editing inputs
              changes their provenance to user-entered data. AI explanations use calculations
              recomputed on the server from the saved inputs.
            </p>
            <p>
              Finance providers are adapters to this normalized contract. Tushare prices are
              unadjusted daily closes in CNY. Missing fundamentals remain missing. Fixture data is
              invented and clearly labelled. The Alpha Vantage public demo is a narrow platform
              connection test. In local mode, Strategy apps can load its fixed Shanghai stock
              history from Connections. It is not a production feed available to generated apps.
            </p>
          </section>
          <section id="protocols">
            <h2>Application protocols</h2>
            <p>
              The builder chooses its own UI and implementation under the confirmed specification
              and protocol. This explanatory plan does not execute a workflow graph.
            </p>
            {protocols.map((p) => (
              <div key={p.id} className="protocol-doc">
                <h3>
                  {p.name} · {p.id} · version 1
                </h3>
                <ul>
                  {p.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <h4>Independent verification fixture</h4>
                <pre>{JSON.stringify(p.fixture, null, 2)}</pre>
                <Button
                  size="sm"
                  variant="outline"
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
              </div>
            ))}
          </section>
          <section id="verification">
            <h2>
              <ShieldCheck size={20} /> Release checks
            </h2>
            <p>
              Every build and source import checks its manifest, source syntax, required
              permissions, potential embedded credentials, HTML isolation, exported calculation
              function, protocol numerical fixture, boundary values, and invalid inputs. Calculation
              checks execute in workerd locally or Worker Loader when hosted, without provider
              secrets or outbound network.
            </p>
            <p>
              These tests validate the published protocol contract. They do not certify every
              additional custom calculation. Review custom logic and the rendered preview before
              accepting it. Failed checks block execution and release acceptance. The stored SHA-256
              binds verification to the exact source bundle.
            </p>
          </section>
          <section id="privacy">
            <h2>Privacy and updates</h2>
            <p>
              Login is deferred for the prototype. Hosted demo visitors share one workspace. In
              future account mode, apps are private to the owning account. All users allowed to
              access an app share its app data. Team membership and public publishing are deferred.
              Local mode is a labelled single-owner workspace bound to this computer; it is not
              hosted authentication.
            </p>
            <p>
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
