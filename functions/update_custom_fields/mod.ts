/**
 * UpdateCustomFields function
 *
 * Updates custom fields for a specified user using the Admin User Token.
 * Uses the users.profile.set API with the fields object.
 *
 * @module functions/update_custom_fields
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import { userIdSchema } from "../../lib/validation/schemas.ts";

/**
 * Function definition for UpdateCustomFields
 *
 * @example
 * ```typescript
 * // Use in workflow
 * const updateStep = workflow.addStep(UpdateCustomFieldsDefinition, {
 *   target_user_id: workflow.inputs.user_id,
 *   field_updates: JSON.stringify({ "Xf123": "New Value" }),
 * });
 * ```
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
 * users.profile.set API response type
 */
interface ProfileSetResponse {
  ok: boolean;
  error?: string;
}

/**
 * Updates custom fields using Admin User Token
 *
 * @param adminToken - Admin User Token (xoxp-)
 * @param userId - Target user ID
 * @param fieldUpdates - Map of field ID to new value
 * @returns API response
 */
async function updateCustomFieldsWithAdminApi(
  adminToken: string,
  userId: string,
  fieldUpdates: Record<string, string>,
): Promise<ProfileSetResponse> {
  // Build fields object for API
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

  return await response.json() as ProfileSetResponse;
}

/**
 * UpdateCustomFields function implementation
 *
 * Updates custom fields for the specified user. Requires Admin User Token
 * to update fields for other users.
 *
 * @param inputs - Function inputs
 * @param inputs.target_user_id - Target user ID to update
 * @param inputs.field_updates - JSON string of field updates
 * @param env - Environment variables
 * @returns Update result with success status and updated field IDs
 */
export default SlackFunction(
  UpdateCustomFieldsDefinition,
  async ({ inputs, env }) => {
    // Initialize i18n system
    await initI18n();

    console.log(t("logs.updating_custom_fields"), {
      userId: inputs.target_user_id,
    });

    try {
      // Validate user ID
      userIdSchema.parse(inputs.target_user_id);

      // Get Admin User Token
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        throw new Error(t("errors.missing_admin_token"));
      }

      // Parse field updates JSON
      let fieldUpdates: Record<string, string>;
      try {
        fieldUpdates = JSON.parse(inputs.field_updates);
      } catch {
        throw new Error(t("errors.invalid_json_format"));
      }

      // Validate there are fields to update
      if (Object.keys(fieldUpdates).length === 0) {
        throw new Error(t("errors.no_fields_to_update"));
      }

      // Update custom fields
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
