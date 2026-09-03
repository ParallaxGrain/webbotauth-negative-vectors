# Negative test vectors for Web Bot Auth

Requests that must not verify, for
[draft-ietf-webbotauth-httpsig-protocol-00](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/00/).
Offered against
[#11 — Consider negative test vectors](https://github.com/thibmeu/http-message-signatures-directory/issues/11).

Signed with the Ed25519 test key from RFC 9421 Appendix B.1.4 — the key the draft names for its own
vectors. Both halves are published in the RFC, so `generate.mjs` re-derives every byte here.

## Why

Appendix E shows what a verifier must accept. Nothing shows what it must reject, or what it should
say when it does. A rejected agent learns only that it was rejected: a malformed base, a fast clock,
an unreachable directory and a missing key arrive as one event.

Writing a negative vector forces the question, because it needs an expected *reason*, and Appendix
C.1 offers three outcomes and nothing below them.

## What each vector states

| Field | Status |
|---|---|
| `expected.outcome` | **normative** — Appendix C.1: `verified` / `invalid` / `unverified` |
| `expected.reason` | **proposed** — a finer vocabulary, `notes` explains each name |
| `enforcement` | how binding the rejection is (below) |

A verifier that wants none of the vocabulary checks `expected.outcome` alone and still gets a
complete run against the text as it stands.

`enforcement` is one of:

- `mechanical` — verification cannot succeed. Any verifier fails it. (8)
- `verifier-must` — the document tells the verifier what to do. (2)
- `discretionary` — the obligation is on the signer, or the document says MAY. The outcome shown is
  what a verifier that enforces produces. (7)

On `discretionary` and RFC 9421 §3.2.1. That section says an application "MUST enforce" the
additional requirements it defines, and that "signature verification MUST fail if the signature does
not conform". Read one way that makes every requirement in the draft a verification requirement and
nothing here discretionary. But the draft phrases these as obligations on the agent — "Agents MUST
include…" — and does not say which of them a verifier is to enforce at verification time. §5.4,
which is where it does address the verifier, gives four MAYs and one MUST. So the classification
here is a reading, and it is
marked as one: seven of seventeen rejections rest on a requirement whose enforcement the draft
leaves unstated.

## Conclude, not disclose

These vectors state what a verifier **concludes**. What it then puts on the wire is outside them.

The distinction is not ours. AVAVERIFY asked for it
[on #11](https://github.com/thibmeu/http-message-signatures-directory/issues/11#issuecomment-5428515850),
from a merchant-side verifier in production, with the reason: named reasons are the debugging value
a legitimate operator needs, and the same names returned unconditionally are a probing oracle for a
forger. Where that line falls is each deployment's policy, and a vector set should not draw it for
them.

The draft agrees by omission. It defines the conclusion — verified, invalid, unverified — and says
nothing about what a verifier must tell the caller. So a gateway that answers a bare `401` and
explains nothing can run this set and pass it, provided it reached the right conclusion inside.

## Outcome and reason are paired

A reason meaning the verifier could not decide never appears under `invalid`. Downstream software
switches on the outcome and would read such a pair as a rejection. `generate.mjs` refuses to write a
vector whose outcome disagrees with `notes`, and `verify.mjs` checks it again.

## Rules applied to every vector

1. **One fault, everything else correct.** Otherwise a verifier can legitimately blame something
   else and the vector isolates nothing. `generate.mjs` proves each signature verifies over its own
   base before writing.
2. **Closed.** No network. Where the request names an address, the directory response is inline and
   keyed to that same address. Hosts are in the reserved `.test` TLD (RFC 2606).
3. **Cites the text.** `basis` names the document, section and requirement in its own words. Where
   the requirement binds the signer and not the verifier, `basis.note` says so.
4. **Provenance stated.** `constructed`, or `observed-fault` — the fault was observed rather than
   invented, on live traffic or in a verifier, while the request itself is built to isolate it. Two
   carry it, NV-07 and NV-19. Each says which of the two, and what differs.

## Format

```
web-bot-auth-negative-vectors.json   all 17 in one file, plus notes and omitted
vectors/NV-xx-<slug>.json            one per vector, for review and diffs
vectors.src.mjs                      edit here — the JSON is generated, never edited by hand
notes.mjs                            the proposed reason vocabulary
lib/rfc9421-b14.mjs                  the RFC 9421 B.1.4 key, both halves
generate.mjs                         rebuild from the key         (--check for CI)
verify.mjs                           self-check, and run the set through your verifier
check-citations.mjs                  every quoted requirement, against the published source
adapters/example.mjs                 the adapter contract
```

```
node generate.mjs --check                        signatures reproduce from the key
node verify.mjs                                  the set is internally consistent
node verify.mjs --adapter ./adapters/YOURS.mjs   your verifier (copy example.mjs)
node check-citations.mjs                         every basis.requirement is verbatim (needs network)
```

`check-citations.mjs` downloads the -00 tag and RFC 9421 and asserts each quoted requirement appears
verbatim **and inside the section it cites**. Both halves are needed: a verbatim check catches a
requirement that reads like the document and is not in it, and only the section check catches a real
sentence cited under the wrong number, which a verbatim check passes happily.

`verify.mjs` contains no verifier: vector sets ship data, not runners. A verifier that has not
adopted the vocabulary
returns the outcome and leaves the reason null, which reports as `PASS*` — a pass on the normative
half.

Every vector carries `class: "request"`. A later set for failing directory responses would carry
`class: "directory"`.

## Coverage

17 of the 37 named failures this verifier reports. [COVERAGE.md](COVERAGE.md) accounts for the rest:
2 omitted because no outcome can be stated, 9 deferred until a directory-response vector shape
exists, 2 that cannot be static vectors, 7 excluded as implementation limits.

It also accounts for the set against the draft rather than against this verifier: every vector here
is a **single-signature request**, so the chaining requirements in §5.2.2 and the (URL, key) lookup
rule in §5.4 are untouched, and COVERAGE says why for each.

## Status

The document was adopted as a working group item on 2026-09-01 and its revision counter restarted
under the new name, so `-00` here is NEWER than the `-02` this set was first written against, not
older. The two revisions differ only in the document name, two links, and the capitalisation of
section headings. No normative sentence changed and no section number moved, so every citation and
every vector carries over untouched. `check-citations.mjs` now downloads the `-00` tag.

Draft, for review. Each vector was constructed against a working verifier, which is not vendored
here — `adapters/example.mjs` is a contract, not an implementation, so nothing in this repository
reproduces that run.

Two vectors record faults that verifier had: NV-17, which it disagreed with until it was aligned
with §5.5, and NV-19, whose `observed` field says what was measured. Both are disclosed because the
verifier changed to match the set, and a reader weighing the set should know that.

The verifier these counts come from is a live service, not vendored code. Its reference page lists
all 37 faults with the outcome and the fix for each, and says how to call it:
<https://packet.guru/agents/reference>
