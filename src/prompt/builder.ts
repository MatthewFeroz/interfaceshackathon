import type { PageLayout } from '../state/store.js';

export function buildRevisionPrompt(feedback: string): string {
  return `The user has provided feedback on the current preview:

"${feedback}"

Please:
1. Call get_layout() to get the current layout (it may have changed).
2. Revise the HTML based on the user's feedback.
3. Call show_preview(html) with the updated HTML.
4. Call get_user_feedback() to check if there are more revisions.
   If so, revise and call show_preview() again.`;
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
    extras.push(`Business description: ${layout.businessDescription}`);
  }
  if (layout.techStack?.length) {
    extras.push(`Tech stack preference: ${layout.techStack.join(', ')}`);
  }

  const extrasSection = extras.length
    ? `\n\nAdditional details:\n${extras.map(e => `- ${e}`).join('\n')}`
    : '';

  return `The user has designed a page layout in the visual builder with these sections:
${blockList}${extrasSection}

Please:
1. Call get_layout() to retrieve the full layout JSON with all block properties.
2. Generate a complete, self-contained HTML page implementing this layout.
   Use inline CSS, make it responsive, use https://placehold.co/ for images.
3. Call show_preview(html) with the full HTML so the user sees it immediately.
4. Call get_user_feedback() to check for revision requests.
   If feedback exists, revise and call show_preview() again.`;
}
