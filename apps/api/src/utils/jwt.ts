import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
  throw new Error("JWT_SECRET must be a 64-character hex value.");
}

const key = Buffer.from(secret, "hex");

export async function createToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer("interview-platform")
    .setAudience("interview-platform-api")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["HS256"],
    issuer: "interview-platform",
    audience: "interview-platform-api",
    requiredClaims: ["sub", "iat", "exp"],
  });

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Token has no valid user ID.");
  }

  return payload.sub;
}