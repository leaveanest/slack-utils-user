/**
 * Tests for ShowCustomFieldsForm function
 *
 * @module functions/show_custom_fields_form/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { ShowCustomFieldsFormDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("show_custom_fields_form");

/**
 * Mock team.profile.get API response with fields
 */
function mockTeamProfileGet(
  fields: Array<{
    id: string;
    label: string;
    type: string;
    hint?: string;
    is_hidden?: boolean;
    is_protected?: boolean;
    possible_values?: string[];
  }>,
) {
  return {
    ok: true,
    profile: {
      fields: fields.map((f) => ({
        id: f.id,
        ordering: 0,
        label: f.label,
        hint: f.hint ?? "",
        type: f.type,
        possible_values: f.possible_values ?? null,
        options: {
          is_scim: false,
          is_protected: f.is_protected ?? false,
        },
        is_hidden: f.is_hidden ?? false,
        section_id: "S001",
      })),
      sections: [],
    },
  };
}

/**
 * Mock team.profile.get API error response
 */
function mockTeamProfileGetError(error: string) {
  return {
    ok: false,
    error,
  };
}

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

Deno.test("ShowCustomFieldsForm - 関数定義が正しく設定されている", () => {
  assertEquals(
    ShowCustomFieldsFormDefinition.definition.callback_id,
    "show_custom_fields_form",
  );
  assertEquals(
    ShowCustomFieldsFormDefinition.definition.title,
    "カスタムフィールド更新フォーム表示",
  );
});

Deno.test("ShowCustomFieldsForm - カスタムフィールドがある場合はフォームを表示する", async () => {
  // Mock team.profile.get
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(
        mockTeamProfileGet([
          { id: "Xf123", label: "部門", type: "text", hint: "所属部門" },
          {
            id: "Xf456",
            label: "役職",
            type: "options_list",
            possible_values: ["Manager", "Engineer"],
          },
        ]),
      ),
    );
  });

  // Mock views.open
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
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

Deno.test("ShowCustomFieldsForm - カスタムフィールドがない場合はメッセージを表示する", async () => {
  // Mock team.profile.get with no fields
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet([])),
    );
  });

  // Mock views.open for the "no fields" message
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
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

  // Should return success with outputs (not completed: false)
  assertEquals(result.outputs?.success, true);

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - 非表示フィールドはフィルタリングされる", async () => {
  // Mock team.profile.get with hidden field
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(
        mockTeamProfileGet([
          { id: "Xf123", label: "部門", type: "text", is_hidden: true },
        ]),
      ),
    );
  });

  // Mock views.open for the "no fields" message
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
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

  // Should return success (no visible fields = show message)
  assertEquals(result.outputs?.success, true);

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - 保護されたフィールドはフィルタリングされる", async () => {
  // Mock team.profile.get with protected field
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(
        mockTeamProfileGet([
          { id: "Xf123", label: "部門", type: "text", is_protected: true },
        ]),
      ),
    );
  });

  // Mock views.open for the "no fields" message
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
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

  // Should return success (no visible fields = show message)
  assertEquals(result.outputs?.success, true);

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - team.profile.get失敗時にエラーを返す", async () => {
  // Mock team.profile.get error
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGetError("team_not_found")),
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
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - views.open失敗時にエラーを返す", async () => {
  // Mock team.profile.get
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(
        mockTeamProfileGet([
          { id: "Xf123", label: "部門", type: "text" },
        ]),
      ),
    );
  });

  // Mock views.open failure
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
    env: { SLACK_ADMIN_USER_TOKEN: "xoxp-test-token" },
  });

  const result = await handler(context);

  assertEquals(typeof result.error, "string");

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - dateタイプのフィールドが正しく処理される", async () => {
  // Mock team.profile.get with date field
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(
        mockTeamProfileGet([
          { id: "Xf789", label: "入社日", type: "date", hint: "入社年月日" },
        ]),
      ),
    );
  });

  // Mock views.open
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
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

Deno.test("ShowCustomFieldsForm - options_listタイプのフィールドが正しく処理される", async () => {
  // Mock team.profile.get with options_list field
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(
        mockTeamProfileGet([
          {
            id: "Xf456",
            label: "役職",
            type: "options_list",
            possible_values: ["Manager", "Engineer", "Designer"],
          },
        ]),
      ),
    );
  });

  // Mock views.open
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
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
