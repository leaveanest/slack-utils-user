# カスタムフィールド Phase 3: ワークフロー・トリガー実装

## ブランチ名

```
feature/custom-fields-workflow
```

## 参考実装

**必ず以下のリポジトリを参照してください：**

- **GitHub**: https://github.com/leaveanest/slack-utils-channel

特に以下のファイルを参考に：

- `workflows/request_private_channel_workflow.ts` - ワークフロー定義
- `triggers/request_private_channel_trigger.ts` - ショートカットトリガー
- `manifest.ts` - 関数・ワークフローの登録

## ツールの使用方針

### 必須ツール

1. **Serena** - 既存ワークフロー・トリガーの参照
   - UpdateProfileWorkflow の実装パターン
   - UpdateProfileShortcut の実装パターン

2. **Context7** - Slack SDK ドキュメント参照
   - DefineWorkflow の使い方
   - TriggerTypes.Shortcut の設定

### Serena使用例

```
mcp_serena_search_for_pattern({ substring_pattern: "DefineWorkflow", relative_path: "workflows/" })
mcp_serena_search_for_pattern({ substring_pattern: "TriggerTypes.Shortcut", relative_path: "triggers/" })
mcp_serena_find_symbol({ name_path: "UpdateProfileWorkflow" })
```

## 事前準備

1. `docs/slack-utils-user-custom-fields-spec.md` の Phase 3 セクションを確認
2. **Serena**で既存のワークフロー・トリガー実装を参照:
   - `workflows/update_profile_workflow.ts`
   - `triggers/update_profile_shortcut.ts`

## タスク

### 1. ワークフローの実装

- [ ] `workflows/update_custom_fields_workflow.ts`
  - DefineWorkflow でワークフロー定義
  - input_parameters: interactivity, user_id, channel_id
  - addStep で ShowCustomFieldsFormDefinition を追加

### 2. トリガーの実装

- [ ] `triggers/update_custom_fields_shortcut.ts`
  - TriggerTypes.Shortcut
  - name: "カスタムフィールドを更新"
  - TriggerContextData.Shortcut から inputs をマッピング

### 3. manifest.ts の更新

- [ ] imports に追加:
  ```typescript
  import { GetCustomFieldDefinitionsDefinition } from "./functions/get_custom_field_definitions/mod.ts";
  import { UpdateCustomFieldsDefinition } from "./functions/update_custom_fields/mod.ts";
  import { ShowCustomFieldsFormDefinition } from "./functions/show_custom_fields_form/mod.ts";
  import UpdateCustomFieldsWorkflow from "./workflows/update_custom_fields_workflow.ts";
  ```

- [ ] workflows 配列に追加:
  ```typescript
  workflows: [
    UpdateProfileWorkflow,
    UpdateCustomFieldsWorkflow,  // 追加
  ],
  ```

- [ ] functions 配列に追加:
  ```typescript
  functions: [
    // 既存の関数...
    GetCustomFieldDefinitionsDefinition,  // 追加
    UpdateCustomFieldsDefinition,          // 追加
    ShowCustomFieldsFormDefinition,        // 追加
  ],
  ```

## ワークフロー実装パターン

```typescript
// workflows/update_custom_fields_workflow.ts

import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ShowCustomFieldsFormDefinition } from "../functions/show_custom_fields_form/mod.ts";

const UpdateCustomFieldsWorkflow = DefineWorkflow({
  callback_id: "update_custom_fields_workflow",
  title: "カスタムフィールド更新",
  description: "ユーザーのカスタムフィールドを更新します",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      user_id: {
        type: Schema.slack.types.user_id,
      },
      channel_id: {
        type: Schema.slack.types.channel_id,
      },
    },
    required: ["interactivity", "user_id", "channel_id"],
  },
});

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

## トリガー実装パターン

```typescript
// triggers/update_custom_fields_shortcut.ts

import { Trigger } from "deno-slack-sdk/mod.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import UpdateCustomFieldsWorkflow from "../workflows/update_custom_fields_workflow.ts";

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

## 完了条件

- `deno task check` が通る
- `deno task lint` が通る
- `slack run` でローカル実行できる
- ショートカットからワークフローを起動できる

## トリガー作成コマンド

```bash
# ローカル実行
slack run

# トリガー作成（デプロイ時）
slack trigger create --trigger-def triggers/update_custom_fields_shortcut.ts
```

## 動作確認

1. `slack run` でローカル起動
2. Slackの `/` メニューから「カスタムフィールドを更新」を検索
3. ショートカットをクリック
4. モーダルが表示されることを確認
5. フィールドを入力して送信
6. 更新が成功することを確認
