/**
 * The adapter contract.
 *
 * Export `verify(vector)`, returning `{ outcome, reason }` or `null` to skip.
 *
 *   outcome   'verified' | 'invalid' | 'unverified'   — the draft's own (Appendix C.1)
 *   reason    string | null                            — your name for the failure, if you have one
 *
 * A verifier that has not adopted the proposed vocabulary should return the outcome and leave
 * reason null. verify.mjs reports that as PASS*, which is a pass on the normative half.
 *
 * Everything the vector gives you is already there, so no fetch is needed:
 *
 *   vector.request.method / .url / .headers / .body   the request as it arrives
 *   vector.directory                                  the key directory response, verbatim,
 *                                                     as if fetched from vector.directory.url
 *   vector.now                                        the clock, in seconds, to verify against
 *   vector.key.jwk                                    the public key, for convenience
 *
 * Replace the body below with a call into your verifier.
 */
export function verify(_vector) {
  return null; // not implemented: every vector is reported as SKIP
}
