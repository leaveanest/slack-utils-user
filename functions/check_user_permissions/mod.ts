/**
 * CheckUserPermissions function
 *
 * Checks the permissions of an operator to determine if they can directly
 * update a user's profile or if approval is required.
 *
 * @module functions/check_user_permissions
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import {
  DEFAULT_PERMISSION_CONFIG,
  type PermissionConfig,
} from "../../lib/types/profile.ts";

/**
 * Function definition for CheckUserPermissions
 *
 * @example
 * ```typescript
 * // Use in workflow
 * const permissionsStep = workflow.addStep(CheckUserPermissionsDefinition, {
 *   operator_id: workflow.inputs.user_id,
 *   target_user_id: selectedUserId,
 *   requested_fields: ["display_name", "title"],
 * });
 * ```
 */
export const CheckUserPermissionsDefinition = DefineFunction({
  callback_id: "check_user_permissions",
  title: "権限チェック",
  description: "操作者の権限を確認します",
  source_file: "functions/check_user_permissions/mod.ts",
  input_parameters: {
    properties: {
      operator_id: {
        type: Schema.slack.types.user_id,
        description: "操作者のユーザーID",
      },
      target_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新対象のユーザーID",
      },
      requested_fields: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "更新を要求するフィールド一覧",
      },
    },
    required: ["operator_id", "target_user_id", "requested_fields"],
  },
  output_parameters: {
    properties: {
      can_execute_directly: {
        type: Schema.types.boolean,
        description: "直接実行可能かどうか",
      },
      requires_approval: {
        type: Schema.types.boolean,
        description: "承認が必要かどうか",
      },
      denied_fields: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "更新が拒否されたフィールド（Admin専用等）",
      },
      is_admin: {
        type: Schema.types.boolean,
        description: "操作者がAdminかどうか",
      },
      is_owner: {
        type: Schema.types.boolean,
        description: "操作者がOwnerかどうか",
      },
      error: {
        type: Schema.types.string,
        description: "エラーメッセージ（失敗時）",
      },
    },
    required: ["can_execute_directly", "requires_approval"],
  },
});

/**
 * Check if user is Admin or Owner
 */
interface UserPermissionInfo {
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
}

/**
 * Get permission configuration
 * In production, this could be loaded from environment variables or a database
 */
function getPermissionConfig(): PermissionConfig {
  return {
    ...DEFAULT_PERMISSION_CONFIG,
    approval_channel_id: Deno.env.get("SLACK_APPROVAL_CHANNEL_ID") ?? "",
  };
}

/**
 * CheckUserPermissions function implementation
 *
 * Determines whether the operator can directly update the target user's profile
 * or if an approval workflow is required.
 *
 * Permission rules:
 * - Admin/Owner: Can directly update any user's profile
 * - Self (own profile): Can directly update allowed_self_edit_fields
 * - Other cases: Requires approval
 * - Admin-only fields: Cannot be updated through approval, only by Admin
 *
 * @param inputs - Function inputs
 * @param inputs.operator_id - The user performing the operation
 * @param inputs.target_user_id - The user whose profile is being updated
 * @param inputs.requested_fields - Fields to be updated
 * @param client - Slack API client
 * @returns Permission check results
 */
export default SlackFunction(
  CheckUserPermissionsDefinition,
  async ({ inputs, client }) => {
    // Initialize i18n system
    await initI18n();

    const { operator_id, target_user_id, requested_fields } = inputs;

    console.log(t("logs.checking_permissions", { userId: operator_id }));

    try {
      // Get operator's user info
      const operatorResponse = await client.users.info({ user: operator_id });

      if (!operatorResponse.ok) {
        const errorCode = operatorResponse.error ?? "unknown_error";
        console.error(t("errors.api_call_failed", { error: errorCode }));
        return {
          error: t("errors.user_not_found", { userId: operator_id }),
          outputs: {
            can_execute_directly: false,
            requires_approval: false,
            denied_fields: [],
            is_admin: false,
            is_owner: false,
          },
        };
      }

      const operatorInfo: UserPermissionInfo = {
        is_admin: operatorResponse.user?.is_admin ?? false,
        is_owner: operatorResponse.user?.is_owner ?? false,
        is_primary_owner: operatorResponse.user?.is_primary_owner ?? false,
      };

      console.log(
        t("logs.permissions_checked", {
          isAdmin: String(operatorInfo.is_admin),
          isOwner: String(operatorInfo.is_owner),
        }),
      );

      // Get permission configuration
      const config = getPermissionConfig();

      // Check if operator is self (updating own profile)
      const isSelf = operator_id === target_user_id;

      // Admin or Owner can do anything
      const isAdminOrOwner = operatorInfo.is_admin || operatorInfo.is_owner ||
        operatorInfo.is_primary_owner;

      // Determine denied fields (Admin-only fields for non-admins)
      const deniedFields: string[] = [];
      const allowedFieldsForApproval: string[] = [];

      for (const field of requested_fields) {
        if (config.admin_only_fields.includes(field)) {
          if (!isAdminOrOwner) {
            deniedFields.push(field);
          }
        } else {
          allowedFieldsForApproval.push(field);
        }
      }

      // Determine execution mode
      let canExecuteDirectly = false;
      let requiresApproval = false;

      if (isAdminOrOwner) {
        // Admin/Owner can directly execute anything
        canExecuteDirectly = true;
        requiresApproval = false;
      } else if (isSelf) {
        // Self-editing: Check if all requested fields are self-editable
        const selfEditableFields = requested_fields.filter(
          (field) =>
            config.allowed_self_edit_fields.includes(field) &&
            !config.admin_only_fields.includes(field),
        );
        const nonSelfEditableFields = requested_fields.filter(
          (field) =>
            !config.allowed_self_edit_fields.includes(field) &&
            !config.admin_only_fields.includes(field),
        );

        if (nonSelfEditableFields.length === 0 && deniedFields.length === 0) {
          // All fields are self-editable
          canExecuteDirectly = true;
          requiresApproval = false;
        } else if (allowedFieldsForApproval.length > 0) {
          // Some fields require approval
          canExecuteDirectly = selfEditableFields.length > 0;
          requiresApproval = nonSelfEditableFields.length > 0;
        } else {
          // All fields are denied
          canExecuteDirectly = false;
          requiresApproval = false;
        }
      } else {
        // Editing another user's profile
        if (allowedFieldsForApproval.length > 0) {
          requiresApproval = true;
          canExecuteDirectly = false;
        } else {
          // All fields are denied (admin-only)
          canExecuteDirectly = false;
          requiresApproval = false;
        }
      }

      return {
        outputs: {
          can_execute_directly: canExecuteDirectly,
          requires_approval: requiresApproval,
          denied_fields: deniedFields,
          is_admin: operatorInfo.is_admin,
          is_owner: operatorInfo.is_owner || operatorInfo.is_primary_owner,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("errors.api_call_failed", { error: message }));
      return {
        error: t("errors.api_call_failed", { error: message }),
        outputs: {
          can_execute_directly: false,
          requires_approval: false,
          denied_fields: [],
          is_admin: false,
          is_owner: false,
        },
      };
    }
  },
);
