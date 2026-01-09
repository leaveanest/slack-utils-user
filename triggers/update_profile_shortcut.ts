/**
 * UpdateProfileShortcut trigger
 *
 * プロフィール更新ワークフローを起動するショートカットトリガーです。
 * Slackのショートカットメニューから実行されます。
 *
 * @module triggers/update_profile_shortcut
 */

import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import UpdateProfileWorkflow from "../workflows/update_profile_workflow.ts";

/**
 * プロフィール更新ショートカットトリガー
 *
 * ショートカットから実行され、プロフィール更新フォームを表示します。
 * interactivity, user_id, channel_id がワークフローに渡されます。
 */
const UpdateProfileShortcut: Trigger<typeof UpdateProfileWorkflow.definition> =
  {
    type: TriggerTypes.Shortcut,
    name: "プロフィールを更新",
    description: "ユーザーのプロフィール情報を更新します",
    workflow: `#/workflows/${UpdateProfileWorkflow.definition.callback_id}`,
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

export default UpdateProfileShortcut;
