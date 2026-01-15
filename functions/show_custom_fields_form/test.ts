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
 * Mock users.profile.get API response with custom field values
 */
function mockUsersProfileGet(
  fieldValues?: Record<string, { value: string }>,
) {
  return {
    ok: true,
    profile: {
      fields: fieldValues ?? {},
    },
  };
}

/**
 * Mock auth.test API response
 */
function mockAuthTest() {
  return {
    ok: true,
    team_id: "T12345",
    user_id: "U001",
  };
}

/**
 * Mock users.info API response
 */
function mockUsersInfo(isAdmin: boolean) {
  return {
    ok: true,
    user: {
      id: "U001",
      is_admin: isAdmin,
      is_owner: false,
      is_primary_owner: false,
    },
  };
}

/**
 * Mock admin.users.list API response
 */
function mockAdminUsersList(
  approvers: Array<{ id: string; username: string; is_admin: boolean }>,
) {
  return {
    ok: true,
    users: approvers.map((a) => ({
      id: a.id,
      username: a.username,
      full_name: a.username,
      is_admin: a.is_admin,
      is_owner: false,
      is_primary_owner: false,
      is_bot: false,
      deleted: false,
      is_restricted: false,
      is_ultra_restricted: false,
    })),
    response_metadata: {
      next_cursor: "",
    },
  };
}

/**
 * Setup common mocks for all tests
 */
function setupCommonMocks(options: {
  isAdmin?: boolean;
  approvers?: Array<{ id: string; username: string; is_admin: boolean }>;
} = {}) {
  const { isAdmin = true, approvers = [] } = options;

  // Mock auth.test
  mf.mock("POST@/api/auth.test", () => {
    return new Response(JSON.stringify(mockAuthTest()));
  });

  // Mock users.info
  mf.mock("POST@/api/users.info", () => {
    return new Response(JSON.stringify(mockUsersInfo(isAdmin)));
  });

  // Mock admin.users.list
  mf.mock("GET@/api/admin.users.list", () => {
    return new Response(JSON.stringify(mockAdminUsersList(approvers)));
  });
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
  setupCommonMocks({ isAdmin: true });

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

  // Mock users.profile.get
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(JSON.stringify(mockUsersProfileGet()));
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (form modal)
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

Deno.test("ShowCustomFieldsForm - カスタムフィールドがない場合はメッセージを表示する", async () => {
  setupCommonMocks({ isAdmin: true });

  // Mock team.profile.get with no fields
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet([])),
    );
  });

  // Mock users.profile.get
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(JSON.stringify(mockUsersProfileGet()));
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (no fields message)
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

  // Should return success with outputs (not completed: false)
  assertEquals(result.outputs?.success, true);

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - 非表示フィールドはフィルタリングされる", async () => {
  setupCommonMocks({ isAdmin: true });

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

  // Mock users.profile.get
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(JSON.stringify(mockUsersProfileGet()));
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (no fields message)
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

  // Should return success (no visible fields = show message)
  assertEquals(result.outputs?.success, true);

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - 保護されたフィールドはフィルタリングされる", async () => {
  setupCommonMocks({ isAdmin: true });

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

  // Mock users.profile.get
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(JSON.stringify(mockUsersProfileGet()));
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (no fields message)
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

  // Should return success (no visible fields = show message)
  assertEquals(result.outputs?.success, true);

  mf.reset();
});

Deno.test("ShowCustomFieldsForm - views.open失敗時にエラーを返す", async () => {
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
  setupCommonMocks({ isAdmin: true });

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

  // Mock users.profile.get with initial value
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(
      JSON.stringify(mockUsersProfileGet({ Xf789: { value: "2024-01-15" } })),
    );
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (form modal)
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

Deno.test("ShowCustomFieldsForm - options_listタイプのフィールドが正しく処理される", async () => {
  setupCommonMocks({ isAdmin: true });

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

  // Mock users.profile.get with initial value
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(
      JSON.stringify(mockUsersProfileGet({ Xf456: { value: "Engineer" } })),
    );
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (form modal)
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

Deno.test("ShowCustomFieldsForm - 非管理者ユーザーには承認者選択が表示される", async () => {
  setupCommonMocks({
    isAdmin: false,
    approvers: [{ id: "U002", username: "admin_user", is_admin: true }],
  });

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

  // Mock users.profile.get
  mf.mock("POST@/api/users.profile.get", () => {
    return new Response(JSON.stringify(mockUsersProfileGet()));
  });

  // Mock views.open (loading modal)
  mf.mock("POST@/api/views.open", () => {
    return new Response(JSON.stringify(mockViewsOpen(true, "V12345")));
  });

  // Mock views.update (form modal with approver selection)
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

Deno.test("ShowCustomFieldsForm - SLACK_ADMIN_USER_TOKEN未設定時にエラーを返す", async () => {
  // Mock views.open (loading modal)
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
    env: {}, // No admin token
  });

  const result = await handler(context);

  assertEquals(typeof result.error, "string");

  mf.reset();
});
