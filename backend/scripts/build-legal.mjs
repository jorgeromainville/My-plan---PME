// Genera las páginas legales públicas (HTML) a partir de `docs/legal/*.md`.
//
// Play Console exige una URL abierta, sin sesión, para la política de privacidad
// y para la eliminación de cuenta. El repo es privado, así que GitHub Pages no
// sirve: las páginas se publican desde el backend que ya corre en Render.
//
//   npm run build:legal      (se ejecuta también dentro de `npm run build`)
//
// Solo entiende el subconjunto de Markdown que usan esos archivos: títulos,
// párrafos, listas, **negrita**, `código` y enlaces.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(here, '..', '..', 'docs', 'legal');
const outDir = join(here, '..', 'public', 'legal');

if (!existsSync(sourceDir)) {
  console.warn('build:legal — no existe docs/legal, se omite.');
  process.exit(0);
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

/** Separa el front matter (`--- título ---`) del cuerpo. */
function parse(text) {
  let title = '';
  let body = text;
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (fm) {
    const m = /^title:\s*(.+)$/m.exec(fm[1]);
    if (m) title = m[1].trim();
    body = text.slice(fm[0].length);
  }
  return { title, body };
}

function toHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let list = [];
  let paragraph = [];

  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = [];
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flush();
  return html.join('\n');
}

function page({ title, slug, content }) {
  const label = title || 'My Plan';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(label)}</title>
<meta name="description" content="${escapeHtml(label)} de My Plan, app de organización personal.">
<meta name="robots" content="index, follow">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #FAF6EF;
    color: #22271F;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .band { height: 6px; background: linear-gradient(90deg, #E07A5F 0%, #C9A44A 35%, #6FA287 70%, #6B9ECF 100%); }
  main { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 1.5rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem; }
  h3 { font-size: 1rem; margin: 1.5rem 0 0.4rem; }
  p, li { margin: 0 0 0.75rem; }
  ul { padding-left: 1.25rem; }
  a { color: #2F6B4F; text-underline-offset: 2px; }
  code { background: #F5EFE3; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.92em; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #EDE6D6; font-size: 0.875rem; color: #656A65; }
  footer a { color: inherit; }
  @media (prefers-color-scheme: dark) {
    body { background: #12140F; color: #F2F0E9; }
    code { background: #23261E; }
    footer { border-top-color: #2B2F26; color: #9AA093; }
    a { color: #8FD0AE; }
  }
</style>
</head>
<body>
<div class="band"></div>
<main>
${content}
<footer>
  <p><a href="/legal/">Legal de My Plan</a> · <a href="/legal/privacidad">Privacidad</a> · <a href="/legal/terminos">Términos</a> · <a href="/legal/eliminar-cuenta">Eliminar cuenta</a></p>
</footer>
</main>
</body>
</html>
`;
}

mkdirSync(outDir, { recursive: true });

const files = readdirSync(sourceDir).filter((f) => f.endsWith('.md') && f !== 'LEEME.md');
let written = 0;

for (const file of files) {
  const raw = readFileSync(join(sourceDir, file), 'utf8');
  const { title, body } = parse(raw);
  const slug = file.replace(/\.md$/, '');
  const html = page({ title, slug, content: toHtml(body) });
  writeFileSync(join(outDir, `${slug}.html`), html, 'utf8');
  written += 1;
  console.log(`build:legal — ${file} → public/legal/${slug}.html`);
}

console.log(`build:legal — ${written} página(s).`);
