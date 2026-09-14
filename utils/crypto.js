import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * @param {string} sessionID
 */
export function hashSessionID(sessionID) {
  if (!sessionID) return "";

  return createHash("sha256").update(String(sessionID)).digest("hex");
}

/**
 * @param {string} password
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const params = getCurrentScryptParams();
  const hash = await getScryptHash(password, salt, params);

  return {
    passwordHash: [
      "",
      SCRYPT_ALGORITHM,
      `v=${params.version},ln=${params.logN},r=${params.blockSize},p=${params.parallelization},dk=${params.keyLength}`,
      salt,
      hash,
    ].join("$"),
    salt,
  };
}

/**
 * @param {string} password
 * @param {string} storedHash
 * @param {string} salt
 */
export async function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash) return false;

  const [empty, algorithm, rawParams, parsedSalt, parsedStoredHash, ...extra] =
    String(storedHash).split("$");

  if (
    empty === "" &&
    algorithm === SCRYPT_ALGORITHM &&
    rawParams &&
    parsedSalt &&
    parsedStoredHash &&
    !extra.length
  ) {
    const params = new Map(
      rawParams.split(",").map((param) => {
        const [key, value] = param.split("=");

        return [key, Number(value)];
      }),
    );

    const version = params.get("v");
    const logN = params.get("ln");
    const blockSize = params.get("r");
    const parallelization = params.get("p");
    const keyLength = params.get("dk");

    if (
      version === SCRYPT_VERSION &&
      Number.isInteger(logN) &&
      Number.isInteger(blockSize) &&
      Number.isInteger(parallelization) &&
      Number.isInteger(keyLength)
    ) {
      const hash = await getScryptHash(password, parsedSalt, {
        version,
        logN,
        blockSize,
        parallelization,
        keyLength,
      });

      return safeEqual(hash, parsedStoredHash);
    }
  }

  if (!salt) return false;

  return safeEqual(
    await getScryptHash(password, salt, getCurrentScryptParams()),
    storedHash,
  );
}

// thought it would be a good idea to record params instead of relying on
// defaults
const SCRYPT_ALGORITHM = "scrypt";
const SCRYPT_VERSION = 1;
const SCRYPT_LOG_N = 14;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;

function getCurrentScryptParams() {
  return {
    version: SCRYPT_VERSION,
    logN: SCRYPT_LOG_N,
    blockSize: SCRYPT_BLOCK_SIZE,
    parallelization: SCRYPT_PARALLELIZATION,
    keyLength: SCRYPT_KEY_LENGTH,
  };
}

async function getScryptHash(password, salt, params) {
  const derivedKey = await new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      params.keyLength,
      {
        N: 2 ** params.logN,
        r: params.blockSize,
        p: params.parallelization,
        maxmem: SCRYPT_MAXMEM,
      },
      (err, derivedKey) => {
        if (err) return reject(err);

        resolve(derivedKey);
      },
    );
  });

  return Buffer.from(derivedKey).toString("base64url");
}

function safeEqual(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
