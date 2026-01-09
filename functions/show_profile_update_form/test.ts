/**
 * Tests for ShowProfileUpdateForm function
 *
 * @module functions/show_profile_update_form/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { ShowProfileUpdateFormDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("show_profile_update_form");

/**
 * Mock views.open API response
 */
function mockViewsOpen(success: boolean, viewId?: string) {
  return {
    ok: success,
    view: success ? { id: viewId ?? "V12345" } : undefined,
    error: success ? undefined : "trigger_expired",
  };
}

/**
 * Mock views.update API response
 */
function mockViewsUpdate(success: boolean) {
  return {
    ok: success,
    error: success ? undefined : "view_not_found",
  };
}

/**
 * Mock users.info API response
 */
function mockUsersInfo(user: {
  id: string;
  is_admin?: boolean;
  is_owner?: boolean;
}) {
  return {
    ok: true,
    user: {
      id: user.id,
      is_admin: user.is_admin ?? false,
      is_owner: user.is_owner ?? false,
      is_primary_owner: false,
    },
  };
}

/**
 * Mock users.list API response
 */
function mockUsersList(
  members: Array<{
    id: string;
    name: string;
    is_admin?: boolean;
    is_owner?: boolean;
  }>,
) {
  return {
    ok: true,
    members: members.map((m) => ({
      ...m,
      is_bot: false,
      deleted: false,
    })),
    response_metadata: { next_cursor: "" },
  };
}

/**
 * Mock admin.users.list API response
 */
function mockAdminUsersList(
  users: Array<{
    id: string;
    username: string;
    full_name?: string;
    is_admin?: boolean;
    is_owner?: boolean;
  }>,
) {
  return {
    ok: true,
    users: users.map((u) => ({
      ...u,
      is_bot: false,
      deleted: false,
      is_restricted: false,
      is_ultra_restricted: false,
    })),
    response_metadata: { next_cursor: "" },
  };
}

/**
 * Mock auth.test API response
 */
function mockAuthTest(teamId: string = "T001") {
  return {
    ok: true,
    team_id: teamId,
    user_id: "U_BOT",
  };
}

/**
 * Mock users.list API error response
 */
function mockUsersListError(error: string) {
  return {
    ok: false,
    error,
  };
}

/**
 * Mock users.info API error response
 */
function mockUsersInfoError(error: string) {
  return {
    ok: false,
    error,
  };
}

Deno.test("ShowProfileUpdateForm - 関数定義が正しく設定されている", () => {
  assertEquals(
    ShowProfileUpdateFormDefinition.definition.callback_id,
    "show_profile_update_form",
  );
  assertEquals(
    ShowProfileUpdateFormDefinition.definition.title,
    "プロフィール更新フォーム表示",
  );
});

Deno.test("ShowProfileUpdateForm - ローディングモーダルを表示してからフォームを更新する", async () => {
  // Mock views.open
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock users.info for permission check
  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfo({ id: "U001" })));
  });

  // Mock admin.users.list for approvers
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "UADMIN", username: "admin", is_admin: true },
        ]),
      ),
    );
  });

  // Mock views.update
  mf.mock("POST@/api/views.update", () => {
    return new Response(JSON.stringify(mockViewsUpdate(true)));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  // Should return completed: false to wait for form submission
  assertEquals(result.completed, false);
  assertEquals(result.error, undefined);

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - views.open失敗時にエラーを返す", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(false)));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - Adminユーザーでもフォーム表示が成功する", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001", is_admin: true })),
    );
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "UADMIN2", username: "admin2", is_admin: true },
        ]),
      ),
    );
  });

  mf.mock("POST@/api/views.update", () => {
    return new Response(JSON.stringify(mockViewsUpdate(true)));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  // Should return completed: false to wait for form submission
  assertEquals(result.completed, false);
  assertEquals(result.error, undefined);

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - 一般ユーザーでもフォーム表示が成功する", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfo({ id: "U001" })));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "UADMIN", username: "admin", is_admin: true },
          { id: "UOWNER", username: "owner", is_owner: true },
        ]),
      ),
    );
  });

  mf.mock("POST@/api/views.update", () => {
    return new Response(JSON.stringify(mockViewsUpdate(true)));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  // Should return completed: false to wait for form submission
  assertEquals(result.completed, false);
  assertEquals(result.error, undefined);

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - views.update失敗時にエラーを返す", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfo({ id: "U001" })));
  });

  mf.mock("POST@/api/users.list", () => {
    return new Response(JSON.stringify(mockUsersList([])));
  });

  mf.mock("POST@/api/views.update", () => {
    return new Response(JSON.stringify(mockViewsUpdate(false)));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - users.list失敗時にエラーを返す", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfo({ id: "U001" })));
  });

  // users.list fails
  mf.mock("POST@/api/users.list", () => {
    return new Response(JSON.stringify(mockUsersListError("users_list_error")));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
  });

  const result = await handler(context);

  // Should return error when users.list fails
  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - users.listレート制限時にエラーを返す", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfo({ id: "U001" })));
  });

  // users.list rate limited
  mf.mock("POST@/api/users.list", () => {
    return new Response(JSON.stringify(mockUsersListError("ratelimited")));
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
  });

  const result = await handler(context);

  // Should return error when rate limited
  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("ShowProfileUpdateForm - users.info失敗時にエラーを返す", async () => {
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // users.info fails
  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfoError("user_not_found")));
  });

  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(
        mockUsersList([{ id: "UADMIN", name: "admin", is_admin: true }]),
      ),
    );
  });

  const context = createContext({
    inputs: {
      interactivity: {
        interactivity_pointer: "trigger_12345",
        interactor: { id: "U001", secret: "secret" },
      },
      user_id: "U001",
      channel_id: "C001",
    },
  });

  const result = await handler(context);

  // Should return error when users.info fails
  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});
