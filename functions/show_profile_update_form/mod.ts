/**
 * ShowProfileUpdateForm function
 *
 * Displays a modal form for updating user profiles with approval workflow support.
 * Handles both direct updates (for admins/self-editable fields) and approval requests.
 *
 * Flow:
 * 1. Show loading modal immediately (to avoid interactivity timeout)
 * 2. Fetch user permissions and available approvers
 * 3. Update modal with the profile update form
 * 4. Handle form submission → direct update or approval request
 * 5. Handle approval/denial from approvers
 *
 * @module functions/show_profile_update_form
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import {
  DEFAULT_PERMISSION_CONFIG,
  type PermissionConfig,
} from "../../lib/types/profile.ts";

// Callback IDs for modal and block actions
const FORM_CALLBACK_ID = "profile_update_form";
const APPROVE_ACTION_ID = "approve_profile_update";
const DENY_ACTION_ID = "deny_profile_update";
const TARGET_USER_ACTION_ID = "target_user_select";

/**
 * User profile data for form initial values
 */
interface UserProfile {
  display_name?: string;
  title?: string;
  phone?: string;
  pronouns?: string;
}

/**
 * Profile change with old and new values for diff display
 */
interface ProfileChange {
  old: string;
  new: string;
}

/**
 * Function definition for ShowProfileUpdateForm
 */
export const ShowProfileUpdateFormDefinition = DefineFunction({
  callback_id: "show_profile_update_form",
  title: "プロフィール更新フォーム表示",
  description: "プロフィール更新用のモーダルフォームを表示します",
  source_file: "functions/show_profile_update_form/mod.ts",
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
 * Get permission configuration from environment
 */
function getPermissionConfig(): PermissionConfig {
  return {
    ...DEFAULT_PERMISSION_CONFIG,
    approval_channel_id: Deno.env.get("SLACK_APPROVAL_CHANNEL_ID") ?? "",
  };
}

/**
 * Build loading modal view
 */
function buildLoadingView() {
  return {
    type: "modal" as const,
    callback_id: FORM_CALLBACK_ID,
    title: {
      type: "plain_text" as const,
      text: t("form.loading_title"),
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: t("form.loading_message"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: t("form.loading_hint"),
          },
        ],
      },
    ],
  };
}

/**
 * Build profile update form view
 *
 * @param operatorId - The user operating the form
 * @param isAdminOrOwner - Whether the operator is admin or owner
 * @param approvers - List of available approvers
 * @param channelId - Source channel ID
 * @param targetUserId - Target user ID for the form
 * @param initialValues - Optional initial values for form fields
 */
function buildProfileFormView(
  operatorId: string,
  isAdminOrOwner: boolean,
  approvers: Array<{ id: string; name: string; real_name?: string }>,
  channelId: string,
  targetUserId?: string,
  initialValues?: UserProfile,
) {
  const blocks: Array<Record<string, unknown>> = [];

  // Generate unique block_id suffix based on target user
  // This forces Slack to treat inputs as new fields and use initial_value
  // instead of preserving previous input values
  const blockIdSuffix = targetUserId ? `_${targetUserId}` : "";

  // Target user selection (for admins, can select any user)
  // dispatch_action: true enables triggering BlockActionsHandler on selection change
  blocks.push({
    type: "input",
    block_id: "target_user_block",
    dispatch_action: true,
    element: {
      type: "users_select",
      action_id: TARGET_USER_ACTION_ID,
      placeholder: {
        type: "plain_text",
        text: t("form.target_user_placeholder"),
      },
      initial_user: targetUserId ?? operatorId,
    },
    label: {
      type: "plain_text",
      text: t("form.target_user_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.target_user_hint"),
    },
  });

  // Display name - with initial_value if provided
  // deno-lint-ignore no-explicit-any
  const displayNameElement: Record<string, any> = {
    type: "plain_text_input",
    action_id: "display_name",
    placeholder: {
      type: "plain_text",
      text: t("form.display_name_placeholder"),
    },
  };
  if (initialValues?.display_name) {
    displayNameElement.initial_value = initialValues.display_name;
  }
  blocks.push({
    type: "input",
    block_id: `display_name_block${blockIdSuffix}`,
    optional: true,
    element: displayNameElement,
    label: {
      type: "plain_text",
      text: t("form.display_name_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.display_name_hint"),
    },
  });

  // Title - with initial_value if provided
  // deno-lint-ignore no-explicit-any
  const titleElement: Record<string, any> = {
    type: "plain_text_input",
    action_id: "title",
    placeholder: {
      type: "plain_text",
      text: t("form.title_placeholder"),
    },
  };
  if (initialValues?.title) {
    titleElement.initial_value = initialValues.title;
  }
  blocks.push({
    type: "input",
    block_id: `title_block${blockIdSuffix}`,
    optional: true,
    element: titleElement,
    label: {
      type: "plain_text",
      text: t("form.title_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.title_hint"),
    },
  });

  // Phone - with initial_value if provided
  // deno-lint-ignore no-explicit-any
  const phoneElement: Record<string, any> = {
    type: "plain_text_input",
    action_id: "phone",
    placeholder: {
      type: "plain_text",
      text: t("form.phone_placeholder"),
    },
  };
  if (initialValues?.phone) {
    phoneElement.initial_value = initialValues.phone;
  }
  blocks.push({
    type: "input",
    block_id: `phone_block${blockIdSuffix}`,
    optional: true,
    element: phoneElement,
    label: {
      type: "plain_text",
      text: t("form.phone_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.phone_hint"),
    },
  });

  // Pronouns - with initial_value if provided
  // deno-lint-ignore no-explicit-any
  const pronounsElement: Record<string, any> = {
    type: "plain_text_input",
    action_id: "pronouns",
    placeholder: {
      type: "plain_text",
      text: t("form.pronouns_placeholder"),
    },
  };
  if (initialValues?.pronouns) {
    pronounsElement.initial_value = initialValues.pronouns;
  }
  blocks.push({
    type: "input",
    block_id: `pronouns_block${blockIdSuffix}`,
    optional: true,
    element: pronounsElement,
    label: {
      type: "plain_text",
      text: t("form.pronouns_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.pronouns_hint"),
    },
  });

  // Approver selection (only for non-admin users when approvers are available)
  if (!isAdminOrOwner && approvers.length > 0) {
    const approverOptions = approvers.map((a) => ({
      text: {
        type: "plain_text" as const,
        text: a.real_name ?? a.name,
      },
      value: a.id,
    }));

    blocks.push({
      type: "input",
      block_id: "approver_block",
      element: {
        type: "multi_static_select",
        action_id: "approvers",
        placeholder: {
          type: "plain_text",
          text: t("form.approver_placeholder_multiple"),
        },
        options: approverOptions,
      },
      label: {
        type: "plain_text",
        text: t("form.approver_label_multiple"),
      },
      hint: {
        type: "plain_text",
        text: t("form.approver_hint_multiple"),
      },
    });

    // Reason for change
    blocks.push({
      type: "input",
      block_id: "reason_block",
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: "reason",
        placeholder: {
          type: "plain_text",
          text: t("form.reason_placeholder"),
        },
      },
      label: {
        type: "plain_text",
        text: t("form.reason_label"),
      },
      hint: {
        type: "plain_text",
        text: t("form.reason_hint"),
      },
    });
  } else if (!isAdminOrOwner && approvers.length === 0) {
    // Show warning when no approvers are available
    blocks.push({
      type: "section",
      block_id: "no_approvers_warning_block",
      text: {
        type: "mrkdwn",
        text: t("form.no_approvers_warning"),
      },
    });
  }

  return {
    type: "modal" as const,
    callback_id: FORM_CALLBACK_ID,
    private_metadata: JSON.stringify({
      operator_id: operatorId,
      is_admin_or_owner: isAdminOrOwner,
      approvers_available: approvers.length > 0,
      approvers: approvers,
      channel_id: channelId,
      target_user_id: targetUserId ?? operatorId,
    }),
    title: {
      type: "plain_text" as const,
      text: t("form.title"),
    },
    submit: {
      type: "plain_text" as const,
      text: isAdminOrOwner ? t("form.submit_button") : t("form.request_button"),
    },
    close: {
      type: "plain_text" as const,
      text: t("form.cancel_button"),
    },
    blocks,
  };
}

/**
 * Build approval request message blocks
 */
function buildApprovalMessage(
  requesterId: string,
  targetUserId: string,
  changes: Record<string, ProfileChange>,
  reason?: string,
  approverIds?: string[],
) {
  const changesText = Object.entries(changes)
    .map(([field, change]) =>
      t("messages.field_change", {
        field,
        old: change.old || t("messages.no_changes"),
        new: change.new,
      })
    )
    .join("\n");

  const approverMentions = approverIds?.map((id) => `<@${id}>`).join(", ") ??
    "";

  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: t("messages.approval_request_header"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: t("messages.approval_request_details", {
          requester: requesterId,
          target: targetUserId,
          changes: changesText,
        }),
      },
    },
  ];

  if (reason) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${t("form.reason_label")}:* ${reason}`,
      },
    });
  }

  if (approverMentions) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `👤 ${t("form.approver_label_multiple")}: ${approverMentions}`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: t("messages.approve_button"),
        },
        style: "primary",
        action_id: APPROVE_ACTION_ID,
        value: JSON.stringify({
          requester_id: requesterId,
          target_user_id: targetUserId,
          changes,
          approver_ids: approverIds,
        }),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: t("messages.deny_button"),
        },
        style: "danger",
        action_id: DENY_ACTION_ID,
        value: JSON.stringify({
          requester_id: requesterId,
          target_user_id: targetUserId,
          changes,
          approver_ids: approverIds,
        }),
      },
    ],
  });

  return blocks;
}

/**
 * Check if user is admin or owner
 */
async function checkUserPermissions(
  client: {
    users: {
      info: (params: { user: string }) => Promise<{
        ok: boolean;
        error?: string;
        user?: {
          is_admin?: boolean;
          is_owner?: boolean;
          is_primary_owner?: boolean;
        };
      }>;
    };
  },
  userId: string,
): Promise<{ isAdminOrOwner: boolean; error?: string }> {
  console.log("[checkUserPermissions] Calling users.info with userId:", userId);
  const response = await client.users.info({ user: userId });
  console.log(
    "[checkUserPermissions] Response ok:",
    response.ok,
    "error:",
    response.error,
  );
  if (!response.ok) {
    return { isAdminOrOwner: false, error: response.error };
  }

  const isAdminOrOwner = response.user?.is_admin ||
    response.user?.is_owner ||
    response.user?.is_primary_owner ||
    false;

  return { isAdminOrOwner };
}

/**
 * Result of fetching approvers
 */
interface FetchApproversResult {
  approvers: Array<{ id: string; name: string; real_name?: string }>;
  error?: string;
}

/**
 * admin.users.list APIのレスポンス型
 */
interface AdminUsersListResponse {
  ok: boolean;
  users?: Array<{
    id: string;
    username?: string;
    full_name?: string;
    email?: string;
    is_admin?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_bot?: boolean;
    deleted?: boolean;
    is_active?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

/**
 * Fetch authorized approvers using admin.users.list API
 */
async function fetchApprovers(
  adminToken: string,
  teamId: string,
  excludeUserId?: string,
): Promise<FetchApproversResult> {
  const approvers: Array<{ id: string; name: string; real_name?: string }> = [];
  let cursor: string | undefined;

  // 無限ループを防ぐための最大ページ数制限
  const MAX_PAGES = 50;
  let pageCount = 0;

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      console.warn(
        t("logs.max_page_limit_reached", { limit: MAX_PAGES }),
      );
      break;
    }

    const params = new URLSearchParams({
      team_id: teamId,
      limit: "200",
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    console.log(
      "[fetchApprovers] Calling admin.users.list with cursor:",
      cursor,
    );
    const response = await fetch(
      `https://slack.com/api/admin.users.list?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );

    const result: AdminUsersListResponse = await response.json();

    console.log(
      "[fetchApprovers] Response ok:",
      result.ok,
      "error:",
      result.error,
      "users count:",
      result.users?.length,
    );

    if (!result.ok) {
      const errorCode = result.error ?? "unknown_error";
      console.error(t("errors.api_call_failed", { error: errorCode }));
      return {
        approvers: [],
        error: t("errors.api_call_failed", { error: errorCode }),
      };
    }

    if (result.users) {
      for (const user of result.users) {
        if (
          user.is_bot || user.deleted || user.is_restricted ||
          user.is_ultra_restricted
        ) continue;
        if (excludeUserId && user.id === excludeUserId) continue;
        if (user.is_admin || user.is_owner || user.is_primary_owner) {
          // 既に追加済みのユーザーはスキップ
          if (approvers.some((u) => u.id === user.id)) {
            continue;
          }

          approvers.push({
            id: user.id,
            name: user.username ?? "",
            real_name: user.full_name ?? "",
          });
        }
      }
    }

    // カーソルチェックの改善: 空文字列、undefined、同じカーソルの場合はループ終了
    const newCursor = result.response_metadata?.next_cursor;
    if (!newCursor || newCursor === "" || newCursor === cursor) {
      break;
    }
    cursor = newCursor;
  } while (true);

  return { approvers };
}

// deno-lint-ignore no-explicit-any
type SlackClient = any;

/**
 * Update profile using Admin User Token
 */
async function updateProfile(
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
    body: JSON.stringify({ user: userId, profile }),
  });
  const result = await response.json();
  return { ok: result.ok === true, error: result.error };
}

/**
 * Fetch user profile using users.profile.get API
 *
 * @param client - Slack API client
 * @param userId - Target user ID
 * @returns User profile data
 */
async function fetchUserProfile(
  client: SlackClient,
  userId: string,
): Promise<{ ok: boolean; profile?: UserProfile; error?: string }> {
  console.log(t("logs.fetching_user_profile", { userId }));

  const response = await client.users.profile.get({ user: userId });

  if (!response.ok) {
    console.error(
      t("errors.api_call_failed", { error: response.error ?? "unknown" }),
    );
    return { ok: false, error: response.error };
  }

  const profile: UserProfile = {
    display_name: response.profile?.display_name ?? "",
    title: response.profile?.title ?? "",
    phone: response.profile?.phone ?? "",
    pronouns: response.profile?.pronouns ?? "",
  };

  console.log(
    t("logs.user_profile_fetched", { count: Object.keys(profile).length }),
  );

  return { ok: true, profile };
}

/**
 * Send a direct message to a user
 *
 * Opens a DM channel first using conversations.open, then sends the message.
 * This is required because chat.postMessage expects a channel ID, not a user ID.
 *
 * @param client - Slack API client
 * @param userId - Target user ID to send DM to
 * @param text - Message text
 * @param blocks - Optional message blocks
 * @returns Result of the postMessage call
 */
async function sendDirectMessage(
  client: SlackClient,
  userId: string,
  text: string,
  blocks?: unknown[],
): Promise<{ ok: boolean; error?: string }> {
  // Open DM channel with the user
  const openResult = await client.conversations.open({ users: userId });
  if (!openResult.ok) {
    console.error(
      t("errors.api_call_failed", { error: openResult.error ?? "unknown" }),
    );
    return { ok: false, error: openResult.error };
  }

  const dmChannelId = openResult.channel?.id;
  if (!dmChannelId) {
    console.error(t("errors.api_call_failed", { error: "no_channel_id" }));
    return { ok: false, error: "no_channel_id" };
  }

  // Send message to the DM channel
  const messageParams: { channel: string; text: string; blocks?: unknown[] } = {
    channel: dmChannelId,
    text,
  };
  if (blocks) {
    messageParams.blocks = blocks;
  }

  const postResult = await client.chat.postMessage(messageParams);
  if (!postResult.ok) {
    console.error(
      t("errors.api_call_failed", { error: postResult.error ?? "unknown" }),
    );
  }
  return { ok: postResult.ok, error: postResult.error };
}

/**
 * Main function handler
 */
export default SlackFunction(
  ShowProfileUpdateFormDefinition,
  async ({ inputs, client, env }) => {
    // Initialize i18n system
    await initI18n();

    const { interactivity, user_id, channel_id } = inputs;

    console.log(t("logs.starting"));
    console.log(
      "[Main] user_id:",
      user_id,
      "trigger_id:",
      interactivity.interactivity_pointer,
    );

    try {
      // 1. Show loading modal immediately
      console.log("[views.open] Calling...");
      const loadingResult = await client.views.open({
        trigger_id: interactivity.interactivity_pointer,
        view: buildLoadingView(),
      });
      console.log(
        "[views.open] Response ok:",
        loadingResult.ok,
        "error:",
        loadingResult.error,
      );

      if (!loadingResult.ok) {
        console.error(
          t("errors.modal_open_failed", { error: loadingResult.error ?? "" }),
        );
        return {
          error: t("errors.modal_open_failed", {
            error: loadingResult.error ?? "",
          }),
          outputs: { success: false },
        };
      }

      const viewId = loadingResult.view?.id;

      // Get admin token and team_id
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        return {
          error: t("errors.missing_admin_token"),
          outputs: { success: false },
        };
      }

      // Get team_id using auth.test
      const authResponse = await client.auth.test();
      if (!authResponse.ok || !authResponse.team_id) {
        return {
          error: t("errors.api_call_failed", {
            error: authResponse.error ?? "no_team_id",
          }),
          outputs: { success: false },
        };
      }
      const teamId = authResponse.team_id as string;

      // 2. Fetch user permissions, approvers, and initial profile in parallel
      console.log(
        "[Promise.all] Starting parallel fetch for user_id:",
        user_id,
      );
      const [permResult, approversResult, profileResult] = await Promise.all([
        checkUserPermissions(client, user_id),
        fetchApprovers(adminToken, teamId, user_id),
        fetchUserProfile(client, user_id),
      ]);
      console.log(
        "[Promise.all] Completed. permResult.error:",
        permResult.error,
        "approversResult.error:",
        approversResult.error,
        "profileResult.error:",
        profileResult.error,
      );

      if (permResult.error) {
        return {
          error: t("errors.api_call_failed", { error: permResult.error }),
          outputs: { success: false },
        };
      }

      if (approversResult.error) {
        return {
          error: approversResult.error,
          outputs: { success: false },
        };
      }

      // Profile fetch error is non-fatal, continue with empty profile
      const initialProfile = profileResult.ok
        ? profileResult.profile
        : undefined;

      const approvers = approversResult.approvers;
      console.log(
        t("logs.authorized_users_fetched", { count: approvers.length }),
      );

      // 3. Update modal with profile form (including initial profile values)
      const formView = buildProfileFormView(
        user_id,
        permResult.isAdminOrOwner,
        approvers,
        channel_id,
        user_id, // target user is initially the operator
        initialProfile,
      );
      const updateResult = await client.views.update({
        view_id: viewId,
        view: formView,
      });

      if (!updateResult.ok) {
        console.error(
          t("errors.modal_update_failed", { error: updateResult.error ?? "" }),
        );
        return {
          error: t("errors.modal_update_failed", {
            error: updateResult.error ?? "",
          }),
          outputs: { success: false },
        };
      }

      console.log(t("logs.modal_opened"));

      // Return incomplete to wait for form submission
      return { completed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("errors.api_call_failed", { error: message }));
      return {
        error: t("errors.api_call_failed", { error: message }),
        outputs: { success: false },
      };
    }
  },
)
  // Handle form submission
  .addViewSubmissionHandler(
    FORM_CALLBACK_ID,
    async ({ view, client, env }) => {
      await initI18n();
      console.log(t("logs.form_submitted"));

      const values = view.state.values;
      const metadata = JSON.parse(view.private_metadata ?? "{}");
      const operatorId = metadata.operator_id;
      const isAdminOrOwner = metadata.is_admin_or_owner;
      const approversAvailable = metadata.approvers_available ?? false;
      const sourceChannelId = metadata.channel_id;

      // Extract target user from the fixed block_id
      const targetUserId =
        values.target_user_block?.target_user_select?.selected_user ??
          operatorId;

      // Block IDs are dynamic with target user suffix to force Slack to use new initial_value
      const blockIdSuffix = `_${targetUserId}`;

      // Extract form values using dynamic block_ids
      const displayName =
        values[`display_name_block${blockIdSuffix}`]?.display_name?.value ?? "";
      const title = values[`title_block${blockIdSuffix}`]?.title?.value ?? "";
      const phone = values[`phone_block${blockIdSuffix}`]?.phone?.value ?? "";
      const pronouns =
        values[`pronouns_block${blockIdSuffix}`]?.pronouns?.value ?? "";
      const approverIds =
        values.approver_block?.approvers?.selected_options?.map(
          (opt: { value: string }) => opt.value,
        ) ?? [];
      const reason = values.reason_block?.reason?.value ?? "";

      // Fetch current profile to show before/after diff
      const currentProfileResult = await fetchUserProfile(
        client as unknown as SlackClient,
        targetUserId,
      );
      const currentProfile = currentProfileResult.profile ?? {};

      // Debug: Log form values vs current profile
      console.log("[ViewSubmissionHandler] Form values:", {
        displayName,
        title,
        phone,
        pronouns,
      });
      console.log("[ViewSubmissionHandler] Current profile:", currentProfile);

      // Build profile changes with old and new values for diff display
      // Only include fields where the value actually changed
      const changes: Record<string, ProfileChange> = {};
      if (displayName && displayName !== (currentProfile.display_name ?? "")) {
        changes.display_name = {
          old: currentProfile.display_name ?? "",
          new: displayName,
        };
      }
      if (title && title !== (currentProfile.title ?? "")) {
        changes.title = { old: currentProfile.title ?? "", new: title };
      }
      if (phone && phone !== (currentProfile.phone ?? "")) {
        changes.phone = { old: currentProfile.phone ?? "", new: phone };
      }
      if (pronouns && pronouns !== (currentProfile.pronouns ?? "")) {
        changes.pronouns = {
          old: currentProfile.pronouns ?? "",
          new: pronouns,
        };
      }

      if (Object.keys(changes).length === 0) {
        return {
          response_action: "errors",
          errors: {
            [`display_name_block${blockIdSuffix}`]: t(
              "errors.no_fields_to_update",
            ),
          },
        };
      }

      const config = getPermissionConfig();
      const isSelf = operatorId === targetUserId;

      // Determine if direct execution is allowed
      const canExecuteDirectly = isAdminOrOwner ||
        (isSelf &&
          Object.keys(changes).every((f) =>
            config.allowed_self_edit_fields.includes(f)
          ));

      if (canExecuteDirectly) {
        // Direct execution
        const adminToken = env.SLACK_ADMIN_USER_TOKEN;
        if (!adminToken) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.missing_admin_token"),
            },
          };
        }

        // Extract new values for API call
        const newValues: Record<string, string> = {};
        for (const [field, change] of Object.entries(changes)) {
          newValues[field] = change.new;
        }

        const result = await updateProfile(targetUserId, newValues, adminToken);
        if (!result.ok) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.profile_update_failed", {
                error: result.error ?? "",
              }),
            },
          };
        }

        // Build changes text with before → after diff for notification
        const changesText = Object.entries(changes)
          .map(([field, change]) =>
            t("messages.field_change", {
              field,
              old: change.old || t("messages.no_changes"),
              new: change.new,
            })
          )
          .join("\n");

        // Send success notification via DM to operator with changes
        await sendDirectMessage(
          client,
          operatorId,
          t("messages.update_success_notification", {
            target: targetUserId,
            updater: operatorId,
            changes: changesText,
          }),
        );

        // Send channel notification to the source channel
        if (sourceChannelId) {
          await client.chat.postMessage({
            channel: sourceChannelId,
            text: t("messages.update_success_notification", {
              target: targetUserId,
              updater: operatorId,
              changes: changesText,
            }),
          });
        }

        // Complete the function
        await client.functions.completeSuccess({
          function_execution_id: view.function_data?.execution_id ?? "",
          outputs: {
            success: true,
            approval_required: false,
            updated_user_id: targetUserId,
          },
        });
      } else {
        // Approval required
        // Check if approvers are available
        if (!approversAvailable) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.no_approvers_available"),
            },
          };
        }

        if (!approverIds || approverIds.length === 0) {
          return {
            response_action: "errors",
            errors: {
              approver_block: t("errors.no_approver_selected"),
            },
          };
        }

        // Send approval request to source channel
        const blocks = buildApprovalMessage(
          operatorId,
          targetUserId,
          changes,
          reason,
          approverIds,
        );

        if (sourceChannelId) {
          await client.chat.postMessage({
            channel: sourceChannelId,
            blocks,
            text: t("messages.approval_request_header"),
          });
        }

        // Send DM notification to each approver
        for (const approverId of approverIds) {
          await sendDirectMessage(
            client,
            approverId,
            t("messages.approval_request_dm", {
              requester: operatorId,
              target: targetUserId,
            }),
          );
        }

        // Notify requester via DM
        await sendDirectMessage(
          client,
          operatorId,
          t("messages.approval_request_sent"),
        );

        // DO NOT call completeSuccess here!
        // The function must remain incomplete to handle BlockActions (approve/deny buttons)
        // completeSuccess will be called in the BlockActionsHandler
      }

      return;
    },
  )
  // Handle approval action
  .addBlockActionsHandler(
    [APPROVE_ACTION_ID],
    async ({ action, body, client, env }) => {
      await initI18n();
      console.log(
        t("logs.processing_approval", {
          action: "approve",
          reviewer: body.user.id,
        }),
      );

      const data = JSON.parse(action.value);
      const { requester_id, target_user_id, changes, approver_ids } = data;
      const reviewerId = body.user.id;

      // Check if reviewer is authorized
      if (approver_ids && !approver_ids.includes(reviewerId)) {
        // Check if reviewer is admin/owner
        const permResult = await checkUserPermissions(client, reviewerId);
        if (!permResult.isAdminOrOwner) {
          await client.chat.postEphemeral({
            channel: body.channel?.id ?? "",
            user: reviewerId,
            text: t("errors.not_authorized_approver_multiple", {
              approvers: approver_ids.map((id: string) => `<@${id}>`).join(
                ", ",
              ),
            }),
          });
          return;
        }
      }

      // Get admin token
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        await client.chat.postEphemeral({
          channel: body.channel?.id ?? "",
          user: reviewerId,
          text: t("errors.missing_admin_token"),
        });
        return;
      }

      // Extract new values for API call (changes has { old, new } format)
      const newValues: Record<string, string> = {};
      for (const [field, change] of Object.entries(changes)) {
        if (typeof change === "object" && change !== null && "new" in change) {
          const changeObj = change as { old: string; new: string };
          newValues[field] = changeObj.new;
        } else {
          // Fallback for old format (string value)
          newValues[field] = String(change);
        }
      }

      // Update profile
      const result = await updateProfile(target_user_id, newValues, adminToken);
      if (!result.ok) {
        await client.chat.postEphemeral({
          channel: body.channel?.id ?? "",
          user: reviewerId,
          text: t("errors.profile_update_failed", {
            error: result.error ?? "",
          }),
        });
        return;
      }

      // Update the message to show approval
      const approvedText = t("messages.request_approved", {
        approver: reviewerId,
        requester: requester_id,
        target: target_user_id,
      });

      await client.chat.update({
        channel: body.channel?.id ?? "",
        ts: body.message?.ts ?? "",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: approvedText,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: t("messages.approved_at", {
                  time: new Date().toISOString(),
                }),
              },
            ],
          },
        ],
        text: approvedText,
      });

      // Build changes text with before → after diff
      const changesText = Object.entries(changes)
        .map(([field, change]) => {
          if (
            typeof change === "object" && change !== null && "new" in change
          ) {
            const changeObj = change as { old: string; new: string };
            return t("messages.field_change", {
              field,
              old: changeObj.old || t("messages.no_changes"),
              new: changeObj.new,
            });
          } else {
            // Fallback for old format
            return `• ${field}: ${String(change)}`;
          }
        })
        .join("\n");

      // Notify requester via DM
      await sendDirectMessage(
        client,
        requester_id,
        t("messages.update_success_notification", {
          target: target_user_id,
          updater: reviewerId,
          changes: changesText,
        }),
      );

      // Complete the function
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          success: true,
          approval_required: true,
          updated_user_id: target_user_id,
        },
      });
    },
  )
  // Handle denial action
  .addBlockActionsHandler(
    [DENY_ACTION_ID],
    async ({ action, body, client }) => {
      await initI18n();
      console.log(
        t("logs.processing_approval", {
          action: "deny",
          reviewer: body.user.id,
        }),
      );

      const data = JSON.parse(action.value);
      const { requester_id, target_user_id, approver_ids } = data;
      const reviewerId = body.user.id;

      // Check if reviewer is authorized
      if (approver_ids && !approver_ids.includes(reviewerId)) {
        const permResult = await checkUserPermissions(client, reviewerId);
        if (!permResult.isAdminOrOwner) {
          await client.chat.postEphemeral({
            channel: body.channel?.id ?? "",
            user: reviewerId,
            text: t("errors.not_authorized_approver_multiple", {
              approvers: approver_ids.map((id: string) => `<@${id}>`).join(
                ", ",
              ),
            }),
          });
          return;
        }
      }

      // Update the message to show denial
      const deniedText = t("messages.request_denied", {
        approver: reviewerId,
        requester: requester_id,
        target: target_user_id,
      });

      await client.chat.update({
        channel: body.channel?.id ?? "",
        ts: body.message?.ts ?? "",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: deniedText,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: t("messages.denied_at", {
                  time: new Date().toISOString(),
                }),
              },
            ],
          },
        ],
        text: deniedText,
      });

      // Notify requester via DM
      await sendDirectMessage(client, requester_id, deniedText);

      // Complete the function
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          success: false,
          approval_required: true,
          updated_user_id: target_user_id,
        },
      });
    },
  )
  // Handle target user selection change
  .addBlockActionsHandler(
    [TARGET_USER_ACTION_ID],
    async ({ action, body, client }) => {
      try {
        await initI18n();
        console.log(
          "[BlockActionsHandler] Target user selection changed:",
          action.selected_user,
        );

        // Get selected user ID from the action
        const selectedUserId = action.selected_user;
        if (!selectedUserId) {
          console.error("[BlockActionsHandler] No user selected");
          return;
        }

        // Get metadata from the view
        const view = body.view;
        if (!view) {
          console.error("[BlockActionsHandler] No view found in body");
          return;
        }

        console.log(
          "[BlockActionsHandler] view.id:",
          view.id,
          "private_metadata:",
          view.private_metadata,
        );

        const metadata = JSON.parse(view.private_metadata ?? "{}");
        const {
          operator_id: operatorId,
          is_admin_or_owner: isAdminOrOwner,
          approvers,
          channel_id: channelId,
        } = metadata;

        console.log(
          "[BlockActionsHandler] Fetching profile for user:",
          selectedUserId,
        );

        // Fetch the selected user's profile
        const profileResult = await fetchUserProfile(client, selectedUserId);
        const newProfile = profileResult.ok ? profileResult.profile : undefined;

        console.log(
          "[BlockActionsHandler] Profile result ok:",
          profileResult.ok,
          "profile:",
          JSON.stringify(newProfile),
        );

        // Rebuild the form with new initial values
        const newFormView = buildProfileFormView(
          operatorId,
          isAdminOrOwner,
          approvers ?? [],
          channelId,
          selectedUserId,
          newProfile,
        );

        console.log(
          "[BlockActionsHandler] Calling views.update with view_id:",
          view.id,
        );

        // Update the modal
        const updateResult = await client.views.update({
          view_id: view.id,
          view: newFormView,
        });

        if (!updateResult.ok) {
          console.error(
            "[BlockActionsHandler] views.update failed:",
            updateResult.error,
          );
          console.error(
            t("errors.modal_update_failed", {
              error: updateResult.error ?? "",
            }),
          );
        } else {
          console.log(
            "[BlockActionsHandler] Modal updated with new profile values",
          );
        }
      } catch (error) {
        console.error(
          "[BlockActionsHandler] Unexpected error:",
          error instanceof Error ? error.message : String(error),
        );
        console.error("[BlockActionsHandler] Stack:", error);
      }
    },
  );
