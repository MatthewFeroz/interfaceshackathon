import type { PageLayout, Block } from '../state/store.js';

const BLOCK_HINTS: Record<string, string> = {
  hero: 'full-width hero with headline, subheading, CTA button, and background treatment',
  features: 'feature grid/cards with icons or emoji, short titles, and descriptions',
  pricing: 'pricing tier cards with plan names, prices, feature lists, and CTA buttons',
  testimonials: 'testimonial cards with quotes, names, roles, and optional photos',
  faq: 'accordion-style FAQ with questions and expandable answers',
  contact: 'contact section with form fields (name, email, message) and submit button',
  footer: 'footer with links, copyright, and optional social icons',
  navbar: 'sticky navigation bar with logo and menu links',
  gallery: 'image gallery grid with hover effects',
  team: 'team member cards with photos, names, and roles',
  cta: 'call-to-action banner with compelling text and button',
  stats: 'statistics section with large numbers and labels',
  logo_cloud: 'logo cloud showing partner/client logos',
};

function describeBlock(block: Block, index: number): string {
  const hint = BLOCK_HINTS[block.type] || block.type;
  return `${index + 1}. **${block.type}** — ${hint}`;
}

export function buildRevisionPrompt(feedback: string): string {
  return `Revision request: "${feedback}"

Call get_layout() for any layout changes, revise the HTML, then call show_preview(html). Be concise — just make the change and show the result.`;
}

export function buildGeneratePrompt(layout: PageLayout): string {
  const blockList = layout.blocks
    .map((b, i) => describeBlock(b, i))
    .join('\n');

  const extras: string[] = [];

  if (layout.theme) {
    extras.push(`Theme: ${layout.theme}`);
  }
  if (layout.accentColor) {
    extras.push(`Accent color: ${layout.accentColor} — use for buttons, links, highlights, gradients`);
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
