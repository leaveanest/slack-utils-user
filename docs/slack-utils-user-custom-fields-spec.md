# slack-utils-user カスタムフィールド実装仕様書

## 概要

slack-utils-userプロジェクトにおけるカスタムフィールド機能の実装仕様です。

### 参考実装

**必ず以下のリポジトリを参照してください：**

- **GitHub**: https://github.com/leaveanest/slack-utils-channel

このリポジトリには以下の実装パターンが含まれています：

| 参照ファイル                                         | 参考にする内容                                    |
| ---------------------------------------------------- | ------------------------------------------------- |
| `functions/show_private_channel_form/mod.ts`         | モーダル表示 + 承認フロー + Block Actions Handler |
| `functions/request_private_channel/mod.ts`           | 承認/却下ボタンのハンドリング                     |
| `functions/get_authorized_users/mod.ts`              | Admin/Owner取得パターン                           |
| `functions/check_private_channel_permissions/mod.ts` | Admin API呼び出しパターン                         |
| `lib/i18n/mod.ts`                                    | i18n実装（デフォルト: ja）                        |
| `lib/validation/schemas.ts`                          | Zodバリデーションスキーマ                         |
| `workflows/request_private_channel_workflow.ts`      | ワークフロー定義                                  |
| `triggers/request_private_channel_trigger.ts`        | ショートカットトリガー                            |

**Serenaでの参照方法：**

```
mcp_serena_search_for_pattern({ substring_pattern: "views.open", relative_path: "functions/" })
mcp_serena_search_for_pattern({ substring_pattern: "addViewSubmissionHandler", relative_path: "functions/" })
mcp_serena_search_for_pattern({ substring_pattern: "addBlockActionsHandler", relative_path: "functions/" })
```

### 実装対象

| 関数/ファイル              | 説明                                         |
| -------------------------- | -------------------------------------------- |
| GetCustomFieldDefinitions  | ワークスペースのカスタムフィールド定義を取得 |
| UpdateCustomFields         | カスタムフィールドの値を更新                 |
| ShowCustomFieldsForm       | カスタムフィールド更新フォームを表示         |
| UpdateCustomFieldsWorkflow | カスタムフィールド更新ワークフロー           |
| UpdateCustomFieldsShortcut | ショートカットトリガー                       |

---

## フェーズ分け

| フェーズ | ブランチ名                              | 内容                                          |
| -------- | --------------------------------------- | --------------------------------------------- |
| Phase 1  | `feature/custom-fields-get-definitions` | GetCustomFieldDefinitions関数実装             |
| Phase 2  | `feature/custom-fields-update`          | UpdateCustomFields + ShowCustomFieldsForm実装 |
| Phase 3  | `feature/custom-fields-workflow`        | ワークフロー・トリガー実装                    |

---

## 使用するSlack API

### team.profile.get

カスタムフィールド定義を取得するAPI。

**必要スコープ:** `team.profile:read`（Bot Token）

**レスポンス例:**

```json
{
  "ok": true,
  "profile": {
    "fields": [
      {
        "id": "Xf111111ABC",
        "ordering": 0,
        "label": "部署",
        "hint": "所属部署を選択してください",
        "type": "options_list",
        "possible_values": ["営業部", "開発部", "人事部"],
        "options": { "is_scim": false, "is_protected": false },
        "is_hidden": false,
        "section_id": "123ABC"
      },
      {
        "id": "Xf222222ABC",
        "ordering": 1,
        "label": "従業員番号",
        "hint": "社員番号を入力",
        "type": "text",
        "possible_values": null,
        "options": { "is_scim": true, "is_protected": true },
        "is_hidden": false,
        "section_id": "123ABC"
      },
      {
        "id": "Xf333333ABC",
        "ordering": 2,
        "label": "入社日",
        "hint": "入社した日付",
        "type": "date",
        "possible_values": null,
        "options": { "is_scim": false, "is_protected": false },
        "is_hidden": false,
        "section_id": "456DEF"
      }
    ],
    "sections": [
      {
        "id": "123ABC",
        "team_id": "T123456",
        "section_type": "custom",
        "label": "会社情報",
        "order": 1,
        "is_hidden": false
      }
    ]
  }
}
```

### users.profile.set（カスタムフィールド更新）

**必要スコープ:** `users.profile:write`（User Token / Admin User Token）

**リクエスト例:**

```json
{
  "user": "U123ABC456",
  "profile": {
    "fields": {
      "Xf111111ABC": {
        "value": "開発部",
        "alt": ""
      },
      "Xf333333ABC": {
        "value": "2024-04-01",
        "alt": ""
      }
    }
  }
}
```

---

## 型定義

### CustomFieldDefinition

```typescript
// lib/types/custom_fields.ts

/**
 * カスタムフィールドの型
 */
export type CustomFieldType = "text" | "options_list" | "date";

/**
 * カスタムフィールドのオプション
 */
export interface CustomFieldOptions {
  /** SCIMで管理されているか */
  is_scim: boolean;
  /** 保護されているか（Admin専用） */
  is_protected: boolean;
}

/**
 * カスタムフィールド定義
 */
export interface CustomFieldDefinition {
  /** フィールドID（Xf で始まる） */
  id: string;
  /** 表示順 */
  ordering: number;
  /** ラベル（表示名） */
  label: string;
  /** ヒントテキスト */
  hint: string;
  /** フィールドタイプ */
  type: CustomFieldType;
  /** 選択肢（options_list の場合） */
  possible_values: string[] | null;
  /** オプション */
  options: CustomFieldOptions;
  /** 非表示かどうか */
  is_hidden: boolean;
  /** セクションID */
  section_id: string;
}

/**
 * カスタムフィールドセクション
 */
export interface CustomFieldSection {
  /** セクションID */
  id: string;
  /** チームID */
  team_id: string;
  /** セクションタイプ */
  section_type: string;
  /** ラベル */
  label: string;
  /** 表示順 */
  order: number;
  /** 非表示かどうか */
  is_hidden: boolean;
}

/**
 * カスタムフィールド更新リクエスト
 */
export interface CustomFieldUpdate {
  /** フィールドID */
  field_id: string;
  /** 新しい値 */
  value: string;
  /** 代替テキスト（オプション） */
  alt?: string;
}

/**
 * カスタムフィールド更新結果
 */
export interface CustomFieldUpdateResult {
  /** 成功かどうか */
  success: boolean;
  /** 更新されたフィールドID一覧 */
  updated_fields: string[];
  /** エラーメッセージ（失敗時） */
  error?: string;
}
```

---

## Phase 1: GetCustomFieldDefinitions

### ブランチ名

```
feature/custom-fields-get-definitions
```

### 実装ファイル

```
functions/
└── get_custom_field_definitions/
    ├── mod.ts      # 関数実装
    └── test.ts     # テスト
lib/
└── types/
    └── custom_fields.ts  # 型定義
```

### 関数定義

```typescript
// functions/get_custom_field_definitions/mod.ts

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import type {
  CustomFieldDefinition,
  CustomFieldSection,
} from "../../lib/types/custom_fields.ts";

await initI18n();

/**
 * カスタムフィールド定義取得関数
 *
 * ワークスペースに設定されているカスタムフィールドの一覧を取得します。
 * team.profile.get APIを使用します。
 */
export const GetCustomFieldDefinitionsDefinition = DefineFunction({
  callback_id: "get_custom_field_definitions",
  title: "カスタムフィールド定義取得",
  description: "ワークスペースのカスタムフィールド定義を取得します",
  source_file: "functions/get_custom_field_definitions/mod.ts",
  input_parameters: {
    properties: {
      include_hidden: {
        type: Schema.types.boolean,
        description: "非表示フィールドを含めるか",
        default: false,
      },
    },
    required: [],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "取得成功かどうか",
      },
      fields: {
        type: Schema.types.array,
        items: {
          type: Schema.types.object,
          properties: {
            id: { type: Schema.types.string },
            label: { type: Schema.types.string },
            type: { type: Schema.types.string },
            hint: { type: Schema.types.string },
            possible_values: {
              type: Schema.types.array,
              items: { type: Schema.types.string },
            },
            is_protected: { type: Schema.types.boolean },
          },
        },
        description: "カスタムフィールド定義の配列",
      },
      sections: {
        type: Schema.types.array,
        items: {
          type: Schema.types.object,
          properties: {
            id: { type: Schema.types.string },
            label: { type: Schema.types.string },
          },
        },
        description: "セクション定義の配列",
      },
      field_count: {
        type: Schema.types.integer,
        description: "取得したフィールド数",
      },
      error: {
        type: Schema.types.string,
        description: "エラーメッセージ（失敗時）",
      },
    },
    required: ["success"],
  },
});

/**
 * team.profile.get APIのレスポンス型
 */
interface TeamProfileGetResponse {
  ok: boolean;
  profile?: {
    fields: CustomFieldDefinition[];
    sections: CustomFieldSection[];
  };
  error?: string;
}

export default SlackFunction(
  GetCustomFieldDefinitionsDefinition,
  async ({ inputs, client }) => {
    console.log(t("logs.fetching_custom_fields"));

    try {
      // team.profile.get APIを呼び出し
      const response = await client.team.profile.get(
        {},
      ) as TeamProfileGetResponse;

      if (!response.ok) {
        throw new Error(
          t("errors.api_call_failed", {
            error: response.error ?? t("errors.unknown_error"),
          }),
        );
      }

      const profile = response.profile;
      if (!profile || !profile.fields) {
        return {
          outputs: {
            success: true,
            fields: [],
            sections: [],
            field_count: 0,
          },
        };
      }

      // 非表示フィールドをフィルタリング（オプション）
      let fields = profile.fields;
      if (!inputs.include_hidden) {
        fields = fields.filter((f) => !f.is_hidden);
      }

      // 出力用にフィールドを整形
      const outputFields = fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        hint: f.hint || "",
        possible_values: f.possible_values || [],
        is_protected: f.options?.is_protected || false,
      }));

      // セクションを整形
      const outputSections = (profile.sections || [])
        .filter((s) => !s.is_hidden)
        .map((s) => ({
          id: s.id,
          label: s.label,
        }));

      console.log(
        t("logs.custom_fields_fetched", { count: outputFields.length }),
      );

      return {
        outputs: {
          success: true,
          fields: outputFields,
          sections: outputSections,
          field_count: outputFields.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("GetCustomFieldDefinitions error:", message);
      return {
        outputs: {
          success: false,
          fields: [],
          sections: [],
          field_count: 0,
          error: message,
        },
      };
    }
  },
);
```

### テストケース

```typescript
// functions/get_custom_field_definitions/test.ts

import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { GetCustomFieldDefinitionsDefinition } from "./mod.ts";

const { createContext } = SlackFunctionTester("get_custom_field_definitions");

Deno.test("GetCustomFieldDefinitions: 正常にフィールド定義を取得できる", async () => {
  const mockClient = {
    team: {
      profile: {
        get: async () => ({
          ok: true,
          profile: {
            fields: [
              {
                id: "Xf123",
                ordering: 0,
                label: "部署",
                hint: "所属部署",
                type: "options_list",
                possible_values: ["営業部", "開発部"],
                options: { is_scim: false, is_protected: false },
                is_hidden: false,
                section_id: "S123",
              },
            ],
            sections: [
              { id: "S123", label: "会社情報", is_hidden: false },
            ],
          },
        }),
      },
    },
  };

  const inputs = { include_hidden: false };
  const context = createContext({ inputs, client: mockClient });

  // 関数を直接テスト
  // 実際のテストではSlackFunctionTesterを使用
});

Deno.test("GetCustomFieldDefinitions: フィールドがない場合は空配列を返す", async () => {
  // テスト実装
});

Deno.test("GetCustomFieldDefinitions: APIエラー時はエラーを返す", async () => {
  // テスト実装
});

Deno.test("GetCustomFieldDefinitions: 非表示フィールドをフィルタリングできる", async () => {
  // テスト実装
});
```

### i18nメッセージ（追加分）

```json
// locales/ja.json に追加
{
  "errors": {
    "custom_field_not_found": "カスタムフィールドが見つかりません: {fieldId}",
    "invalid_field_value": "フィールド '{field}' の値が不正です: {value}",
    "protected_field": "フィールド '{field}' は保護されており、更新できません"
  },
  "messages": {
    "custom_fields_form_title": "カスタムフィールド更新",
    "custom_fields_form_description": "更新するカスタムフィールドを選択してください",
    "select_field_placeholder": "フィールドを選択...",
    "no_custom_fields": "このワークスペースにはカスタムフィールドが設定されていません"
  }
}
```

---

## Phase 2: UpdateCustomFields + ShowCustomFieldsForm

### ブランチ名

```
feature/custom-fields-update
```

### 実装ファイル

```
functions/
├── update_custom_fields/
│   ├── mod.ts      # 更新関数
│   └── test.ts
└── show_custom_fields_form/
    ├── mod.ts      # フォーム表示関数
    └── test.ts
```

### UpdateCustomFields 関数定義

```typescript
// functions/update_custom_fields/mod.ts

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import { userIdSchema } from "../../lib/validation/schemas.ts";

await initI18n();

/**
 * カスタムフィールド更新関数
 *
 * 指定されたユーザーのカスタムフィールドを更新します。
 * Admin User Tokenが必要です。
 */
export const UpdateCustomFieldsDefinition = DefineFunction({
  callback_id: "update_custom_fields",
  title: "カスタムフィールド更新",
  description: "ユーザーのカスタムフィールドを更新します",
  source_file: "functions/update_custom_fields/mod.ts",
  input_parameters: {
    properties: {
      target_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新対象のユーザーID",
      },
      field_updates: {
        type: Schema.types.string,
        description: "更新するフィールドのJSON（{field_id: value}形式）",
      },
    },
    required: ["target_user_id", "field_updates"],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "更新成功かどうか",
      },
      updated_fields: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "更新されたフィールドID一覧",
      },
      error: {
        type: Schema.types.string,
        description: "エラーメッセージ（失敗時）",
      },
    },
    required: ["success"],
  },
});

/**
 * Admin User Token を使用してカスタムフィールドを更新
 */
async function updateCustomFieldsWithAdminApi(
  adminToken: string,
  userId: string,
  fieldUpdates: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  // fieldsオブジェクトを構築
  const fields: Record<string, { value: string; alt: string }> = {};
  for (const [fieldId, value] of Object.entries(fieldUpdates)) {
    fields[fieldId] = { value, alt: "" };
  }

  const response = await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      user: userId,
      profile: { fields },
    }),
  });

  return await response.json();
}

export default SlackFunction(
  UpdateCustomFieldsDefinition,
  async ({ inputs, env }) => {
    console.log(t("logs.updating_custom_fields"), {
      userId: inputs.target_user_id,
    });

    try {
      // 入力バリデーション
      userIdSchema.parse(inputs.target_user_id);

      // Admin User Token取得
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        throw new Error(t("errors.missing_admin_token"));
      }

      // フィールド更新データをパース
      let fieldUpdates: Record<string, string>;
      try {
        fieldUpdates = JSON.parse(inputs.field_updates);
      } catch {
        throw new Error(t("errors.invalid_json_format"));
      }

      if (Object.keys(fieldUpdates).length === 0) {
        throw new Error(t("errors.no_fields_to_update"));
      }

      // カスタムフィールドを更新
      const result = await updateCustomFieldsWithAdminApi(
        adminToken,
        inputs.target_user_id,
        fieldUpdates,
      );

      if (!result.ok) {
        throw new Error(
          t("errors.custom_field_update_failed", {
            error: result.error ?? t("errors.unknown_error"),
          }),
        );
      }

      console.log(t("logs.custom_fields_updated"));

      return {
        outputs: {
          success: true,
          updated_fields: Object.keys(fieldUpdates),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("UpdateCustomFields error:", message);
      return {
        outputs: {
          success: false,
          updated_fields: [],
          error: message,
        },
      };
    }
  },
);
```

### ShowCustomFieldsForm 関数定義

```typescript
// functions/show_custom_fields_form/mod.ts

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import type { CustomFieldDefinition } from "../../lib/types/custom_fields.ts";

await initI18n();

/**
 * カスタムフィールド更新フォーム表示関数
 *
 * カスタムフィールドを更新するためのモーダルフォームを表示します。
 * 権限チェックと承認フローを含みます。
 */
export const ShowCustomFieldsFormDefinition = DefineFunction({
  callback_id: "show_custom_fields_form",
  title: "カスタムフィールド更新フォーム表示",
  description: "カスタムフィールド更新用のモーダルフォームを表示します",
  source_file: "functions/show_custom_fields_form/mod.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        description: "インタラクティブコンテキスト",
      },
      user_id: {
        type: Schema.slack.types.user_id,
        description: "操作者のユーザーID",
      },
      channel_id: {
        type: Schema.slack.types.channel_id,
        description: "リクエスト元チャンネル",
      },
    },
    required: ["interactivity", "user_id", "channel_id"],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "処理成功かどうか",
      },
      approval_required: {
        type: Schema.types.boolean,
        description: "承認リクエストが送信されたかどうか",
      },
      updated_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新されたユーザーID",
      },
    },
    required: ["success"],
  },
});

/**
 * カスタムフィールドタイプに応じたBlock Kit要素を生成
 */
function createFieldInput(
  field: CustomFieldDefinition,
  currentValue?: string,
): object {
  const blockId = `field_${field.id}`;
  const actionId = `input_${field.id}`;

  switch (field.type) {
    case "options_list":
      return {
        type: "input",
        block_id: blockId,
        optional: true,
        element: {
          type: "static_select",
          action_id: actionId,
          placeholder: {
            type: "plain_text",
            text: t("messages.select_field_placeholder"),
          },
          options: (field.possible_values || []).map((v) => ({
            text: { type: "plain_text", text: v },
            value: v,
          })),
          ...(currentValue && {
            initial_option: {
              text: { type: "plain_text", text: currentValue },
              value: currentValue,
            },
          }),
        },
        label: {
          type: "plain_text",
          text: field.label,
        },
        hint: field.hint
          ? {
            type: "plain_text",
            text: field.hint,
          }
          : undefined,
      };

    case "date":
      return {
        type: "input",
        block_id: blockId,
        optional: true,
        element: {
          type: "datepicker",
          action_id: actionId,
          ...(currentValue && { initial_date: currentValue }),
        },
        label: {
          type: "plain_text",
          text: field.label,
        },
        hint: field.hint
          ? {
            type: "plain_text",
            text: field.hint,
          }
          : undefined,
      };

    case "text":
    default:
      return {
        type: "input",
        block_id: blockId,
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: actionId,
          ...(currentValue && { initial_value: currentValue }),
        },
        label: {
          type: "plain_text",
          text: field.label,
        },
        hint: field.hint
          ? {
            type: "plain_text",
            text: field.hint,
          }
          : undefined,
      };
  }
}

export default SlackFunction(
  ShowCustomFieldsFormDefinition,
  async ({ inputs, client }) => {
    console.log(t("logs.modal_opened"));

    try {
      // 1. カスタムフィールド定義を取得
      const profileResponse = await client.team.profile.get({});
      if (!profileResponse.ok) {
        throw new Error(
          t("errors.api_call_failed", { error: profileResponse.error }),
        );
      }

      const fields = (profileResponse.profile?.fields || [])
        .filter((f: CustomFieldDefinition) =>
          !f.is_hidden && !f.options?.is_protected
        );

      if (fields.length === 0) {
        // フィールドがない場合のメッセージ
        await client.views.open({
          trigger_id: inputs.interactivity.interactivity_pointer,
          view: {
            type: "modal",
            title: {
              type: "plain_text",
              text: t("messages.custom_fields_form_title"),
            },
            close: { type: "plain_text", text: t("messages.close_button") },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: t("messages.no_custom_fields"),
                },
              },
            ],
          },
        });
        return { outputs: { success: true } };
      }

      // 2. 対象ユーザー選択 + フィールド入力フォームを表示
      const blocks: object[] = [
        {
          type: "input",
          block_id: "target_user_block",
          element: {
            type: "users_select",
            action_id: "target_user_select",
            initial_user: inputs.user_id,
          },
          label: {
            type: "plain_text",
            text: t("form.target_user"),
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${t("messages.custom_fields_form_description")}*`,
          },
        },
      ];

      // 各フィールドの入力要素を追加
      for (const field of fields) {
        blocks.push(createFieldInput(field as CustomFieldDefinition));
      }

      // 3. モーダルを開く
      const viewResponse = await client.views.open({
        trigger_id: inputs.interactivity.interactivity_pointer,
        view: {
          type: "modal",
          callback_id: "custom_fields_form_modal",
          private_metadata: JSON.stringify({
            channel_id: inputs.channel_id,
            operator_id: inputs.user_id,
          }),
          title: {
            type: "plain_text",
            text: t("messages.custom_fields_form_title"),
          },
          submit: {
            type: "plain_text",
            text: t("messages.submit_button"),
          },
          close: {
            type: "plain_text",
            text: t("messages.cancel_button"),
          },
          blocks,
        },
      });

      if (!viewResponse.ok) {
        throw new Error(
          t("errors.modal_open_failed", { error: viewResponse.error }),
        );
      }

      return { completed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("ShowCustomFieldsForm error:", message);
      return { error: message };
    }
  },
)
  // モーダル送信ハンドラー
  .addViewSubmissionHandler(
    ["custom_fields_form_modal"],
    async ({ view, client, env }) => {
      const metadata = JSON.parse(view.private_metadata || "{}");
      const values = view.state.values;

      // 対象ユーザーを取得
      const targetUserId = values.target_user_block?.target_user_select
        ?.selected_user;
      if (!targetUserId) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.user_not_selected") },
        };
      }

      // 更新するフィールドを収集
      const fieldUpdates: Record<string, string> = {};
      for (const [blockId, blockValue] of Object.entries(values)) {
        if (blockId.startsWith("field_")) {
          const fieldId = blockId.replace("field_", "");
          const actionId = `input_${fieldId}`;
          const element = blockValue[actionId];

          let value: string | undefined;
          if (element?.selected_option?.value) {
            value = element.selected_option.value;
          } else if (element?.selected_date) {
            value = element.selected_date;
          } else if (element?.value) {
            value = element.value;
          }

          if (value) {
            fieldUpdates[fieldId] = value;
          }
        }
      }

      if (Object.keys(fieldUpdates).length === 0) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.no_fields_to_update") },
        };
      }

      // TODO: 権限チェックと承認フロー
      // CheckUserPermissions を呼び出して権限確認
      // Admin/Ownerなら直接実行、そうでなければ承認リクエスト

      // 直接更新（Admin/Owner の場合）
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.missing_admin_token") },
        };
      }

      // カスタムフィールドを更新
      const fields: Record<string, { value: string; alt: string }> = {};
      for (const [fieldId, value] of Object.entries(fieldUpdates)) {
        fields[fieldId] = { value, alt: "" };
      }

      const updateResponse = await fetch(
        "https://slack.com/api/users.profile.set",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${adminToken}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({
            user: targetUserId,
            profile: { fields },
          }),
        },
      );

      const result = await updateResponse.json();
      if (!result.ok) {
        return {
          response_action: "errors",
          errors: {
            target_user_block: t("errors.custom_field_update_failed", {
              error: result.error,
            }),
          },
        };
      }

      // 成功メッセージをDMで送信
      await client.chat.postMessage({
        channel: metadata.operator_id,
        text: t("messages.custom_fields_updated"),
      });

      return { response_action: "clear" };
    },
  );
```

---

## Phase 3: ワークフロー・トリガー

### ブランチ名

```
feature/custom-fields-workflow
```

### 実装ファイル

```
workflows/
└── update_custom_fields_workflow.ts
triggers/
└── update_custom_fields_shortcut.ts
```

### UpdateCustomFieldsWorkflow

```typescript
// workflows/update_custom_fields_workflow.ts

import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ShowCustomFieldsFormDefinition } from "../functions/show_custom_fields_form/mod.ts";

/**
 * カスタムフィールド更新ワークフロー
 *
 * ショートカットから起動され、カスタムフィールド更新フォームを表示します。
 */
const UpdateCustomFieldsWorkflow = DefineWorkflow({
  callback_id: "update_custom_fields_workflow",
  title: "カスタムフィールド更新",
  description: "ユーザーのカスタムフィールドを更新します",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        description: "インタラクティブコンテキスト",
      },
      user_id: {
        type: Schema.slack.types.user_id,
        description: "操作者のユーザーID",
      },
      channel_id: {
        type: Schema.slack.types.channel_id,
        description: "リクエスト元チャンネル",
      },
    },
    required: ["interactivity", "user_id", "channel_id"],
  },
});

// フォーム表示ステップ
UpdateCustomFieldsWorkflow.addStep(
  ShowCustomFieldsFormDefinition,
  {
    interactivity: UpdateCustomFieldsWorkflow.inputs.interactivity,
    user_id: UpdateCustomFieldsWorkflow.inputs.user_id,
    channel_id: UpdateCustomFieldsWorkflow.inputs.channel_id,
  },
);

export default UpdateCustomFieldsWorkflow;
```

### UpdateCustomFieldsShortcut

```typescript
// triggers/update_custom_fields_shortcut.ts

import { Trigger } from "deno-slack-sdk/mod.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import UpdateCustomFieldsWorkflow from "../workflows/update_custom_fields_workflow.ts";

/**
 * カスタムフィールド更新ショートカットトリガー
 */
const UpdateCustomFieldsShortcut: Trigger<
  typeof UpdateCustomFieldsWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "カスタムフィールドを更新",
  description: "ユーザーのカスタムフィールドを更新します",
  workflow: `#/workflows/${UpdateCustomFieldsWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: {
      value: TriggerContextData.Shortcut.interactivity,
    },
    user_id: {
      value: TriggerContextData.Shortcut.user_id,
    },
    channel_id: {
      value: TriggerContextData.Shortcut.channel_id,
    },
  },
};

export default UpdateCustomFieldsShortcut;
```

### manifest.ts 更新

```typescript
// manifest.ts に追加

import { GetCustomFieldDefinitionsDefinition } from "./functions/get_custom_field_definitions/mod.ts";
import { UpdateCustomFieldsDefinition } from "./functions/update_custom_fields/mod.ts";
import { ShowCustomFieldsFormDefinition } from "./functions/show_custom_fields_form/mod.ts";
import UpdateCustomFieldsWorkflow from "./workflows/update_custom_fields_workflow.ts";

// workflows に追加
workflows: [
  UpdateProfileWorkflow,
  UpdateCustomFieldsWorkflow,  // 追加
],

// functions に追加
functions: [
  UpdateUserProfileDefinition,
  CheckUserPermissionsDefinition,
  ShowProfileUpdateFormDefinition,
  GetAuthorizedApproversDefinition,
  GetCustomFieldDefinitionsDefinition,  // 追加
  UpdateCustomFieldsDefinition,          // 追加
  ShowCustomFieldsFormDefinition,        // 追加
],
```

---

## 人間チェック項目

### Phase 1 チェックリスト

- [ ] `deno task check` が通る
- [ ] `deno task lint` が通る
- [ ] `deno task test` が通る
- [ ] `team.profile.get` APIが正常に動作する
- [ ] カスタムフィールドが存在しない場合のハンドリング

### Phase 2 チェックリスト

- [ ] `deno task check` / `lint` / `test` が通る
- [ ] モーダルが正常に表示される
- [ ] 各フィールドタイプ（text, options_list, date）の入力が動作する
- [ ] Admin User Tokenでの更新が成功する
- [ ] 権限チェックが正しく動作する

### Phase 3 チェックリスト

- [ ] ショートカットからワークフローが起動できる
- [ ] `slack run` でローカル実行できる
- [ ] manifest.tsに全関数・ワークフローが登録されている
- [ ] トリガー作成が成功する

```bash
# トリガー作成
slack trigger create --trigger-def triggers/update_custom_fields_shortcut.ts
```

---

## 注意事項

### API制限

- `team.profile.get` は Bot Token で実行可能
- `users.profile.set` は Admin User Token が必要
- カスタムフィールドの追加・削除は管理画面からのみ

### 保護フィールド

- `is_protected: true` のフィールドはSCIM経由でのみ更新可能
- フォームには表示しない、または読み取り専用で表示

### フィールドタイプ

| タイプ         | 説明         | Block Kit要素      |
| -------------- | ------------ | ------------------ |
| `text`         | テキスト入力 | `plain_text_input` |
| `options_list` | 選択肢       | `static_select`    |
| `date`         | 日付         | `datepicker`       |
