/**
 * Tests for UpdateUserProfile function
 *
 * @module functions/update_user_profile/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { UpdateUserProfileDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("update_user_profile");

/**
 * Mock users.profile.set API response
 */
function mockProfileSet(success: boolean, error?: string) {
  return {
    ok: success,
    error: error,
    profile: success
      ? {
        display_name: "Test User",
        title: "Engineer",
      }
      : undefined,
  };
}

Deno.test("UpdateUserProfile - 関数定義が正しく設定されている", () => {
  assertEquals(
    UpdateUserProfileDefinition.definition.callback_id,
    "update_user_profile",
  );
  assertEquals(
    UpdateUserProfileDefinition.definition.title,
    "プロフィール更新",
  );
});

Deno.test("UpdateUserProfile - プロフィールを正常に更新できる", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockProfileSet(true)));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U001",
      display_name: "New Name",
      title: "Senior Engineer",
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.updated_fields?.includes("display_name"), true);
  assertEquals(result.outputs?.updated_fields?.includes("title"), true);
  assertEquals(result.outputs?.updated_fields?.length, 2);

  mf.reset();
});

Deno.test("UpdateUserProfile - 単一フィールドのみ更新できる", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockProfileSet(true)));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U001",
      phone: "+81-90-1234-5678",
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.updated_fields?.length, 1);
  assertEquals(result.outputs?.updated_fields?.[0], "phone");

  mf.reset();
});

Deno.test("UpdateUserProfile - Admin Tokenがない場合はエラーを返す", async () => {
  const context = createContext({
    inputs: {
      target_user_id: "U001",
      display_name: "New Name",
    },
    env: {},
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");
  assertEquals(result.error?.includes("SLACK_ADMIN_USER_TOKEN"), true);

  mf.reset();
});

Deno.test("UpdateUserProfile - 更新フィールドがない場合はエラーを返す", async () => {
  const context = createContext({
    inputs: {
      target_user_id: "U001",
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("UpdateUserProfile - API エラー時にエラーを返す", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(
      JSON.stringify(mockProfileSet(false, "user_not_found")),
    );
  });

  const context = createContext({
    inputs: {
      target_user_id: "U001",
      display_name: "New Name",
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(typeof result.error, "string");
  assertEquals(result.error?.includes("user_not_found"), true);

  mf.reset();
});

Deno.test("UpdateUserProfile - 全フィールドを更新できる", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockProfileSet(true)));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U001",
      display_name: "New Name",
      title: "Manager",
      phone: "+1-555-1234",
      pronouns: "they/them",
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.updated_fields?.length, 4);
  assertEquals(result.outputs?.updated_fields?.includes("display_name"), true);
  assertEquals(result.outputs?.updated_fields?.includes("title"), true);
  assertEquals(result.outputs?.updated_fields?.includes("phone"), true);
  assertEquals(result.outputs?.updated_fields?.includes("pronouns"), true);

  mf.reset();
});

Deno.test("UpdateUserProfile - 空文字列のフィールドは無視される", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(JSON.stringify(mockProfileSet(true)));
  });

  const context = createContext({
    inputs: {
      target_user_id: "U001",
      display_name: "New Name",
      title: "", // Empty string should be ignored
      phone: "", // Empty string should be ignored
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.updated_fields?.length, 1);
  assertEquals(result.outputs?.updated_fields?.[0], "display_name");

  mf.reset();
});

Deno.test("UpdateUserProfile - レート制限エラーを適切に処理する", async () => {
  mf.mock("POST@/api/users.profile.set", () => {
    return new Response(
      JSON.stringify(mockProfileSet(false, "rate_limited")),
    );
  });

  const context = createContext({
    inputs: {
      target_user_id: "U001",
      display_name: "New Name",
    },
    env: {
      SLACK_ADMIN_USER_TOKEN: "xoxp-test-token",
    },
  });
  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.error?.includes("rate_limited"), true);

  mf.reset();
});
