// The platform disclaimer is injected at render time so every app — past or
// future releases, imported or generated — shows it and generated code can
// neither omit nor reword it.
export function disclaimerText(name?: string) {
  return name
    ? `We are not financial advisors. ${name} provides information for educational purposes only and does not provide financial or investment advice.`
    : "We are not providing any financial advice.";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function disclaimerFooterHtml(name?: string) {
  return `<footer role="contentinfo" style="all:revert;padding:20px 24px 28px;text-align:center;font:400 12px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;color:#71717a;">${escapeHtml(disclaimerText(name))}</footer>`;
}

export function withDisclaimerFooter(html: string, name?: string) {
  const footer = disclaimerFooterHtml(name);
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${footer}</body>`)
    : `${html}${footer}`;
}
