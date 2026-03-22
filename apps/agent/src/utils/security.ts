import crypto from "node:crypto";

import { env } from "./env";

const ivLength = 12;
const key = crypto.createHash("sha256").update(env.tokenEncryptionKey).digest();

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivEncoded, authTagEncoded, dataEncoded] = payload.split(".");

  if (!ivEncoded || !authTagEncoded || !dataEncoded) {
    throw new Error("Invalid encrypted payload format");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64"));
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataEncoded, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
