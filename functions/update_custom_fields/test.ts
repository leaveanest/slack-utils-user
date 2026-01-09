/**
 * Tests for UpdateCustomFields function
 *
 * @module functions/update_custom_fields/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { UpdateCustomFieldsDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("update_custom_fields");

/**
 * Mock users.profile.set API success response
 */
function mockProfileSetSuccess() {
  return {
    ok: true,
    profile: {
      fields: {
        Xf123: { value: "New Value", alt: "" },
      },
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

Deno.test("UpdateCustomFields - 関数定義が正しく設定されている", () => {
  assertEquals(
    UpdateCustomFieldsDefinition.definition.callback_id,
    "update_custom_fields",
  );
  assertEquals(
    UpdateCustomFieldsDefinition.definition.title,
    "カスタムフィールド更新",
  );
});

Deno.test("UpdateCustomFields - カスタムフィールドを正常に更新できる", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockProfileSetSuccess()));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: JSON.stringify({ Xf123: "New Value" }),
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.updated_fields?.length, 1);
  assertEquals(result.outputs?.updated_fields?.[0], "Xf123");

  mf.reset();
});

Deno.test("UpdateCustomFields - 複数フィールドを更新できる", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockProfileSetSuccess()));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: JSON.stringify({
        Xf123: "Value1",
        Xf456: "Value2",
        Xf789: "Value3",
      }),
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.updated_fields?.length, 3);

  mf.reset();
});

Deno.test("UpdateCustomFields - Admin Tokenがない場合はエラーを返す", async () => {
  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: JSON.stringify({ Xf123: "New Value" }),
    },
    env: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.updated_fields?.length, 0);
  assertEquals(typeof result.outputs?.error, "string");

  mf.reset();
});

Deno.test("UpdateCustomFields - 無効なJSON形式の場合はエラーを返す", async () => {
  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: "invalid json",
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.updated_fields?.length, 0);
  assertEquals(typeof result.outputs?.error, "string");

  mf.reset();
});

Deno.test("UpdateCustomFields - 空のフィールド更新の場合はエラーを返す", async () => {
  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: JSON.stringify({}),
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.updated_fields?.length, 0);
  assertEquals(typeof result.outputs?.error, "string");

  mf.reset();
});

Deno.test("UpdateCustomFields - APIエラー時はエラーを返す", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockApiError("user_not_found")));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: JSON.stringify({ Xf123: "New Value" }),
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.updated_fields?.length, 0);
  assertEquals(typeof result.outputs?.error, "string");
  assertEquals(result.outputs?.error?.includes("user_not_found"), true);

  mf.reset();
});

Deno.test("UpdateCustomFields - レート制限エラーを適切に処理する", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockApiError("rate_limited")));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U0812GLUZD2",
      field_updates: JSON.stringify({ Xf123: "New Value" }),
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.error?.includes("rate_limited"), true);

  mf.reset();
});

Deno.test("UpdateCustomFields - 無効なユーザーIDの場合はエラーを返す", async () => {
  const context = createContext({
    inputs: {
      target_user_id: "invalid_user_id",
      field_updates: JSON.stringify({ Xf123: "New Value" }),
    },
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.outputs?.error, "string");

  mf.reset();
});
