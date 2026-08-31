#!/usr/bin/env node
/**
 * Checks that every `basis.requirement` appears verbatim in the document it cites, AND that it lies
 * inside the section `basis.section` names.
 *
 * The verbatim half catches a requirement that reads like the document and is not in it. The
 * section half catches a real sentence cited under the wrong number, which a verbatim check passes.
 *
 * Needs the network, so it is not part of `npm run check`. Run after any edit to a basis.
 *
 *   node check-citations.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const suite = JSON.parse(readFileSync(join(HERE, 'web-bot-auth-negative-vectors.json'), 'utf8'));

const DRAFT = 'draft-meunier-webbotauth-httpsig-protocol-02';
const RFC = 'RFC 9421';
const SOURCES = {
  [DRAFT]: 'https://raw.githubusercontent.com/thibmeu/http-message-signatures-directory/draft-meunier-webbotauth-httpsig-protocol-02/draft-meunier-webbotauth-httpsig-protocol.md',
  // ietf.org refuses this fetcher; rfc-editor.org serves the same text.
  [RFC]: 'https://www.rfc-editor.org/rfc/rfc9421.txt',
};

const norm = (t) => t.replace(/[`]/g, '').replace(/’/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Section index for the kramdown-rfc draft.
 *
 * `#` is a top-level section; after the `--- back` marker they become lettered appendices, which is
 * why the list calls the possession proof "B.1" and the test vectors "E.2.1" while the source shows
 * neither number. Also collects `{#anchor}` labels so a cross-reference written as `{{anchor}}` can
 * be resolved to the number the published document prints.
 */
function indexDraft(raw) {
  const lines = raw.split('\n');
  const backAt = lines.findIndex((l) => l.trim() === '--- back');
  const counts = [0, 0, 0, 0, 0, 0];
  const sections = [];
  const anchors = new Map();
  let reset = false;
  lines.forEach((line, i) => {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!m) return;
    const back = backAt !== -1 && i > backAt;
    // Appendices restart their own count at `--- back`; without this the body's eight sections carry
    // over and the possession proof comes out as "J.1" instead of the "B.1" the list cites.
    if (back && !reset) { counts.fill(0); reset = true; }
    const lvl = m[1].length;
    counts[lvl - 1] += 1;
    for (let j = lvl; j < 6; j++) counts[j] = 0;
    const top = back ? String.fromCharCode(64 + counts[0]) : String(counts[0]);
    const label = [top, ...counts.slice(1, lvl)].join('.');
    const id = (back ? 'Appendix ' : '') + label;
    sections.push({ id, line: i });
    const a = /\{#([^}]+)\}/.exec(m[2]);
    if (a) anchors.set(a[1], id.replace(/^Appendix /, ''));
  });
  sections.forEach((s, k) => { s.end = k + 1 < sections.length ? sections[k + 1].line : lines.length; });
  return { lines, sections, anchors };
}

/** Section index for an RFC text: headings sit at column 0 as "4.1.  Title". */
function indexRfc(raw) {
  const lines = raw.split('\n');
  const sections = [];
  lines.forEach((line, i) => {
    const m = /^(\d+(?:\.\d+)*)\.\s{2}\S/.exec(line);
    if (m && i > 200) sections.push({ id: m[1], line: i });   // skip the table of contents
  });
  sections.forEach((s, k) => { s.end = k + 1 < sections.length ? sections[k + 1].line : lines.length; });
  return { lines, sections };
}

const text = {};
for (const [name, url] of Object.entries(SOURCES)) {
  const res = await fetch(url);
  if (!res.ok) { console.error(`cannot fetch ${name}: HTTP ${res.status}`); process.exit(2); }
  const raw = await res.text();
  text[name] = name === DRAFT ? { raw, ...indexDraft(raw) } : { raw, ...indexRfc(raw) };
  console.log(`fetched ${name}`);
}

/** The published document expands `{{anchor}}` to a section number; do the same before comparing. */
function expandAnchors(s) {
  return s.replace(/\{\{([^}]*?)\}\}/g, (_, inner) => {
    const n = text[DRAFT].anchors.get(inner);
    return n ? `Section ${n}` : inner;
  });
}

const sectionText = (doc, id) => {
  const want = id.replace(/^Appendix\s+/, '');
  const hit = text[doc].sections.find((s) => s.id.replace(/^Appendix\s+/, '') === want);
  if (!hit) return null;
  return norm(expandAnchors(text[doc].lines.slice(hit.line, hit.end).join('\n')).replace(/^:\s*/gm, ' '));
};

const whole = {};
for (const d of Object.keys(SOURCES)) whole[d] = norm(expandAnchors(text[d].raw).replace(/^:\s*/gm, ' '));

const tests = suite.testGroups.flatMap((g) => g.tests);
let bad = 0;
for (const v of tests) {
  const doc = v.basis.document;
  const req = norm(expandAnchors(v.basis.requirement));
  // Split on every sentence boundary, so a fabrication cannot hide behind a real neighbour.
  const parts = req.split(/\s*\.\.\.\s*|(?<=\.)\s+/).map((p) => p.trim()).filter((p) => p.length > 25);
  const clauses = parts.length ? parts : [req];
  const missing = clauses.filter((p) => !whole[doc].includes(p.replace(/\.$/, '')));
  const sec = sectionText(doc, v.basis.section);
  const outside = sec === null ? clauses : clauses.filter((p) => !sec.includes(p.replace(/\.$/, '')));

  if (missing.length) {
    bad++; console.error(`FAIL ${v.id}  not in ${doc} at all:`);
    for (const m of missing) console.error(`       ${m.slice(0, 140)}`);
  } else if (sec === null) {
    bad++; console.error(`FAIL ${v.id}  ${doc} has no section "${v.basis.section}"`);
  } else if (outside.length) {
    bad++; console.error(`FAIL ${v.id}  verbatim, but not inside ${doc} ${v.basis.section}:`);
    for (const m of outside) console.error(`       ${m.slice(0, 140)}`);
  } else {
    console.log(`ok   ${v.id}  [${doc} ${v.basis.section}]`);
  }
}
console.log(`\n${tests.length - bad} of ${tests.length} citations verbatim AND inside the section they cite`);
process.exit(bad ? 1 : 0);
