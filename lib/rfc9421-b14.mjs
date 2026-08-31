/**
 * The Ed25519 test key from RFC 9421, Appendix B.1.4 ("test-key-ed25519").
 *
 * Both halves are published in the RFC, so every signature here is re-derivable.
 * draft-meunier-webbotauth-httpsig-protocol names this key for its own test vectors, so these sign
 * with the key the positive ones use.
 */
export const PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJ+DYvh6SEqVTm50DFtMDoQikTmiCqirVv9mWG9qfSnF
-----END PRIVATE KEY-----`;

export const PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAJrQLj5P/89iXES9+vFgrIy29clF9CC/oPPsw3c5D0bs=
-----END PUBLIC KEY-----`;

/** The same public key as a JWK, in the shape a key directory publishes it. */
export const PUBLIC_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs',
};

/** RFC 7638 thumbprint of PUBLIC_JWK. The draft's vectors use it as `keyid`. */
export const KEY_ID = 'poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U';
