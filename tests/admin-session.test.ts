import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSessionConfigurationError, ADMIN_SESSION_TTL_SECONDS, createAdminSession, verifyAdminSession } from "../lib/admin-session";

describe("signed admin sessions", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "a1".repeat(32));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("accepts a signed token and creates independent sessions", async () => {
    const token = await createAdminSession();
    expect(await verifyAdminSession(token)).toBe(true);
    expect(await createAdminSession()).not.toBe(token);
  });

  it.each([undefined, "", "1", "arbitrary", "v1.bad", "x".repeat(1000)])("rejects legacy or malformed cookie %s", async (token) => {
    expect(await verifyAdminSession(token)).toBe(false);
  });

  it("rejects tampered signatures and payloads", async () => {
    const token = await createAdminSession();
    const parts = token.split(".");
    parts[3] = (parts[3][0] === "a" ? "b" : "a") + parts[3].slice(1);
    expect(await verifyAdminSession(parts.join("."))).toBe(false);
    expect(await verifyAdminSession(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"))).toBe(false);
    const extended = token.split(".");
    extended[2] = String(Number(extended[2]) + 1);
    expect(await verifyAdminSession(extended.join("."))).toBe(false);
  });

  it("expires exactly eight hours after issue and rejects future issuance", async () => {
    const token = await createAdminSession();
    vi.setSystemTime(Date.now() - 1000);
    expect(await verifyAdminSession(token)).toBe(false);
    vi.setSystemTime(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);
    expect(await verifyAdminSession(token)).toBe(true);
    vi.setSystemTime(Date.now() + 1000);
    expect(await verifyAdminSession(token)).toBe(false);
  });

  it("invalidates existing sessions when the secret is rotated", async () => {
    const old = await createAdminSession();
    vi.stubEnv("ADMIN_SESSION_SECRET", "b2".repeat(32));
    expect(await verifyAdminSession(old)).toBe(false);
    expect(await verifyAdminSession(await createAdminSession())).toBe(true);
  });

  it.each([undefined, "", "weak", "ab".repeat(31), "zz".repeat(32)])("fails closed with invalid secret %s", async (secret) => {
    const token = await createAdminSession();
    vi.stubEnv("ADMIN_SESSION_SECRET", secret ?? "");
    if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    expect(await verifyAdminSession(token)).toBe(false);
    await expect(createAdminSession()).rejects.toBeInstanceOf(AdminSessionConfigurationError);
  });
});
