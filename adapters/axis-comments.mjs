/**
 * Adapter: the axis-comments Web Bot Auth observing verifier (wba-observe.js)
 * driven against the webbotauth-negative-vectors set.
 *
 * Vector set: https://github.com/ParallaxGrain/webbotauth-negative-vectors
 * (CC0; axis-comments vendors it verbatim as wba-negative-vectors.json, at commit
 * dd489ba3a302e1009de5329dc359124dd1aed15a). The set's adapter contract is
 * its adapters/example.mjs: export verify(vector) → { outcome, reason }.
 * This file satisfies that contract, so the same code serves both:
 *
 *   node --test test-wba-vectors.js           (the axis-comments CI gate)
 *   node verify.mjs --adapter ./adapters/axis-comments.mjs   (this runner)
 *
 * What the adapter does — and deliberately does NOT do:
 *
 *   - It DRIVES the real observation path (observeWebBotAuth) with the
 *     vector's request, serves the vector's inline directory through a
 *     scripted fetch, pins the clock to vector.now, and reads back the one
 *     observation record the verifier wrote. No verification logic lives
 *     here; if the verifier is wrong, the run is red.
 *   - It TRANSLATES the record into the draft's Appendix C.1 vocabulary
 *     (verified / invalid / unverified) plus the set's proposed reason
 *     names. Translation only: every mapping below reads a conclusion the
 *     verifier already recorded. In particular, freshness: the verifier
 *     records crypto validity and freshness as separate fields on purpose
 *     (a valid-but-expired signature is its own population in the
 *     observation stream); C.1 has no such split, so verified+expired maps
 *     to invalid/expired here rather than in the record.
 */

// The verifier lives in the axis-comments repository. Point WBA_OBSERVE_MODULE
// at its wba-observe.js to run this adapter from here:
//   WBA_OBSERVE_MODULE=/path/to/axis-comments/wba-observe.js \
//     node verify.mjs --adapter ./adapters/axis-comments.mjs
import { pathToFileURL } from "node:url";
const modulePath = process.env.WBA_OBSERVE_MODULE;
if (!modulePath) throw new Error("set WBA_OBSERVE_MODULE to the path of axis-comments' wba-observe.js");
const { observeWebBotAuth, listWbaObservations } = await import(pathToFileURL(modulePath).href);

const WBA_TAG = "web-bot-auth";

// ---------------------------------------------------------------------------
// Record → draft vocabulary.
// ---------------------------------------------------------------------------

/** The verifier's named fault → the set's proposed reason name. Faults with
 *  no vocabulary name (directory fetch errors, unsupported components) map
 *  to null, which the upstream runner reports as PASS* when the outcome
 *  still matches. */
function reasonFromFailure(failure) {
  if (!failure) return null;
  if (failure.startsWith("signature_params_missing")) return "missing-fields";
  if (failure === "no_keyid_param") return "missing-fields";
  if (failure.startsWith("duplicate_covered_component")) return "duplicate-component";
  if (failure === "target_not_covered") return "target-not-covered";
  if (failure.startsWith("component_dict_member_missing:signature-agent")) {
    return "signature-agent-member-missing";
  }
  if (failure.startsWith("component_dict_member_missing")) return "missing-component";
  if (failure.startsWith("component_header_missing")) return "missing-component";
  if (failure.startsWith("canonicalization_mismatch")) return "canonicalization-mismatch";
  if (failure === "content_digest_mismatch") return "content-digest-mismatch";
  if (failure === "signature_invalid" || failure.startsWith("crypto_error")) return "bad-signature";
  if (failure === "no_signature_for_label" || failure === "signature_not_base64") {
    return "signature-value-unreadable";
  }
  if (failure === "no_signature_agent") return "signature-agent-absent";
  if (failure === "signature_agent_malformed") return "signature-agent-unparsable";
  if (failure === "agent_uri_unparseable") return "signature-agent-unparsable";
  if (failure === "no_agent_member_for_label") return "signature-agent-ambiguous-member";
  if (failure === "agent_uri_not_https") return "signature-agent-not-https";
  if (failure === "agent_uri_not_origin") return "signature-agent-not-origin";
  return null;
}

/** One observation record → { outcome, reason } in Appendix C.1 terms. */
export function mapRecordToDraftVocabulary(rec) {
  switch (rec.outcome) {
    case "verified":
      // Freshness is recorded beside validity, not inside it — fold here.
      if (rec.freshness === "expired") return { outcome: "invalid", reason: "expired" };
      if (rec.freshness === "created_in_future") return { outcome: "invalid", reason: "clock-ahead" };
      return { outcome: "verified", reason: null };
    case "malformed_signature_input":
      return { outcome: "invalid", reason: "signature-input-unreadable" };
    case "failed":
      return { outcome: "invalid", reason: reasonFromFailure(rec.failure) };
    case "unverifiable":
      return { outcome: "unverified", reason: reasonFromFailure(rec.failure) };
    case "ignored_tag":
    default:
      return { outcome: "unverified", reason: null };
  }
}

// ---------------------------------------------------------------------------
// Harness: in-memory KV, captured waitUntil, scripted fetch, pinned clock.
// ---------------------------------------------------------------------------

function memoryKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(key, value) { store.set(key, String(value)); },
    async list({ prefix, limit = 1000 }) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit);
      return { keys: keys.map((name) => ({ name })), list_complete: true };
    },
  };
}

/** The set's adapter contract: run one vector, return { outcome, reason }. */
export async function verify(vector) {
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  const realLog = console.log;
  try {
    // Serve the vector's inline directory; anything else 404s. Closed set —
    // a vector run must never touch the network (vectors use .test hosts).
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : input.url || String(input);
      const d = vector.directory;
      if (d && url === d.url) {
        return new Response(d.body, { status: d.status, headers: d.headers || {} });
      }
      return new Response("not found", { status: 404 });
    };
    Date.now = () => vector.now * 1000;
    console.log = () => {}; // keep the per-observation log line out of test output

    const env = { COMMENTS_KV: memoryKv() };
    const promises = [];
    const ctx = { waitUntil(p) { promises.push(p); } };
    const req = new Request(vector.request.url, {
      method: vector.request.method,
      headers: vector.request.headers,
      ...(vector.request.body !== undefined ? { body: vector.request.body } : {}),
    });
    observeWebBotAuth(req, env, ctx);
    await Promise.all(promises);

    const page = await listWbaObservations(env, { limit: 10 });
    const obs = page.observations[0];
    if (!obs) return { outcome: "unverified", reason: null };
    const rec = (obs.signatures || []).find((s) => s.tag === WBA_TAG) || (obs.signatures || [])[0];
    if (!rec) return { outcome: "unverified", reason: null };
    return mapRecordToDraftVocabulary(rec);
  } finally {
    globalThis.fetch = realFetch;
    Date.now = realNow;
    console.log = realLog;
  }
}
