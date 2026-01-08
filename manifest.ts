import { Manifest } from "deno-slack-sdk/mod.ts";

// Import function definitions
import { UpdateUserProfileDefinition } from "./functions/update_user_profile/mod.ts";
import { CheckUserPermissionsDefinition } from "./functions/check_user_permissions/mod.ts";
import { ShowProfileUpdateFormDefinition } from "./functions/show_profile_update_form/mod.ts";
import { GetAuthorizedApproversDefinition } from "./functions/get_authorized_approvers/mod.ts";

// TODO: Import additional function definitions when implemented
// import { UpdateCustomFieldsDefinition } from "./functions/update_custom_fields/mod.ts";
// import { GetCustomFieldDefinitionsDefinition } from "./functions/get_custom_field_definitions/mod.ts";

// Import workflow definitions
import UpdateProfileWorkflow from "./workflows/update_profile_workflow.ts";
import UpdateCustomFieldsWorkflow from "./workflows/update_custom_fields_workflow.ts";

// Load from environment variables with fallback defaults
const APP_NAME = Deno.env.get("SLACK_APP_NAME") || "Slack Utils User";
const APP_DESCRIPTION = Deno.env.get("SLACK_APP_DESCRIPTION") ||
  "ユーザープロフィール管理ワークフロー";

export default Manifest({
  name: APP_NAME,
  description: APP_DESCRIPTION,
  icon: "assets/icon.png",
  workflows: [
    UpdateProfileWorkflow,
    UpdateCustomFieldsWorkflow,
  ],
  functions: [
    UpdateUserProfileDefinition,
    CheckUserPermissionsDefinition,
    ShowProfileUpdateFormDefinition,
    GetAuthorizedApproversDefinition,
  ],
  outgoingDomains: [],
  botScopes: [
    "commands", // スラッシュコマンド
    "chat:write", // メッセージ送信
    "chat:write.public", // 公開チャンネルへの送信
    "users:read", // ユーザー情報読み取り
    "users.profile:read", // プロフィール読み取り
    "team.profile:read", // チーム設定読み取り
    "im:write", // DM送信
  ],
});
