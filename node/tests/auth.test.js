import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { hashVerificationCode } from "../utils/verificationCode.js";
import { verifyAuthToken } from "../utils/jwtAuth.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "bjs6V/Yy/prcKOeCnpN6N4vLOyO6ou/92cttk62YOoe6lDtLoSHC7AygZ9kTXYuM";
process.env.OTP_SECRET = process.env.OTP_SECRET || "eaa55855b5ffd4eb75f4f9b544708549d042dd31a7ca47a82710f25cdffe94a1";

describe("Auth Test Suite: Token Issuance & Verification", () => {
  it("should verify valid JWT tokens issued with correct secret", () => {
    const userId = "6724b11f7142416f0b691234";
    const token = jwt.sign({}, process.env.JWT_SECRET, {
      algorithm: "HS256",
      subject: userId,
      expiresIn: 3600,
    });

    const decoded = verifyAuthToken(token);
    assert.equal(decoded.sub, userId, "Decoded token subject should match user ID");
  });

  it("should reject tampered JWT tokens", () => {
    const userId = "6724b11f7142416f0b691234";
    const token = jwt.sign({}, process.env.JWT_SECRET, {
      algorithm: "HS256",
      subject: userId,
      expiresIn: 3600,
    });

    const tampered = token.slice(0, -5) + "ABCDE";
    assert.throws(
      () => verifyAuthToken(tampered),
      /invalid signature|jwt malformed/,
      "Tampered token must throw invalid signature error",
    );
  });

  it("should reject expired JWT tokens", () => {
    const userId = "6724b11f7142416f0b691234";
    const expiredToken = jwt.sign({}, process.env.JWT_SECRET, {
      algorithm: "HS256",
      subject: userId,
      expiresIn: -10, // already expired
    });

    assert.throws(
      () => verifyAuthToken(expiredToken),
      /jwt expired/,
      "Expired token must throw jwt expired error",
    );
  });
});

describe("Auth Test Suite: OTP Verification Hashing", () => {
  it("should generate deterministic HMAC SHA256 hashes for verification codes", () => {
    const code = "749281";
    const hash1 = hashVerificationCode(code);
    const hash2 = hashVerificationCode(code);

    assert.equal(typeof hash1, "string");
    assert.equal(hash1.length, 64, "SHA-256 hex hash should be 64 characters");
    assert.equal(hash1, hash2, "Same OTP code must always produce identical hash");
  });

  it("should produce different hashes for different verification codes", () => {
    const hash1 = hashVerificationCode("123456");
    const hash2 = hashVerificationCode("654321");

    assert.notEqual(hash1, hash2, "Different codes must produce different hashes");
  });
});
