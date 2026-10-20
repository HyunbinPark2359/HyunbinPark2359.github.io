// Static-site checks. Usage: node scripts/check.mjs index.html douminuo.html
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const MAX_ASSET_BYTES = 6 * 1024 * 1024;
const BANNED = [['—', 'em dash'], ['–', 'en dash'], ['→', 'arrow'], [' · ', 'middle-dot meta']];
const REQUIRED = {
  'index.html': ['Open to co-op from January 2027', 'Douminuo', 'Trashpunk 2077', 'Touch the Grass', 'Other work', 'hp2359@rit.edu'],
  'douminuo.html': ['Problems along the way', '~160', '470', 'README.en.md'],
  'trashpunk-2077.html': ['Netcode for GameObjects', '7 people', 'In development'],
  'touch-the-grass.html': ['Maya', 'hp2359.itch.io/touch-the-grass'],
};

const fails = [];
const fail = (page, msg) => fails.push(`FAIL ${page}: ${msg}`);

function visibleText(html) {
  return html
    .replace(/<(script|style|pre|code)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

for (const page of process.argv.slice(2)) {
  if (!existsSync(page)) { fail(page, 'file missing'); continue; }
  const html = readFileSync(page, 'utf8');
  if (!/<html lang="en">/.test(html)) fail(page, 'missing <html lang="en">');
  if (!/<title>[^<]+<\/title>/.test(html)) fail(page, 'missing <title>');
  if (!/name="viewport"/.test(html)) fail(page, 'missing viewport meta');

  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/\balt="/.test(img)) fail(page, `img without alt: ${img.slice(0, 80)}`);
  }

  for (const [, ref] of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    const file = join(dirname(page), ref.split('#')[0]);
    if (!existsSync(file)) fail(page, `broken local link: ${ref}`);
  }

  const text = visibleText(html);
  for (const [ch, name] of BANNED) if (text.includes(ch)) fail(page, `banned ${name} in visible text`);

  let prev = 0;
  for (const [, lvl] of html.matchAll(/<h([1-6])\b/g)) {
    if (lvl - prev > 1) fail(page, `heading jumps from h${prev} to h${lvl}`);
    prev = +lvl;
  }

  for (const needle of REQUIRED[page] ?? []) {
    if (!html.includes(needle)) fail(page, `missing required content: ${needle}`);
  }
}

if (existsSync('assets')) {
  for (const f of readdirSync('assets')) {
    const size = statSync(join('assets', f)).size;
    if (size > MAX_ASSET_BYTES) fail('assets', `${f} is ${(size / 1048576).toFixed(1)} MB (max 6)`);
  }
}

console.log(fails.length ? fails.join('\n') : 'All checks passed');
process.exit(fails.length ? 1 : 0);
