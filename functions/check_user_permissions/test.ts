/**
 * Tests for CheckUserPermissions function
 *
 * @module functions/check_user_permissions/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { CheckUserPermissionsDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("check_user_permissions");

/**
 * Mock users.info API response
 */
function mockUsersInfo(user: {
  id: string;
  name?: string;
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
}) {
  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name ?? "test_user",
      is_admin: user.is_admin ?? false,
      is_owner: user.is_owner ?? false,
      is_primary_owner: user.is_primary_owner ?? false,
    },
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

Deno.test("CheckUserPermissions - 関数定義が正しく設定されている", () => {
  assertEquals(
    CheckUserPermissionsDefinition.definition.callback_id,
    "check_user_permissions",
  );
  assertEquals(
    CheckUserPermissionsDefinition.definition.title,
    "権限チェック",
  );
});

Deno.test("CheckUserPermissions - Adminは直接実行可能", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001", is_admin: true })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U002",
      requested_fields: ["display_name", "title"],
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, true);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(result.outputs?.is_admin, true);
  assertEquals(result.outputs?.denied_fields?.length, 0);

  mf.reset();
});

Deno.test("CheckUserPermissions - Ownerは直接実行可能", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001", is_owner: true })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U002",
      requested_fields: ["display_name", "title"],
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, true);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(result.outputs?.is_owner, true);

  mf.reset();
});

Deno.test("CheckUserPermissions - 一般ユーザーが自分のプロフィールの許可フィールドを更新する場合は直接実行可能", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001" })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U001", // Self
      requested_fields: ["display_name", "phone", "pronouns"], // Allowed self-edit fields
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, true);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(result.outputs?.denied_fields?.length, 0);

  mf.reset();
});

Deno.test("CheckUserPermissions - 一般ユーザーが自分のプロフィールの非許可フィールドを更新する場合は承認が必要", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001" })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U001", // Self
      requested_fields: ["title"], // Not in allowed_self_edit_fields
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, false);
  assertEquals(result.outputs?.requires_approval, true);

  mf.reset();
});

Deno.test("CheckUserPermissions - 一般ユーザーが他ユーザーのプロフィールを更新する場合は承認が必要", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001" })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U002", // Different user
      requested_fields: ["display_name", "title"],
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, false);
  assertEquals(result.outputs?.requires_approval, true);

  mf.reset();
});

Deno.test("CheckUserPermissions - Admin専用フィールドは非Adminには拒否される", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001" })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U001",
      requested_fields: ["start_date", "employee_id"], // Admin-only fields
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, false);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(result.outputs?.denied_fields?.length, 2);
  assertEquals(result.outputs?.denied_fields?.includes("start_date"), true);
  assertEquals(result.outputs?.denied_fields?.includes("employee_id"), true);

  mf.reset();
});

Deno.test("CheckUserPermissions - AdminはAdmin専用フィールドも直接更新可能", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001", is_admin: true })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U002",
      requested_fields: ["start_date", "employee_id"], // Admin-only fields
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, true);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(result.outputs?.denied_fields?.length, 0);

  mf.reset();
});

Deno.test("CheckUserPermissions - ユーザー情報取得エラー時はエラーを返す", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockApiError("user_not_found")),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U002",
      requested_fields: ["display_name"],
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, false);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("CheckUserPermissions - Primary Ownerは直接実行可能", async () => {
  mf.mock("POST@/api/users.info", () => {
    return new Response(
      JSON.stringify(mockUsersInfo({ id: "U001", is_primary_owner: true })),
    );
  });

  const context = createContext({
    inputs: {
      operator_id: "U001",
      target_user_id: "U002",
      requested_fields: ["display_name", "title", "start_date"],
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.can_execute_directly, true);
  assertEquals(result.outputs?.requires_approval, false);
  assertEquals(result.outputs?.is_owner, true); // Primary Owner counts as Owner
  assertEquals(result.outputs?.denied_fields?.length, 0);

  mf.reset();
});
