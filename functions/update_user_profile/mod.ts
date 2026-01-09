/**
 * UpdateUserProfile function
 *
 * Updates a user's profile fields using the Slack API.
 * Requires an Admin User Token (xoxp-) from environment variables
 * to update other users' profiles.
 *
 * @module functions/update_user_profile
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";

/**
 * Function definition for UpdateUserProfile
 *
 * @example
 * ```typescript
 * // Use in workflow
 * const updateStep = workflow.addStep(UpdateUserProfileDefinition, {
 *   target_user_id: selectedUserId,
 *   display_name: "New Name",
 *   title: "Senior Engineer",
 * });
 * ```
 */
export const UpdateUserProfileDefinition = DefineFunction({
  callback_id: "update_user_profile",
  title: "プロフィール更新",
  description: "ユーザーのプロフィール情報を更新します",
  source_file: "functions/update_user_profile/mod.ts",
  input_parameters: {
    properties: {
      target_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新対象のユーザーID",
      },
      display_name: {
        type: Schema.types.string,
        description: "表示名（オプション）",
      },
      title: {
        type: Schema.types.string,
        description: "役職（オプション）",
      },
      phone: {
        type: Schema.types.string,
        description: "電話番号（オプション）",
      },
      pronouns: {
        type: Schema.types.string,
        description: "代名詞（オプション）",
      },
    },
    required: ["target_user_id"],
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
        description: "更新されたフィールド一覧",
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
 * Profile fields that can be updated
 */
interface ProfileUpdate {
  display_name?: string;
  title?: string;
  phone?: string;
  pronouns?: string;
}

/**
 * Build the profile object for the API call
 */
function buildProfileObject(inputs: ProfileUpdate): Record<string, string> {
  const profile: Record<string, string> = {};

  if (inputs.display_name !== undefined && inputs.display_name !== "") {
    profile.display_name = inputs.display_name;
  }
  if (inputs.title !== undefined && inputs.title !== "") {
    profile.title = inputs.title;
  }
  if (inputs.phone !== undefined && inputs.phone !== "") {
    profile.phone = inputs.phone;
  }
  if (inputs.pronouns !== undefined && inputs.pronouns !== "") {
    profile.pronouns = inputs.pronouns;
  }

  return profile;
}

/**
 * Call users.profile.set using the Admin User Token
 *
 * The Slack Deno SDK's client uses the bot token, but users.profile.set
 * requires a user token (xoxp-) to update profiles. We need to make a
 * direct HTTP call with the admin token.
 */
async function updateProfileWithUserToken(
  userId: string,
  profile: Record<string, string>,
  adminToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      user: userId,
      profile,
    }),
  });

  const result = await response.json();
  return {
    ok: result.ok === true,
    error: result.error,
  };
}

/**
 * UpdateUserProfile function implementation
 *
 * Updates the specified user's profile with the provided field values.
 * Uses SLACK_ADMIN_USER_TOKEN environment variable for authentication.
 *
 * @param inputs - Function inputs
 * @param inputs.target_user_id - User whose profile will be updated
 * @param inputs.display_name - New display name (optional)
 * @param inputs.title - New title (optional)
 * @param inputs.phone - New phone number (optional)
 * @param inputs.pronouns - New pronouns (optional)
 * @param env - Environment variables
 * @returns Update result with success status and updated fields
 *
 * @throws {Error} When SLACK_ADMIN_USER_TOKEN is not configured
 * @throws {Error} When API call fails
 */
export default SlackFunction(
  UpdateUserProfileDefinition,
  async ({ inputs, env }) => {
    // Initialize i18n system
    await initI18n();

    const { target_user_id, display_name, title, phone, pronouns } = inputs;

    console.log(t("logs.updating_profile", { userId: target_user_id }));

    try {
      // Get Admin User Token from environment
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        return {
          error: t("errors.missing_admin_token"),
          outputs: {
            success: false,
            updated_fields: [],
          },
        };
      }

      // Build profile object from inputs
      const profile = buildProfileObject({
        display_name,
        title,
        phone,
        pronouns,
      });

      // Check if there are any fields to update
      const updatedFields = Object.keys(profile);
      if (updatedFields.length === 0) {
        return {
          error: t("errors.no_fields_to_update"),
          outputs: {
            success: false,
            updated_fields: [],
          },
        };
      }

      console.log(
        t("logs.profile_updated", { fields: updatedFields.join(", ") }),
      );

      // Call the API to update the profile
      const result = await updateProfileWithUserToken(
        target_user_id,
        profile,
        adminToken,
      );

      if (!result.ok) {
        const errorCode = result.error ?? "unknown_error";
        console.error(t("errors.profile_update_failed", { error: errorCode }));
        return {
          error: t("errors.profile_update_failed", { error: errorCode }),
          outputs: {
            success: false,
            updated_fields: [],
          },
        };
      }

      return {
        outputs: {
          success: true,
          updated_fields: updatedFields,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("errors.profile_update_failed", { error: message }));
      return {
        error: t("errors.profile_update_failed", { error: message }),
        outputs: {
          success: false,
          updated_fields: [],
        },
      };
    }
  },
);
