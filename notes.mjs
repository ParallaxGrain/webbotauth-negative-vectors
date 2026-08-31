/**
 * The proposed reason vocabulary, one entry per reason the set uses.
 *
 * Same role as the `notes` block in a Wycheproof vector file: a named flag on a failing case with
 * the text that explains it. `outcome` is the draft's own (Appendix C.1) and is normative; the
 * reason NAME and its `fix` text are what this set proposes.
 *
 * `outcome` and `group` are load-bearing, not decoration: a reason meaning the verifier could not
 * decide must never appear under an invalid outcome, because downstream software switches on the
 * outcome and would read the pair as a rejection. generate.mjs and verify.mjs both enforce that.
 *
 * Copied here rather than imported: a vector set that needs one vendor's code to be read is not a
 * vector set.
 *
 * Two `fix` texts are adapted for a standalone file. `canonicalization-mismatch` drops a clause
 * pointing at a narrower string the API returns beside the reason, which nothing here carries.
 * `signature-agent-absent` says "-02 requires one" where the API says "the current draft", because
 * this file is pinned to a revision and will outlive it. Every other text is the verifier's own,
 * word for word.
 */
export const NOTES = {
  "target-not-covered": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The signature covers no request target, so it is valid against any endpoint and replayable elsewhere as your identity. Cover \"@authority\" or \"@target-uri\". The draft requires one of them."
  },
  "missing-fields": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "Signature-Input is missing required parameters. Include created, expires, keyid and tag."
  },
  "expired": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The signature expired before the request arrived. Set expires with more headroom. A minute is usually enough."
  },
  "clock-ahead": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "Your server's clock is ahead: the signature is dated in the future. Enable time synchronisation (NTP)."
  },
  "bad-signature": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The signature does not verify against the published key. The base is a likelier cause than the key: covering \"signature-agent\" puts the whole field into it, covering \"signature-agent\";key=\"sig1\" puts that member value alone. Rebuild the base, then check the key is the one your directory publishes."
  },
  "canonicalization-mismatch": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The signature is sound, the base it was built over is not the one rebuilt here: a value formatted differently, identifiers written without quotes, a whole field where the covered member belongs, or a trailing newline."
  },
  "content-digest-mismatch": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The Content-Digest you signed does not match the body that arrived. Recompute the digest over the exact bytes you send."
  },
  "missing-component": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The signature covers a component that this request does not carry, so the signature base cannot be rebuilt. Send every component you sign."
  },
  "signature-input-unreadable": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "Signature-Input could not be parsed. It must be a dictionary member such as sig1=(\"@authority\");created=1;expires=2;keyid=\"…\";tag=\"web-bot-auth\"."
  },
  "signature-value-unreadable": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The Signature header has no member matching the Signature-Input label, or its value is not base64 between colons."
  },
  "signature-agent-absent": {
    "outcome": "unverified",
    "group": "signature-agent",
    "fix": "No Signature-Agent header. -02 requires one on a signed request, and without it nothing says where your public key is published."
  },
  "signature-agent-ambiguous-member": {
    "outcome": "invalid",
    "group": "signature-agent",
    "fix": "Signature-Agent carries several members and none can be matched to this signature. Add a key parameter to the covered signature-agent component, or use one member named after the signature label."
  },
  "signature-agent-member-missing": {
    "outcome": "invalid",
    "group": "signature-agent",
    "fix": "The signature covers a Signature-Agent member that the header does not contain. The key parameter must name a member that is actually sent."
  },
  "signature-agent-not-https": {
    "outcome": "invalid",
    "group": "signature-agent",
    "fix": "Signature-Agent must point at an https address. Key directories are not read over plain http."
  },
  "signature-agent-not-origin": {
    "outcome": "unverified",
    "group": "signature-agent",
    "fix": "For the directory type the value must be a bare origin such as \"https://example.com\", with no path, query or fragment. Use type=jwks_uri to point at a file."
  },
  "signature-agent-unparsable": {
    "outcome": "invalid",
    "group": "signature-agent",
    "fix": "Signature-Agent is not readable. Send a dictionary member such as sig1=\"https://example.com\"."
  },
  "duplicate-component": {
    "outcome": "invalid",
    "group": "signature",
    "fix": "The same component identifier is covered twice. RFC 9421 requires a signature base to be built with each identifier once, so the base cannot be constructed and the signature cannot be checked. Remove the repeat."
  }
};
