/**
 * Source of truth. `generate.mjs` signs these and writes vectors/*.json and the combined file.
 * No signature is ever hand-written.
 *
 * Two component-value sets per vector; where they differ, that difference IS the test:
 *   signedValues   — what the signer put into the base it signed
 *   expectedValues — what a verifier derives from `request` (null entries: it derives nothing)
 */

export const KEYID = 'poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U';
export const AGENT = 'https://signature-agent.test';
export const CREATED = 1735689600;   // the draft's own timestamps, so no vector ages out
export const EXPIRES = 4889289600;
export const NOW = CREATED + 60;

export const GOOD_DIRECTORY = {
  status: 200,
  headers: { 'Content-Type': 'application/http-message-signatures-directory+json' },
  body: JSON.stringify({
    keys: [{ kty: 'OKP', crv: 'Ed25519', kid: KEYID, x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs', use: 'sig' }],
  }),
};

const params = (components, extra = {}) => {
  const p = { created: CREATED, keyid: KEYID, alg: 'ed25519', expires: EXPIRES, tag: 'web-bot-auth', ...extra };
  const parts = [`(${components.join(' ')})`];
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    parts.push(`${k}=${typeof v === 'number' ? v : `"${v}"`}`);
  }
  return parts.join(';');
};

const AUTH = '"@authority"';
const SA = (label) => `"signature-agent";key="${label}"`;
const D = 'draft-ietf-webbotauth-httpsig-protocol-00';
const R = 'RFC 9421';

const baseline = {
  class: 'request',
  provenance: 'constructed',
  now: NOW,
  request: { method: 'GET', url: 'https://example.com/', headers: {} },
  directoryFor: AGENT,
};

export const VECTORS = [
  {
    ...baseline,
    id: 'NV-01',
    slug: 'target-not-covered',
    title: 'Signature covers no request target',
    expected: { outcome: 'invalid', reason: 'target-not-covered' },
    enforcement: 'discretionary',
    basis: {
      document: D, section: '5.2',
      requirement: 'Agents MUST include at least one of the following components:',
      requirementList: ['@authority', '@target-uri'],
      note: 'Section 5.2 states the sentence and then names the two components as a definition list under it. A signer requirement: the draft does not say what a verifier does when it is broken, which is why this is discretionary and not mechanical.',
      enforcedBy: { implementation: 'cloudflare/web-bot-auth', commit: '9db2b21d2c12', date: '2026-07-21', message: 'Enforce covered components in web-bot-auth verify() (#114)' },
    },
    note: 'The signature verifies over its own base and covers nothing naming the destination, so it is valid against every endpoint. Anyone who observes one request can present it elsewhere as this agent, without holding the key.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [SA('sig1')], paramsValue: params([SA('sig1')]),
      signedValues: { [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-03',
    slug: 'missing-fields',
    title: 'Signature-Input omits a required parameter',
    expected: { outcome: 'invalid', reason: 'missing-fields' },
    enforcement: 'discretionary',
    basis: {
      document: D, section: '5.2',
      requirement: 'Agents MUST include the following @signature-params as defined in Section 2.3 of HTTP-MESSAGE-SIGNATURES',
      requirementList: ['created', 'expires', 'keyid', 'tag'],
      note: 'Named as a definition list under the sentence. A signer requirement. The verifier side is unstated.',
    },
    note: 'expires is absent, so the signature has no stated lifetime and nothing bounds how long an observed request stays replayable.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')], { expires: undefined }),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-04',
    slug: 'expired',
    title: 'Signature expired before the request arrived',
    expected: { outcome: 'invalid', reason: 'expired' },
    enforcement: 'discretionary',
    now: CREATED + 7200,
    basis: {
      document: R, section: '3.2.1',
      requirement: 'Rejecting signatures past the expiration time in the expires timestamp. Note that the expiration time is a hint from the signer and that a verifier can always reject a signature ahead of its expiration time.',
      note: 'Listed among "additional requirements an application might define". Enforcing expiry is a choice, not a baseline rule, so the outcome below is what a verifier that enforces it produces.',
    },
    note: 'Correct in every other way. The clock has moved past the stated expiry. The stated now is what makes this reproducible.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')], { expires: CREATED + 3600 }),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-05',
    slug: 'clock-ahead',
    title: "Signature is dated in the signer's future",
    expected: { outcome: 'invalid', reason: 'clock-ahead' },
    enforcement: 'discretionary',
    now: CREATED - 3600,
    basis: {
      document: D, section: 'Appendix B.1',
      requirement: 'A verifier MUST reject a directory response signature whose created is in the future, as it would a certificate that is not yet valid.',
      note: 'The asymmetry is the point. The draft makes rejecting a future created a MUST for a DIRECTORY RESPONSE signature and says nothing about a REQUEST signature, where the same reasoning applies: a future-dated signature outlives every honest one. RFC 9421 Section 3.2.1 leaves the request side to the application ("Enforcing a maximum signature age from the time of the created timestamp"), so this vector is discretionary on the request path only because the draft has not carried its own rule across.',
    },
    note: "created is an hour ahead of the stated now. Distinct from expiry and from forgery: the signer's clock is wrong, which the operator can fix, and a verifier that reports it as an invalid signature sends them to the wrong place.",
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-06',
    slug: 'bad-signature',
    title: 'Signature does not verify against the published key',
    expected: { outcome: 'invalid', reason: 'bad-signature' },
    enforcement: 'mechanical',
    basis: {
      document: D, section: '5.4',
      requirement: 'Upon receiving an HTTP request, the origin has to verify the signature. The algorithm is provided in Section 3.2 of HTTP-MESSAGE-SIGNATURES.',
    },
    note: 'A real Ed25519 signature made with the published key, over a base naming a different authority. What a replayed or altered request looks like on the wire, and the one failure every verifier already detects.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'other.example', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-07',
    slug: 'canonicalization-mismatch',
    title: 'Signer wrote an empty @path where the rule requires a single slash',
    expected: { outcome: 'invalid', reason: 'canonicalization-mismatch' },
    enforcement: 'mechanical',
    provenance: 'observed-fault',
    observed: {
      operator: 'DuckDuckGo', agent: 'DuckDuckBot',
      firstNamed: '2026-08-27',
      note: 'The FAULT is observed, the request below is not. On the wire this agent covers ("@method" "@authority" "@path" "signature-agent") with its own key and a bare signature-agent component. The vector reproduces the empty-@path mismatch with the B.1.4 key and the dictionary form so it isolates that one cause. 2026-08-27 is when the reason was first named — the collector itself only began on 2026-08-25, so earlier occurrences would have been recorded as an invalid signature.',
    },
    basis: {
      document: R, section: '2.2.6',
      requirement: 'an empty path string is normalized as a single slash (/) character',
    },
    note: 'The signer built its base with an empty @path. A verifier following the rule rebuilds it as "/". The bases differ by one byte, so the signature cannot match — yet nothing about the signature or the key is wrong, and calling it a bad signature sends the operator to rotate a good key.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, '"@path"', SA('sig1')], paramsValue: params([AUTH, '"@path"', SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', '"@path"': '', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', '"@path"': '/', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-08',
    slug: 'content-digest-mismatch',
    title: 'Covered Content-Digest does not match the body sent',
    expected: { outcome: 'invalid', reason: 'content-digest-mismatch' },
    enforcement: 'discretionary',
    basis: {
      document: D, section: '5.2',
      requirement: 'No component covers the body. An Agent that needs one MUST send and cover Content-Digest.',
      note: 'The draft requires the signer to cover it and does not say the verifier must compare it against the body. A verifier that skips the comparison makes the coverage decorative, but stays within the text.',
    },
    note: 'The signature covers Content-Digest and the field value is exactly what was signed. It is simply not the digest of the body that arrived.',
    request: {
      method: 'POST', url: 'https://example.com/',
      headers: { 'Signature-Agent': `sig1="${AGENT}"`, 'Content-Digest': 'sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:' },
      body: '{"hello":"world"}',
    },
    signature: {
      label: 'sig1', components: [AUTH, '"content-digest"', SA('sig1')], paramsValue: params([AUTH, '"content-digest"', SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', '"content-digest"': 'sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', '"content-digest"': 'sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-09',
    slug: 'missing-component',
    title: 'Signature covers a component the request does not carry',
    expected: { outcome: 'invalid', reason: 'missing-component' },
    enforcement: 'mechanical',
    basis: {
      document: R, section: '2.5',
      requirement: 'If covered components reference a component identifier that cannot be resolved to a component value in the message, the implementation MUST produce an error and not create a signature base. Such situations include ... The component name identifies a field that is not present in the message or whose value is malformed.',
    },
    note: 'The signature covers content-digest and the request carries no such header, so the base cannot be built at all. Distinct from a digest that is present and wrong (NV-08): here there is nothing to compare.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, '"content-digest"', SA('sig1')], paramsValue: params([AUTH, '"content-digest"', SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', '"content-digest"': 'sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
    },
  },
  {
    ...baseline,
    id: 'NV-10',
    slug: 'signature-input-unreadable',
    title: 'Signature-Input is not a readable structured field',
    expected: { outcome: 'invalid', reason: 'signature-input-unreadable' },
    enforcement: 'mechanical',
    basis: {
      document: R, section: '4.1',
      requirement: 'The Signature-Input field is a Dictionary Structured Field (defined in Section 3.2 of [STRUCTURED-FIELDS]) containing the metadata for one or more message signatures generated from components within the HTTP message.',
    },
    note: 'The component list is left unclosed, so nothing can be read: not what the signature covers, not which key it names.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: null,
      overrideHeaders: { 'Signature-Input': `sig1=("@authority" "signature-agent";key="sig1";created=${CREATED};keyid="${KEYID}";alg="ed25519";expires=${EXPIRES};tag="web-bot-auth"` },
    },
  },
  {
    ...baseline,
    id: 'NV-11',
    slug: 'signature-value-unreadable',
    title: 'Signature has no member matching the Signature-Input label',
    expected: { outcome: 'invalid', reason: 'signature-value-unreadable' },
    enforcement: 'mechanical',
    basis: {
      document: R, section: '4',
      requirement: 'An HTTP message signature MUST use both the Signature-Input field and the Signature field, and each field MUST contain the same labels. The presence of a label in one field but not the other is an error.',
    },
    note: 'Signature-Input announces label sig1 and the Signature header carries only sig9. The signature bytes are genuine. Nothing pairs them to the parameters, so no base can be selected.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: null,
      renameSignatureMemberTo: 'sig9',
    },
  },
  {
    ...baseline,
    id: 'NV-12',
    slug: 'signature-agent-absent',
    title: 'Signed request carries no Signature-Agent header',
    expected: { outcome: 'unverified', reason: 'signature-agent-absent' },
    enforcement: 'discretionary',
    basis: {
      document: D, section: '5.2.1',
      requirement: 'A signed request MUST carry the Signature-Agent header, as described in Section 5.2.5.',
      requirementNote: 'The kramdown source writes the cross-reference as a label, {{sending-request}}; it is expanded here to the number the published document prints, as every other citation in this set is.',
      note: 'A signer requirement. The outcome is unverified rather than invalid because no check failed: discovery never started.',
    },
    note: 'A correct signature with nowhere to look up the key.',
    directoryFor: null,
    directoryNote: 'None supplied: the request names no address.',
    request: { method: 'GET', url: 'https://example.com/', headers: {} },
    signature: {
      label: 'sig1', components: [AUTH], paramsValue: params([AUTH]),
      signedValues: { [AUTH]: 'example.com' },
      expectedValues: { [AUTH]: 'example.com' },
    },
  },
  {
    ...baseline,
    id: 'NV-13',
    slug: 'signature-agent-ambiguous-member',
    title: 'Several Signature-Agent members and none matches this signature',
    expected: { outcome: 'invalid', reason: 'signature-agent-ambiguous-member' },
    enforcement: 'verifier-must',
    basis: {
      document: D, section: '5.2.2',
      requirement: 'Each signer MUST provide a Signature-Agent member for its label. A verifier MUST NOT attribute a signature to a member that signature does not cover.',
      note: 'The MUST NOT binds attribution, not the outcome: a verifier is forbidden from picking one of the two members, and the text does not say which failing outcome follows. Reported here as invalid because the signer broke a stated MUST that the operator can fix. A verifier reporting unverified on the same request is not obviously wrong, and the question is worth settling — see COVERAGE.md.',
    },
    note: 'Two members, a covered signature-agent component with no key parameter, and no member named after the signature label. Related to issue #128, where the draft\'s own E.2.1 vector keys its member agent2 under signature label sig2. Here the ambiguity is explicit so the reported reason can be checked whichever way #128 resolves.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `first="${AGENT}", second="https://other-agent.test"` } },
    signature: {
      label: 'sig1', components: [AUTH, '"signature-agent"'], paramsValue: params([AUTH, '"signature-agent"']),
      signedValues: { [AUTH]: 'example.com', '"signature-agent"': `first="${AGENT}", second="https://other-agent.test"` },
      expectedValues: { [AUTH]: 'example.com', '"signature-agent"': `first="${AGENT}", second="https://other-agent.test"` },
    },
  },
  {
    ...baseline,
    id: 'NV-14',
    slug: 'signature-agent-member-missing',
    title: 'Signature covers a Signature-Agent member the header does not contain',
    expected: { outcome: 'invalid', reason: 'signature-agent-member-missing' },
    enforcement: 'mechanical',
    basis: {
      document: R, section: '2.5',
      requirement: 'If covered components reference a component identifier that cannot be resolved to a component value in the message, the implementation MUST produce an error and not create a signature base.',
      note: 'The draft adds the reason the member matters: "Its member keyed to the signature label MUST be signed as a component" (Section 5.2.1). Without it the address the verifier fetches keys from is unprotected.',
    },
    note: 'The signature covers the member keyed sig1 and the header carries only other.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `other="${AGENT}"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: null,
    },
  },
  {
    ...baseline,
    id: 'NV-16',
    slug: 'signature-agent-not-https',
    title: 'Signature-Agent names an http address',
    expected: { outcome: 'invalid', reason: 'signature-agent-not-https' },
    enforcement: 'discretionary',
    basis: {
      document: D, section: '5.2.1',
      requirement: 'Its member values MUST be String Items that contain a URI, whose scheme MUST be https.',
      note: 'A signer requirement. The adjacent sentence — "If dictionary values are not valid URI-references, the entire header field MAY be ignored" — does not apply: an http URL is a valid URI-reference.',
    },
    note: 'Key discovery over plain http would let anyone on the path substitute the key set, removing the property the signature exists to provide.',
    directoryFor: 'http://signature-agent.test',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': 'sig1="http://signature-agent.test"' } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: '"http://signature-agent.test"' },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: '"http://signature-agent.test"' },
    },
  },
  {
    ...baseline,
    id: 'NV-17',
    slug: 'signature-agent-not-origin',
    title: 'Directory-type Signature-Agent carries a path',
    expected: { outcome: 'unverified', reason: 'signature-agent-not-origin' },
    enforcement: 'verifier-must',
    basis: {
      document: D, section: '5.5',
      requirement: 'The member value MUST be the ASCII serialization of an origin as defined in Section 6.2 of ORIGIN, and a verifier MUST ignore a member carrying anything else (an empty path / MAY be accepted though).',
      note: 'Ignoring is not rejecting. With the only member ignored there is no discovery mechanism left, so the outcome is unverified — the same reading the draft applies to an unsupported type parameter.',
    },
    note: 'For the directory type the value is an origin. The path is fixed by the well-known registration. A value carrying its own path is either a jwks_uri sent under the wrong type, or an attempt to point discovery outside the well-known reservation. The exemption for a bare "/" does not apply here.',
    directoryFor: null,
    directoryNote: 'None supplied: the member the address would come from is one the verifier is told to ignore, so no directory address can be derived from this request.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}/keys"` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}/keys"` },
      expectedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}/keys"` },
    },
  },
  {
    ...baseline,
    id: 'NV-18',
    slug: 'signature-agent-unparsable',
    title: 'Signature-Agent is not a readable structured field',
    expected: { outcome: 'invalid', reason: 'signature-agent-unparsable' },
    enforcement: 'mechanical',
    basis: {
      document: D, section: '5.2.1',
      requirement: 'Signature-Agent is a Dictionary Structured Header as defined in Section 3.2 of STRUCTURED-HEADERS.',
    },
    note: 'The member value opens a quoted string and never closes it, so the header is not a structured field and no member can be read. Deliberately not the unquoted-value case: an unquoted value is recoverable and at least one verifier accepts it while recording a deviation, which makes it a tolerated departure rather than a rejection.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}` } },
    signature: {
      label: 'sig1', components: [AUTH, SA('sig1')], paramsValue: params([AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: null,
    },
  },
  {
    ...baseline,
    id: 'NV-19',
    slug: 'duplicate-component',
    title: 'The same component identifier is covered twice',
    expected: { outcome: 'invalid', reason: 'duplicate-component' },
    enforcement: 'mechanical',
    provenance: 'observed-fault',
    observed: {
      note: 'The fault is observed in a verifier rather than on the wire. Writing this vector is what found it: the verifier behind this set built the base with the component twice and answered verified to a correctly signed request covering ("@authority" "@authority" "signature-agent"), measured against its production endpoint on 2026-08-30. Fixed the same day. The vector exists so the fix cannot quietly come undone.',
    },
    basis: {
      document: R, section: '2.5',
      requirement: 'If the component identifier (including its parameters) has already been added to the signature base, produce an error.',
      note: 'The identifier includes its parameters, so two signature-agent members under different key parameters remain legal. Only an exact repeat is an error.',
    },
    note: 'A signature that is otherwise correct, over a base that RFC 9421 says must never be built. Nothing about the key or the bytes is wrong, and a verifier that builds the base anyway will verify it.',
    request: { method: 'GET', url: 'https://example.com/', headers: { 'Signature-Agent': `sig1="${AGENT}"` } },
    signature: {
      label: 'sig1',
      components: [AUTH, AUTH, SA('sig1')],
      paramsValue: params([AUTH, AUTH, SA('sig1')]),
      signedValues: { [AUTH]: 'example.com', [SA('sig1')]: `"${AGENT}"` },
      expectedValues: null,
    },
  },
];

/**
 * Named failures our verifier reports that are NOT vectors here, with the reason. Kept beside the
 * set so the omissions are auditable rather than silent.
 */
export const OMITTED = {
  'bad-tag': 'No vector, but the reason is a contradiction worth reporting rather than a gap. Draft Section 5.2 makes tag="web-bot-auth" a signer MUST. RFC 9421 Section 3.2.1 says an application "MUST enforce" the additional requirements it defines and that "signature verification MUST fail if the signature does not conform". Draft Section 5.4 then says the Origin MAY discard signatures whose tag is not web-bot-auth. Those give two different answers to one request: a verifier enforcing the RFC 9421 rule reports invalid, and a verifier exercising the MAY treats the request as unsigned, which is not one of the three outcomes at all. Both are conformant, so no vector can state an expected result until the group settles which applies.',
  'signature-agent-mixed-forms': 'Accepting the legacy bare-string form is a MAY (Section 5.2.1). A verifier that accepts it reports mixed forms. One that does not reports an unparsable header. Two conformant verifiers give different reasons, so the vector would not isolate one.',
};
