# Coverage: all 37 named failures

The verifier behind this set names 37 ways a signed request can fail
(<https://packet.guru/agents/reference>). Not all belong in a vector set. This accounts for each.

| | |
|---|---|
| **In this set** | **17** |
| Omitted — no outcome can be stated | 2 |
| Deferred — need a directory-response vector shape | 9 |
| Not expressible as a static vector | 2 |
| Excluded — implementation limits, not protocol violations | 7 |
| | **37** |

## In this set (17)

| | Reason | Enforcement |
|---|---|---|
| NV-01 | `target-not-covered` | discretionary |
| NV-03 | `missing-fields` | discretionary |
| NV-04 | `expired` | discretionary |
| NV-05 | `clock-ahead` | discretionary |
| NV-06 | `bad-signature` | mechanical |
| NV-07 | `canonicalization-mismatch` | mechanical |
| NV-08 | `content-digest-mismatch` | discretionary |
| NV-09 | `missing-component` | mechanical |
| NV-10 | `signature-input-unreadable` | mechanical |
| NV-11 | `signature-value-unreadable` | mechanical |
| NV-12 | `signature-agent-absent` | discretionary |
| NV-13 | `signature-agent-ambiguous-member` | verifier-must |
| NV-14 | `signature-agent-member-missing` | mechanical |
| NV-16 | `signature-agent-not-https` | discretionary |
| NV-17 | `signature-agent-not-origin` | verifier-must |
| NV-18 | `signature-agent-unparsable` | mechanical |
| NV-19 | `duplicate-component` | mechanical |

Eight mechanical, two verifier-must, seven discretionary. Ids are stable and never reused, and 02
and 15 are unassigned, for the conditions under Omitted.

NV-13 and NV-14 sit on [#128](https://github.com/thibmeu/http-message-signatures-directory/issues/128),
where the draft's E.2.1 vector keys its member `agent2` under signature label `sig2`. They make the
two failure shapes explicit so a reported reason can be checked whichever way it resolves.

NV-08 is the only vector that needs the request body, because the signature covers the header that
declares the digest rather than the bytes themselves, so a verifier that does not read the body
cannot reach this fault at all.

## Where a base that cannot be built lands

NV-09, NV-13, NV-14 and NV-18 all fail before any cryptography runs, because the signature base
cannot be built. All four are `invalid` here, and that is the documents' answer rather than this
set's choice.

RFC 9421 §2.5 requires the error: "If covered components reference a component identifier that
cannot be resolved to a component value in the message, the implementation MUST produce an error and
not create a signature base."

RFC 9421 §3.2 says what that error does to the verdict. Recreating the base is step 7 of its
verification procedure, and the procedure closes with "If any of the above steps fail or produce an
error, the signature validation fails."

Appendix C.1 then places a failed validation. `invalid` is "the signature, covered components, key,
or freshness checks fail", while `unverified` is for a verifier that "cannot obtain enough
information to decide". §6.10 shows what that second one is for by working a single case, a
directory that will not resolve, and adding that a failed fetch "says nothing about the signer".

So a base that cannot be built is a failed check and not a missing one, which puts it under
`invalid`. Written out here because two verifiers built independently reached opposite answers in
this one cell, each of them from a reading rather than from a citation.

## Omitted: no outcome can be stated (2)

**`bad-tag`** (id 02, unassigned). Three rules meet here and do not give one answer. Draft §5.2
makes `tag="web-bot-auth"` a signer MUST. RFC 9421 §3.2.1 says an application "MUST enforce" the
requirements it defines and that "signature verification MUST fail if the signature does not
conform". Draft §5.4 then says the Origin **MAY** discard a signature whose tag is not
`web-bot-auth`. A verifier enforcing the RFC 9421 rule reports `invalid`. A verifier exercising the
MAY treats the request as unsigned, which is not one of the three outcomes at all. Both are
conformant, so no vector can state an expected result.

**`signature-agent-mixed-forms`** (id 15, unassigned). Accepting the legacy bare-string form is a
MAY (§5.2.1). A verifier that accepts it reports mixed forms, one that does not reports an
unparsable header. Two conformant verifiers give different reasons, so the vector would isolate
nothing.

## Deferred: need a directory-response shape (9)

`directory-bad-status`, `directory-no-keys`, `directory-not-published`, `directory-unreadable`,
`directory-wrong-media-type`, `key-not-found`, `key-not-in-directory`, `key-before-activation`,
`key-past-expiry`.

Each needs a vector stating a *wrong* key directory response — a 404, a non-JSON body, the wrong
media type, a key set missing the named key. Appendix E describes one directory response and it is
a correct one (E.2.3). The `directory` block these vectors already carry is that shape, so extending
the set needs agreement on what to expect, not a new file format.

`key-not-in-directory` is the one to do first. It and `bad-signature` (NV-06) are two unrelated
faults with different fixes, and some deployments return the same code for both.

## Request-side requirements this set does not exercise

The accounting above is against the 37 failures this verifier names. A reader measuring the set
against the draft's normative surface instead will find three request-side requirements untouched,
and they are left out on purpose rather than by oversight.

**Signature chaining, §5.2.2.** "A signer that covers `"signature";key=X` MUST also cover
`"signature-input";key=X`, and MUST cover every component identifier listed in
`"signature-input";key=X`", and "A signer that cannot cover one of those components … MUST NOT cover
the inner `signature` member."

Both are expressible as static vectors — one request, two signatures, the same key — and neither is
here. No verifier known here, this one included, names a chaining violation as its own fault: each
signature is validated independently against its own covered components, so an outer signature that
under-covers an inner one is not wrong, merely uninformative. A vector needs an expected reason, so
there is none to state. What a chain asserts is also unsettled, and a vector written now would
encode one reading of it.

Every vector here is therefore a single-signature request.

**Independent validation, §5.2.2.** "Verifiers MUST validate each signature independently against
its own covered components and its own key." Implemented here, and not a negative vector: the
failure it guards against is a *good* signature being discarded because a neighbour was bad, so the
vector for it asserts a success. It belongs in a positive set.

**Key misbinding, §5.4.** "Key lookup MUST be keyed on the (URL, key) pair, not on the key alone."
No single request expresses this: the fault only exists across two, where a key learned from one
URL is used to attribute a request that names another. It needs verifier state, so it joins the two
network faults below.

**Algorithm disagreement, RFC 9421 §3.2 step 6.5.** "the resolved algorithms MUST be the same. If
the algorithms are not the same, the verifier MUST fail the verification." A flat verifier MUST, and
a clean static vector: declare one algorithm in `@signature-params` and publish a key of another.
Absent for the same reason as chaining — this verifier reports its own limit (`signature-alg-
unsupported`, which means "not implemented here") and has no name for the disagreement itself.

Weaker, and listed for completeness: RFC 9421 §4.2 requires signature labels to be unique across
all field values, which is a base-construction error with no name of its own here.

One of these did get a vector, and how is the point. RFC 9421 §2.5 step 2.1 forbids covering the
same component identifier twice. That one was measured rather than reasoned about, the measurement
produced a name, and NV-19 carries it. Its `observed` field says what was measured and where.

The rest are waiting on the same thing: the requirement is plain and the vector would be easy, but
the vocabulary has no entry for the result. That is the set's boundary, and naming it is more useful
than inventing entries to fill it.

## Not expressible as a static vector (2)

`directory-host-unknown`, `directory-unreachable`. Both mean nothing answered. No byte sequence
expresses the absence of a network, and a vector that tried would test the harness. The §5.4 key
misbinding above sits with them for the same reason, though it is a draft requirement rather than
one of the 37 names.

## Excluded: implementation limits (7)

`component-unsupported`, `component-unsupported-parameter`, `signature-alg-unsupported`,
`signature-agent-port-unsupported`, `signature-agent-unsupported-type`, `directory-too-large`,
`directory-too-many-keys`.

Each is a verifier declining on its own ceiling. Appendix C.1 defines `unverified` as "the verifier
cannot obtain enough information to decide", which a declined ceiling is — though the appendix gives
only directory failure and an unknown key as its examples, so placing them there is a reading and
not a quotation. Vectors for them would propose one implementation's ceilings as conformance
requirements.

`signature-agent-unsupported-type` sits here while NV-17 (`signature-agent-not-origin`) is a vector,
and the two rest on the same "a verifier MUST ignore" construction — §5.2.1 for a `type` value the
verifier does not support, §5.5 for a `directory` member that is not an origin. The difference is
which types a verifier implements: that is a local choice, so a member naming an unsupported one is
this verifier's limit.
A member that is not an origin serialization fails for any verifier resolving the `directory` type,
whatever set of types it supports.

Worth a sentence in the draft nonetheless: from the client's seat these are the opposite message
from everything above — *"nothing is wrong with your request, it simply was not checked here"* — and
today a client cannot tell that apart from *"fix this at your end."*

## Tolerated deviations are not covered

Some departures are recoverable, and a verifier may accept them while recording what to change: an
unquoted `Signature-Agent` member value, the legacy bare-string form. Neither a pass nor a
rejection, so not vectors. That is why NV-18 uses an unterminated string rather than the unquoted
case, which would have been a tolerated deviation and not a rejection at all.

## Two vocabularies, arrived at independently

AVAVERIFY
[reported on #11](https://github.com/thibmeu/http-message-signatures-directory/issues/11#issuecomment-5428515850)
that their merchant-side verifier ships a typed reason vocabulary in production, every name carrying
a flag for whether the check completed and failed or could not complete. That is the same two
layers, reached from the other end of the exchange.

The vocabulary is public in `AVA-PAY/ava-pay`, `packages/agent-sdk/src/types.ts`, and its 35 members
are grouped there by protocol, and most do not touch this one: 7 AP2, 6 Visa Trusted Agent, 4
payment mandates, 2 for their own agent registry, 1 generic and 1 multi-protocol — 21 in all.
**Fourteen are comparable**: 7 in their Web Bot Auth group, 6 in the RFC 9421 signature layer this
protocol builds on, and `directory_unavailable`, which sits in their directory group but describes
a fetch this protocol makes too.

Of those fourteen, the conditions both vocabularies name:

| AVA-PAY | here |
|---|---|
| `invalid_signature` | `bad-signature` |
| `signature_expired` | `expired` |
| `content_digest_mismatch` | `content-digest-mismatch` |
| `unsupported_algorithm` | `signature-alg-unsupported` |
| `malformed_signature_header` | `signature-input-unreadable`, `signature-value-unreadable` |
| `directory_unavailable`, `key_directory_unavailable` | `directory-unreachable`, `directory-unreadable` |
| `key_directory_redirected` | `directory-bad-status`, of which a 3xx is one case |
| `unknown_key` | `key-not-in-directory` |

Where the two split is more interesting than where they meet.

**Same condition, different layer.** `missing_signature_agent` is documented there as "a definitive
rejection", because §5.2.1 requires the header on every signed request. Here the same condition is
`signature-agent-absent` with outcome `unverified`: the requirement was broken, but no check failed,
because discovery never began. Both readings follow from the text and the two vocabularies disagree
on which layer the condition belongs to. That is the layering question the set is about, showing up
in the only place two independent implementations could disagree about it.

**Named on one side only.** They separate the two halves of the Appendix B possession proof
(`unsigned_key`, `key_proof_invalid`) where we do not, and name `replay_detected`, which we record
on the call rather than as a fault. We separate eight further `Signature-Agent` conditions where
they have one, and name `target-not-covered`, `canonicalization-mismatch` and `clock-ahead`. Neither
list is a gap in the other: each vocabulary is finer where its own deployment was hurt.

Two implementations converging on the same layering, with the coarse conditions named almost
identically, is the argument for standardising the structure rather than the names.

## Open: which outcome an unattributable signature gets

Two of our own reasons describe a signer that broke a MUST and left the verifier unable to name an
agent, and we classify them differently: `signature-agent-absent` is `unverified` (discovery never
started) and `signature-agent-ambiguous-member` is `invalid` (a fixable defect in what was signed).
Both readings are defensible and neither follows from the text. §5.2.2 forbids the verifier from
attributing the signature and does not say what it then reports. Raised here rather than resolved,
because the answer belongs to the group.
