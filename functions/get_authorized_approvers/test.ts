/**
 * Tests for GetAuthorizedApprovers function
 *
 * @module functions/get_authorized_approvers/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { GetAuthorizedApproversDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("get_authorized_approvers");

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
    is_primary_owner?: boolean;
    is_bot?: boolean;
    deleted?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
  }>,
  options?: {
    nextCursor?: string;
  },
) {
  return {
    ok: true,
    users,
    response_metadata: {
      next_cursor: options?.nextCursor ?? "",
    },
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
 * Mock API error response
 */
function mockApiError(errorCode: string) {
  return {
    ok: false,
    error: errorCode,
  };
}

/**
 * Parse approvers from JSON output
 */
function parseApprovers(json: string | undefined) {
  if (!json) return [];
  return JSON.parse(json) as Array<{
    id: string;
    name: string;
    real_name?: string;
    is_admin: boolean;
    is_owner: boolean;
    is_primary_owner: boolean;
  }>;
}

Deno.test("GetAuthorizedApprovers - 関数定義が正しく設定されている", () => {
  assertEquals(
    GetAuthorizedApproversDefinition.definition.callback_id,
    "get_authorized_approvers",
  );
  assertEquals(
    GetAuthorizedApproversDefinition.definition.title,
    "承認者取得",
  );
});

Deno.test("GetAuthorizedApprovers - Admin/Ownerユーザーを正しく取得できる", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          {
            id: "U001",
            username: "admin_user",
            full_name: "Admin User",
            is_admin: true,
          },
          {
            id: "U002",
            username: "owner_user",
            full_name: "Owner User",
            is_owner: true,
          },
          {
            id: "U003",
            username: "primary_owner",
            full_name: "Primary Owner",
            is_primary_owner: true,
          },
          { id: "U004", username: "regular_user", full_name: "Regular User" },
        ]),
      ),
    );
  });

  const context = createContext({
    inputs: {},
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 3);
  assertEquals(result.outputs?.approver_ids?.length, 3);

  const approverIds = result.outputs?.approver_ids;
  assertEquals(approverIds?.includes("U001"), true);
  assertEquals(approverIds?.includes("U002"), true);
  assertEquals(approverIds?.includes("U003"), true);
  assertEquals(approverIds?.includes("U004"), false);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - ボットと削除済みユーザーを除外する", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "U001", username: "admin_user", is_admin: true },
          { id: "B001", username: "bot_admin", is_admin: true, is_bot: true },
          {
            id: "U002",
            username: "deleted_admin",
            is_admin: true,
            deleted: true,
          },
        ]),
      ),
    );
  });

  const context = createContext({
    inputs: {},
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 1);
  assertEquals(result.outputs?.approver_ids?.[0], "U001");

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - exclude_user_idで指定したユーザーを除外する", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "U001", username: "admin_user", is_admin: true },
          { id: "U002", username: "owner_user", is_owner: true },
        ]),
      ),
    );
  });

  const context = createContext({
    inputs: { exclude_user_id: "U001" },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 1);
  assertEquals(result.outputs?.approver_ids?.[0], "U002");

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - Admin/Ownerが存在しない場合は空配列を返す", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "U001", username: "regular_user1" },
          { id: "U002", username: "regular_user2" },
        ]),
      ),
    );
  });

  const context = createContext({
    inputs: {},
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 0);
  assertEquals(result.outputs?.approver_ids?.length, 0);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - ページネーションを正しく処理できる", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  let callCount = 0;

  // Mock admin.users.list with pagination
  mf.mock("GET@/api/admin.users.list", () => {
    callCount++;

    if (callCount === 1) {
      return new Response(
        JSON.stringify(
          mockAdminUsersList(
            [
              { id: "U001", username: "admin1", is_admin: true },
              { id: "U002", username: "admin2", is_admin: true },
            ],
            { nextCursor: "cursor_page_2" },
          ),
        ),
      );
    }

    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          { id: "U003", username: "owner1", is_owner: true },
          { id: "U004", username: "owner2", is_owner: true },
        ]),
      ),
    );
  });

  const context = createContext({
    inputs: {},
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 4);
  assertEquals(result.outputs?.approver_ids?.length, 4);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - APIエラー時にエラーを返す", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock admin.users.list error
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(mockApiError("users_list_not_allowed")),
    );
  });

  const context = createContext({
    inputs: {},
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 0);
  assertEquals(result.outputs?.approver_ids?.length, 0);
  assertEquals(typeof result.error, "string");
  assertEquals(result.error?.includes("users_list_not_allowed"), true);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - approverの属性がJSON形式で正しく設定される", async () => {
  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest("T001")));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(
      JSON.stringify(
        mockAdminUsersList([
          {
            id: "U001",
            username: "full_approver",
            full_name: "Full Approver",
            is_admin: true,
            is_owner: true,
            is_primary_owner: true,
          },
        ]),
      ),
    );
  });

  const context = createContext({
    inputs: {},
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });
  const result = await handler(context);

  const approvers = parseApprovers(result.outputs?.approvers_json);
  assertEquals(approvers.length, 1);

  const approver = approvers[0];
  assertEquals(approver?.id, "U001");
  assertEquals(approver?.name, "full_approver");
  assertEquals(approver?.real_name, "Full Approver");
  assertEquals(approver?.is_admin, true);
  assertEquals(approver?.is_owner, true);
  assertEquals(approver?.is_primary_owner, true);

  mf.reset();
});
