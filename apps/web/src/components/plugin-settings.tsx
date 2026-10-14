import { useEffect, useState } from "react";
import { Button } from "@web-starter/ui/components/button";
import { Input } from "@web-starter/ui/components/input";
import { Textarea } from "@web-starter/ui/components/textarea";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@web-starter/ui/components/field";
import { Alert, AlertDescription } from "@web-starter/ui/components/alert";
import { Separator } from "@web-starter/ui/components/separator";
import type { RegisteredPlugin } from "../lib/plugins";

export function PluginSettings() {
  const [plugins, setPlugins] = useState<RegisteredPlugin[]>([]);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [credentialEnv, setCredentialEnv] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/plugins")
      .then(async (response) => {
        const data: { plugins?: RegisteredPlugin[]; error?: string } = await response.json();
        if (active) {
          setPlugins(data.plugins ?? []);
          if (data.error) setError(data.error);
        }
      })
      .catch(() => {
        if (active) setError("Could not load plugins");
      });
    return () => {
      active = false;
    };
  }, []);
  async function register() {
    setBusy(true);
    setError("");
    try {
      const source = document.trim();
      const response = await fetch("/api/plugins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          ...(/^https?:\/\//.test(source) ? { schemaUrl: source } : { document: source }),
          ...(credentialEnv.trim() ? { credentialEnv: credentialEnv.trim() } : {}),
        }),
      });
      const result: { plugin?: RegisteredPlugin; error?: string } = await response.json();
      if (!response.ok || !result.plugin) throw new Error(result.error ?? "Registration failed");
      setPlugins((previous) => [...previous, result.plugin!]);
      setName("");
      setDocument("");
      setCredentialEnv("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="plugin-name">Plugin name</FieldLabel>
          <Input id="plugin-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="plugin-document">OpenAPI document or URL</FieldLabel>
          <Textarea
            id="plugin-document"
            rows={6}
            value={document}
            onChange={(event) => setDocument(event.target.value)}
          />
          <FieldDescription>
            OpenAPI 3 JSON or YAML. The system registers operations for the AI and your apps.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="plugin-credential">Credential environment variable</FieldLabel>
          <Input
            id="plugin-credential"
            placeholder="CD80_PLUGIN_WEATHER_KEY"
            value={credentialEnv}
            onChange={(event) => setCredentialEnv(event.target.value)}
          />
          <FieldDescription>
            Optional. Set the secret on the server; enter only its variable name here.
          </FieldDescription>
        </Field>
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button disabled={busy || !name.trim() || !document.trim()} onClick={() => void register()}>
        {busy ? "Registering…" : "Register plugin"}
      </Button>
      <Separator />
      {plugins.map((plugin) => (
        <div key={plugin.id} className="flex flex-col gap-2">
          <p>{plugin.name}</p>
          <ul>
            {plugin.operations.map((operation) => (
              <li key={operation.operationId}>
                <code>
                  {operation.method} {operation.path}
                </code>{" "}
                · {operation.operationId}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
