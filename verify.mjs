#!/usr/bin/env node
/**
 * Two jobs, kept separate.
 *
 *   node verify.mjs                          SELF-CHECK. No verifier involved.
 *   node verify.mjs --adapter ./adapters/x.mjs   run every vector through YOUR verifier.
 *
 * There is no verifier here. Every one has its own entry point, so the adapter is a short function
 * you write once — the contract is in adapters/example.mjs.
 *
 * The self-check needs no verifier and is what CI runs.
 */
import { createPublicKey, verify as edVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PUBLIC_PEM } from './lib/rfc9421-b14.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const suite = JSON.parse(readFileSync(join(HERE, 'web-bot-auth-negative-vectors.json'), 'utf8'));
const tests = suite.testGroups.flatMap((g) => g.tests);
const publicKey = createPublicKey(PUBLIC_PEM);

let failed = 0;
const bad = (id, msg) => { failed++; console.error(`FAIL  ${id}  ${msg}`); };

// ── Self-check ───────────────────────────────────────────────────────────────
if (tests.length !== suite.numberOfTests) bad('suite', `numberOfTests says ${suite.numberOfTests}, groups hold ${tests.length}`);
const ids = new Set();
for (const v of tests) {
  if (ids.has(v.id)) bad(v.id, 'duplicate id');
  ids.add(v.id);

  // 1. The signature is a real signature over the base the signer built. This is the invariant that
  //    keeps each vector about ONE fault: anything a verifier could otherwise blame must be correct.
  const m = /^[^=]+=:(.+):$/.exec(v.request.headers.Signature);
  if (!m) { bad(v.id, 'Signature header is not label=:base64:'); continue; }
  const ok = edVerify(null, Buffer.from(v.signature.signedBase, 'utf8'), publicKey, Buffer.from(m[1], 'base64'));
  if (!ok) bad(v.id, 'signature does not verify over its own signedBase');

  // 2. The declared reason exists in the vocabulary and agrees with it on the normative outcome.
  const note = suite.notes[v.expected.reason];
  if (!note) bad(v.id, `reason "${v.expected.reason}" is not in notes`);
  else if (note.outcome !== v.expected.outcome) bad(v.id, `outcome disagrees with notes (${v.expected.outcome} vs ${note.outcome})`);

  // 3. baseDiffers is a claim about the vector and must match the bases it ships.
  if (v.signature.baseDiffers !== (v.signature.expectedBase !== v.signature.signedBase)) {
    bad(v.id, 'baseDiffers does not match signedBase/expectedBase');
  }

  // 4. Nothing here may need the network. A vector either ships the directory response inline,
  //    keyed to the address the header names, or states in directoryNote why none exists — so host
  //    resolution never decides what a verifier reports, and silence is never accidental.
  const named = v.request.headers['Signature-Agent'];
  if (!v.directory?.body && !v.directoryNote) bad(v.id, 'no inline directory and no directoryNote saying why');
  if (v.directory) {
    if (!new URL(v.directory.url).hostname.endsWith('.test')) bad(v.id, 'directory host is not in the reserved .test TLD');
    const m = /"([^"]*)"/.exec(named ?? '');
    if (m && !v.directory.url.startsWith(m[1].replace(/\/$/, ''))) bad(v.id, 'inline directory url does not match the address in Signature-Agent');
  }

  // 5. enforcement must be one of the three, so no vector can imply an obligation it does not have.
  if (!['mechanical', 'verifier-must', 'discretionary'].includes(v.enforcement)) bad(v.id, `unknown enforcement "${v.enforcement}"`);
}
console.log(`self-check: ${tests.length - failed} of ${tests.length} vectors consistent`);

// ── Adapter run ──────────────────────────────────────────────────────────────
const i = process.argv.indexOf('--adapter');
if (i !== -1) {
  const path = process.argv[i + 1];
  if (!path) { console.error('--adapter needs a path'); process.exit(2); }
  const { verify } = await import(pathToFileURL(resolve(path)).href);
  if (typeof verify !== 'function') { console.error(`${path} does not export verify()`); process.exit(2); }
  let pass = 0, skip = 0;
  console.log('');
  for (const v of tests) {
    const got = await verify(v);
    if (got === null || got === undefined) { skip++; console.log(`SKIP  ${v.id}  adapter returned nothing`); continue; }
    const hit = got.outcome === v.expected.outcome;
    const named = got.reason === v.expected.reason;
    if (hit) pass++;
    console.log(
      `${hit ? (named ? 'PASS' : 'PASS*') : 'FAIL'}  ${v.id}  ${v.expected.outcome}/${v.expected.reason}` +
      (hit && named ? '' : `   got ${got.outcome}/${got.reason ?? '-'}`));
  }
  // PASS* means the normative outcome matched and only the proposed reason differs. That is a
  // conformant verifier that has not adopted the vocabulary, not a failure, and it is reported
  // separately so the two questions never get confused.
  console.log(`\nadapter: ${pass} of ${tests.length} matched the normative outcome` + (skip ? `, ${skip} skipped` : ''));
  if (pass !== tests.length - skip) failed++;
}

process.exit(failed ? 1 : 0);
