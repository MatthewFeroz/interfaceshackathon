import type { PageLayout } from '../state/store.js';

export function buildRevisionPrompt(feedback: string): string {
  return `Revision request: "${feedback}"

Call get_layout() for any layout changes, revise the HTML, then call show_preview(html). Be concise — just make the change and show the result.`;
}

export function buildGeneratePrompt(layout: PageLayout): string {
  const blockList = layout.blocks
    .map((b, i) => `${i + 1}. ${b.type}`)
    .join('\n');

  const extras: string[] = [];

  if (layout.theme) {
    extras.push(`Theme: ${layout.theme}`);
  }
  if (layout.accentColor) {
    extras.push(`Accent color: ${layout.accentColor}`);
  }
  if (layout.businessDescription) {
    extras.push(`Business: ${layout.businessDescription}`);
  }
  if (layout.techStack?.length) {
    extras.push(`Tech stack: ${layout.techStack.join(', ')}`);
  }

  const extrasSection = extras.length
    ? `\n${extras.map(e => `- ${e}`).join('\n')}`
    : '';

  return `Generate a website with these sections:
${blockList}${extrasSection}

Steps: get_layout() → generate HTML → show_preview(html). Go.`;
}
