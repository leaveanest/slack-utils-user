/**
 * Tests for GetCustomFieldDefinitions function
 *
 * @module functions/get_custom_field_definitions/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { GetCustomFieldDefinitionsDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";
import type {
  CustomFieldDefinitionDetail,
  CustomFieldSection,
} from "../../lib/types/custom_fields.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("get_custom_field_definitions");

/**
 * Create a mock custom field definition
 */
function createMockField(
  overrides: Partial<CustomFieldDefinitionDetail> = {},
): CustomFieldDefinitionDetail {
  return {
    id: "Xf123",
    ordering: 0,
    label: "Test Field",
    hint: "Test hint",
    type: "text",
    possible_values: null,
    options: { is_scim: false, is_protected: false },
    is_hidden: false,
    section_id: "S123",
    ...overrides,
  };
}

/**
 * Create a mock section definition
 */
function createMockSection(
  overrides: Partial<CustomFieldSection> = {},
): CustomFieldSection {
  return {
    id: "S123",
    team_id: "T001",
    section_type: "custom",
    label: "Test Section",
    order: 0,
    is_hidden: false,
    ...overrides,
  };
}

/**
 * Mock team.profile.get API response
 */
function mockTeamProfileGet(
  fields: CustomFieldDefinitionDetail[] = [],
  sections: CustomFieldSection[] = [],
) {
  return {
    ok: true,
    profile: { fields, sections },
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

Deno.test("GetCustomFieldDefinitions - 関数定義が正しく設定されている", () => {
  assertEquals(
    GetCustomFieldDefinitionsDefinition.definition.callback_id,
    "get_custom_field_definitions",
  );
  assertEquals(
    GetCustomFieldDefinitionsDefinition.definition.title,
    "カスタムフィールド定義取得",
  );
});

Deno.test("GetCustomFieldDefinitions - 正常にフィールド定義を取得できる", async () => {
  const mockFields = [
    createMockField({
      id: "Xf001",
      label: "部署",
      type: "options_list",
      possible_values: ["営業部", "開発部"],
    }),
    createMockField({
      id: "Xf002",
      label: "入社日",
      type: "date",
    }),
  ];

  const mockSections = [
    createMockSection({ id: "S001", label: "会社情報" }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, mockSections)),
    );
  });

  const context = createContext({
    inputs: { include_hidden: false },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.field_count, 2);
  assertEquals(result.outputs?.fields?.length, 2);
  assertEquals(result.outputs?.sections?.length, 1);

  const field1 = result.outputs?.fields?.[0];
  assertEquals(field1?.id, "Xf001");
  assertEquals(field1?.label, "部署");
  assertEquals(field1?.type, "options_list");
  assertEquals(field1?.possible_values, ["営業部", "開発部"]);

  const section1 = result.outputs?.sections?.[0];
  assertEquals(section1?.id, "S001");
  assertEquals(section1?.label, "会社情報");

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - フィールドがない場合は空配列を返す", async () => {
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet([], [])),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.field_count, 0);
  assertEquals(result.outputs?.fields?.length, 0);
  assertEquals(result.outputs?.sections?.length, 0);

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - APIエラー時はエラーを返す", async () => {
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockApiError("team_not_found")),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.field_count, 0);
  assertEquals(typeof result.outputs?.error, "string");
  assertEquals(result.outputs?.error?.includes("team_not_found"), true);

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - 非表示フィールドをフィルタリングできる", async () => {
  const mockFields = [
    createMockField({ id: "Xf001", label: "表示フィールド", is_hidden: false }),
    createMockField({
      id: "Xf002",
      label: "非表示フィールド",
      is_hidden: true,
    }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, [])),
    );
  });

  // include_hidden: false (default) - 非表示フィールドを除外
  const context = createContext({
    inputs: { include_hidden: false },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.field_count, 1);
  assertEquals(result.outputs?.fields?.[0]?.id, "Xf001");

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - include_hidden:true で非表示フィールドを含める", async () => {
  const mockFields = [
    createMockField({ id: "Xf001", label: "表示フィールド", is_hidden: false }),
    createMockField({
      id: "Xf002",
      label: "非表示フィールド",
      is_hidden: true,
    }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, [])),
    );
  });

  // include_hidden: true - 非表示フィールドを含める
  const context = createContext({
    inputs: { include_hidden: true },
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.field_count, 2);

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - 保護フィールドのフラグが正しく設定される", async () => {
  const mockFields = [
    createMockField({
      id: "Xf001",
      label: "通常フィールド",
      options: { is_scim: false, is_protected: false },
    }),
    createMockField({
      id: "Xf002",
      label: "保護フィールド",
      options: { is_scim: true, is_protected: true },
    }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, [])),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.fields?.[0]?.is_protected, false);
  assertEquals(result.outputs?.fields?.[1]?.is_protected, true);

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - 各フィールドタイプを正しく処理できる", async () => {
  const mockFields = [
    createMockField({
      id: "Xf001",
      label: "テキストフィールド",
      type: "text",
    }),
    createMockField({
      id: "Xf002",
      label: "選択フィールド",
      type: "options_list",
      possible_values: ["選択肢1", "選択肢2", "選択肢3"],
    }),
    createMockField({
      id: "Xf003",
      label: "日付フィールド",
      type: "date",
    }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, [])),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.field_count, 3);

  assertEquals(result.outputs?.fields?.[0]?.type, "text");
  assertEquals(result.outputs?.fields?.[1]?.type, "options_list");
  assertEquals(result.outputs?.fields?.[1]?.possible_values?.length, 3);
  assertEquals(result.outputs?.fields?.[2]?.type, "date");

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - 非表示セクションをフィルタリングする", async () => {
  const mockSections = [
    createMockSection({
      id: "S001",
      label: "表示セクション",
      is_hidden: false,
    }),
    createMockSection({
      id: "S002",
      label: "非表示セクション",
      is_hidden: true,
    }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet([], mockSections)),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.sections?.length, 1);
  assertEquals(result.outputs?.sections?.[0]?.id, "S001");

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - hintが空の場合は空文字列を返す", async () => {
  const mockFields = [
    createMockField({ id: "Xf001", hint: "" }),
    createMockField({ id: "Xf002", hint: "ヒントあり" }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, [])),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.fields?.[0]?.hint, "");
  assertEquals(result.outputs?.fields?.[1]?.hint, "ヒントあり");

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - possible_valuesがnullの場合は空配列を返す", async () => {
  const mockFields = [
    createMockField({
      id: "Xf001",
      type: "text",
      possible_values: null,
    }),
  ];

  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify(mockTeamProfileGet(mockFields, [])),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.fields?.[0]?.possible_values, []);

  mf.reset();
});

Deno.test("GetCustomFieldDefinitions - profileが存在しない場合は空配列を返す", async () => {
  mf.mock("POST@/api/team.profile.get", () => {
    return new Response(
      JSON.stringify({ ok: true, profile: null }),
    );
  });

  const context = createContext({
    inputs: {},
  });

  const result = await handler(context);

  assertEquals(result.outputs?.success, true);
  assertEquals(result.outputs?.field_count, 0);
  assertEquals(result.outputs?.fields?.length, 0);
  assertEquals(result.outputs?.sections?.length, 0);

  mf.reset();
});
