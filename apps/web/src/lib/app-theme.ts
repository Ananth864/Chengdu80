// Embedded in exported bundles because isolated apps cannot inherit the workspace CSS.
export const appThemeCss = `:root {
  --background: #f7f5f0;
  --foreground: #2c302d;
  --card: #fffefa;
  --primary: #28645b;
  --primary-foreground: #ffffff;
  --muted: #eeece5;
  --muted-foreground: #64685f;
  --border: #deded3;
  --input: #bcbfb3;
  --ring: #36796d;
  --accent: #e5efe8;
  --accent-foreground: #24574e;
  --destructive: #a33d37;
  --radius-card: 20px;
  --radius-control: 12px;
  --font-sans: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}`;

export const appThemeInstructions = `Visual theme: Warm Professional, matching the Chengdu80 workspace.
Include these exact shared CSS declarations in style.css and use their variables throughout the app:
${appThemeCss}
Use warm ivory backgrounds, charcoal text, muted teal actions and charts, 20px soft card corners, 12px control corners, subtle borders and gentle shadows. Use locally available system fonts, readable 16px body/input text, generous spacing, tabular financial numbers, visible keyboard focus, and controls at least 40px tall. Reserve red for errors or losses; never rely on color alone. Keep layouts responsive without page-level horizontal scrolling, and put wide tables in scrollable containers. Use plain-language labels and one clear primary action per section. You may adapt the layout to the confirmed specification, but keep this palette and soft-edged visual language for new builds and updates. Apps are self-contained HTML/CSS/JS: do not import React, shadcn, external fonts, or packages; reproduce the workspace's component styling with local CSS.`;
