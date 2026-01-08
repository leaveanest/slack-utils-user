/**
 * UpdateCustomFieldsShortcut trigger
 *
 * カスタムフィールド更新ワークフローを起動するショートカットトリガーです。
 * Slackのショートカットメニューから実行されます。
 *
 * @module triggers/update_custom_fields_shortcut
 */

import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import UpdateCustomFieldsWorkflow from "../workflows/update_custom_fields_workflow.ts";

/**
 * カスタムフィールド更新ショートカットトリガー
 *
 * ショートカットから実行され、カスタムフィールド更新フォームを表示します。
 * interactivity, user_id, channel_id がワークフローに渡されます。
 */
const UpdateCustomFieldsShortcut: Trigger<
  typeof UpdateCustomFieldsWorkflow.definition
> = {
  type: TriggerTypes.Shortcut,
  name: "カスタムフィールドを更新",
  description: "ユーザーのカスタムフィールド情報を更新します",
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
