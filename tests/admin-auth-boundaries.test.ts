import React from "react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  searchLogs: vi.fn(),
  meets: vi.fn(),
  meet: vi.fn(),
  count: vi.fn(),
  deleteResults: vi.fn(),
  deleteMeet: vi.fn(),
  publish: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie === undefined ? undefined : { value: state.cookie } }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: any) => React.createElement("a", props, props.children) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  searchLog: { findMany: (...args: unknown[]) => state.searchLogs(...args) },
  meet: { findMany: (...args: unknown[]) => state.meets(...args), findUnique: (...args: unknown[]) => state.meet(...args), delete: (...args: unknown[]) => state.deleteMeet(...args) },
  result: { count: (...args: unknown[]) => state.count(...args), deleteMany: (...args: unknown[]) => state.deleteResults(...args) },
  publishWindow: { upsert: (...args: unknown[]) => state.publish(...args) }
} }));

import { POST as login } from "../app/api/admin/login/route";
import { GET as logs } from "../app/api/admin/logs/route";
import { middleware } from "../middleware";
import { createAdminSession } from "../lib/admin-session";
import LogsPage from "../app/admin/logs/page";
import MeetsPage from "../app/admin/meets/page";
import MeetPreviewPage from "../app/admin/meets/[id]/page";
import PublishPage from "../app/admin/publish/page";

function loginRequest(password: string): Request {
  return new Request("https://example.com/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
}

function formAction(node: unknown): (data: FormData) => Promise<void> {
  const visit = (value: any): any => {
    if (!value || typeof value !== "object") return undefined;
    if (Array.isArray(value)) return value.map(visit).find(Boolean);
    if (value.type === "form" && typeof value.props.action === "function") return value.props.action;
    return visit(value.props?.children);
  };
  const action = visit(node);
  if (!action) throw new Error("Form action missing");
  return action;
}

describe("admin authorization at request and data boundaries", () => {
  beforeEach(() => {
    // Vitest's classic JSX transform needs React in scope for Next page modules.
    vi.stubGlobal("React", React);
    vi.stubEnv("ADMIN_PASSWORD", "test-password");
    vi.stubEnv("ADMIN_SESSION_SECRET", "a1".repeat(32));
    state.cookie = undefined;
    vi.clearAllMocks();
    state.searchLogs.mockResolvedValue([]);
    state.count.mockResolvedValue(1);
    state.meets.mockResolvedValue([{ id: "meet-1", program: "swimming", title: "2026年9月", heldOn: new Date("2026-09-01"), createdAt: new Date("2026-09-01"), _count: { results: 1 } }]);
    state.publish.mockResolvedValue({ publishFrom: null, publishUntil: null, announcement: null });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("logs in with a signed eight-hour production cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await login(loginRequest("test-password"));
    expect(response.status).toBe(200);
    const cookie = response.cookies.get("admin_session");
    expect(cookie?.value).toMatch(/^v1\./);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 28800 });
    state.cookie = cookie?.value;
    expect((await logs()).status).toBe(200);
    expect(state.searchLogs).toHaveBeenCalledOnce();
  });

  it("rejects bad passwords, invalid JSON, and missing signing configuration without setting cookies", async () => {
    expect((await login(loginRequest("wrong"))).status).toBe(401);
    expect((await login(new Request("https://example.com/api/admin/login", { method: "POST", body: "bad" }))).status).toBe(400);
    delete process.env.ADMIN_SESSION_SECRET;
    const response = await login(loginRequest("test-password"));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([undefined, "1", "forged"])("awaits authentication and rejects API access for cookie %s before DB access", async (cookie) => {
    state.cookie = cookie;
    expect((await logs()).status).toBe(401);
    expect(state.searchLogs).not.toHaveBeenCalled();
  });

  it("redirects forged sessions in middleware, accepts signed sessions, and leaves login available", async () => {
    const request = (path: string, cookie: string) => new NextRequest(`https://example.com${path}`, { headers: { cookie: `admin_session=${cookie}` } });
    expect((await middleware(request("/admin/docs/swimming", "1"))).headers.get("location")).toBe("https://example.com/admin");
    expect((await middleware(request("/admin/docs/swimming", await createAdminSession()))).status).toBe(200);
    expect((await middleware(request("/admin", "1"))).status).toBe(200);
  });

  it("blocks all four server pages before DB reads or publish initialization", async () => {
    state.cookie = "1";
    for (const render of [() => LogsPage(), () => MeetsPage({}), () => MeetPreviewPage({ params: Promise.resolve({ id: "meet-1" }) }), () => PublishPage()]) {
      await expect(render()).rejects.toThrow("REDIRECT:/admin");
    }
    for (const fn of [state.searchLogs, state.count, state.meets, state.meet, state.publish]) expect(fn).not.toHaveBeenCalled();
  });

  it("uses the resolved program query when loading the authenticated meet list", async () => {
    state.cookie = await createAdminSession();
    await MeetsPage({ searchParams: Promise.resolve({ program: "school" }) });
    expect(state.meets).toHaveBeenCalledWith(expect.objectContaining({ where: { program: "school" } }));
  });

  it("uses the resolved meet ID and program when rendering an authenticated preview", async () => {
    state.cookie = await createAdminSession();
    state.meet.mockResolvedValue({ id: "meet-2", title: "2026年9月", program: "swimming", heldOn: new Date("2026-09-01"), createdAt: new Date("2026-09-01"), results: [] });
    const page = await MeetPreviewPage({ params: Promise.resolve({ id: "meet-2" }), searchParams: Promise.resolve({ program: "school" }) });
    expect(state.meet).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "meet-2" } }));
    expect(JSON.stringify(page)).toContain("/admin/meets?program=school");
  });

  it("rechecks a delete action after its rendered session has been invalidated", async () => {
    state.cookie = await createAdminSession();
    const action = formAction(await MeetsPage({}));
    vi.stubEnv("ADMIN_SESSION_SECRET", "b2".repeat(32));
    const data = new FormData();
    data.set("id", "meet-1");
    await expect(action(data)).rejects.toThrow("REDIRECT:/admin");
    expect(state.deleteResults).not.toHaveBeenCalled();
    expect(state.deleteMeet).not.toHaveBeenCalled();
    state.cookie = await createAdminSession();
    await action(data);
    expect(state.deleteResults).toHaveBeenCalledWith({ where: { meetId: "meet-1" } });
    expect(state.deleteMeet).toHaveBeenCalledWith({ where: { id: "meet-1" } });
  });

  it("rechecks a publish action independently of page authentication", async () => {
    state.cookie = await createAdminSession();
    const action = formAction(await PublishPage());
    state.publish.mockClear();
    state.cookie = undefined;
    await expect(action(new FormData())).rejects.toThrow("REDIRECT:/admin");
    expect(state.publish).not.toHaveBeenCalled();
    state.cookie = await createAdminSession();
    await action(new FormData());
    expect(state.publish).toHaveBeenCalledOnce();
  });
});
