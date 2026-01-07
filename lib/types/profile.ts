/**
 * Profile type definitions for slack-utils-user
 *
 * Defines types for user profiles, custom fields, permissions, and approval workflows.
 */

/**
 * Slack profile fields
 */
export interface ProfileFields {
  display_name?: string;
  title?: string;
  phone?: string;
  pronouns?: string;
  start_date?: string;
}

/**
 * Custom field definition
 */
export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: "text" | "options_list" | "date";
  options?: string[];
  hint?: string;
  is_hidden?: boolean;
}

/**
 * User permission information
 */
export interface UserPermissions {
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
}

/**
 * Approval request information
 */
export interface ApprovalRequest {
  request_id: string;
  requester_id: string;
  target_user_id: string;
  approver_ids: string[];
  changes: ProfileChange[];
  reason?: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
}

/**
 * Profile change information
 */
export interface ProfileChange {
  field: string;
  old_value?: string;
  new_value?: string;
}

/**
 * Authorized approver information
 */
export interface AuthorizedApprover {
  id: string;
  name: string;
  real_name?: string;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
}

/**
 * Permission configuration
 */
export interface PermissionConfig {
  /** Whether approval is required for profile updates */
  require_approval: boolean;

  /** Channel ID for approval requests */
  approval_channel_id: string;

  /** Fields that users can edit themselves */
  allowed_self_edit_fields: string[];

  /** Fields that only admins can edit (not even through approval) */
  admin_only_fields: string[];

  /** User/group IDs that can approve requests (empty means all Admin/Owner) */
  allowed_approvers?: string[];
}

/**
 * Default permission configuration
 */
export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  require_approval: true,
  approval_channel_id: "",
  allowed_self_edit_fields: ["display_name", "pronouns", "phone"],
  admin_only_fields: ["start_date", "employee_id"],
  allowed_approvers: undefined,
};
