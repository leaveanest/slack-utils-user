/**
 * Tests for GetAuthorizedApprovers function
 *
 * @module functions/get_authorized_approvers/test
 */

import { assertEquals } from "std/testing/asserts.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import * as mf from "mock-fetch/mod.ts";
import handler, { GetAuthorizedApproversDefinition } from "./mod.ts";
import { initI18n } from "../../lib/i18n/mod.ts";

// Initialize i18n before tests
await initI18n();

// Install mock fetch
mf.install();

const { createContext } = SlackFunctionTester("get_authorized_approvers");

/**
 * Mock users.list API response
 */
function mockUsersList(
  members: Array<{
    id: string;
    name: string;
    real_name?: string;
    is_admin?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_bot?: boolean;
    deleted?: boolean;
  }>,
  options?: {
    nextCursor?: string;
  },
) {
  return {
    ok: true,
    members,
    response_metadata: {
      next_cursor: options?.nextCursor ?? "",
    },
  };
}

/**
 * Mock API error response
 */
function mockApiError(errorCode: string) {
  return {
    ok: false,
    error: errorCode,
  };
}

Deno.test("GetAuthorizedApprovers - 関数定義が正しく設定されている", () => {
  assertEquals(
    GetAuthorizedApproversDefinition.definition.callback_id,
    "get_authorized_approvers",
  );
  assertEquals(
    GetAuthorizedApproversDefinition.definition.title,
    "承認者取得",
  );
});

Deno.test("GetAuthorizedApprovers - Admin/Ownerユーザーを正しく取得できる", async () => {
  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(
        mockUsersList([
          {
            id: "U001",
            name: "admin_user",
            real_name: "Admin User",
            is_admin: true,
          },
          {
            id: "U002",
            name: "owner_user",
            real_name: "Owner User",
            is_owner: true,
          },
          {
            id: "U003",
            name: "primary_owner",
            real_name: "Primary Owner",
            is_primary_owner: true,
          },
          { id: "U004", name: "regular_user", real_name: "Regular User" },
        ]),
      ),
    );
  });

  const context = createContext({ inputs: {} });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 3);
  assertEquals(result.outputs?.approvers?.length, 3);

  const approverIds = result.outputs?.approvers?.map((a) => a.id);
  assertEquals(approverIds?.includes("U001"), true);
  assertEquals(approverIds?.includes("U002"), true);
  assertEquals(approverIds?.includes("U003"), true);
  assertEquals(approverIds?.includes("U004"), false);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - ボットと削除済みユーザーを除外する", async () => {
  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(
        mockUsersList([
          { id: "U001", name: "admin_user", is_admin: true },
          { id: "B001", name: "bot_admin", is_admin: true, is_bot: true },
          { id: "U002", name: "deleted_admin", is_admin: true, deleted: true },
        ]),
      ),
    );
  });

  const context = createContext({ inputs: {} });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 1);
  assertEquals(result.outputs?.approvers?.[0].id, "U001");

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - exclude_user_idで指定したユーザーを除外する", async () => {
  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(
        mockUsersList([
          { id: "U001", name: "admin_user", is_admin: true },
          { id: "U002", name: "owner_user", is_owner: true },
        ]),
      ),
    );
  });

  const context = createContext({ inputs: { exclude_user_id: "U001" } });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 1);
  assertEquals(result.outputs?.approvers?.[0].id, "U002");

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - Admin/Ownerが存在しない場合は空配列を返す", async () => {
  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(
        mockUsersList([
          { id: "U001", name: "regular_user1" },
          { id: "U002", name: "regular_user2" },
        ]),
      ),
    );
  });

  const context = createContext({ inputs: {} });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 0);
  assertEquals(result.outputs?.approvers?.length, 0);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - ページネーションを正しく処理できる", async () => {
  let callCount = 0;

  mf.mock("POST@/api/users.list", () => {
    callCount++;

    if (callCount === 1) {
      return new Response(
        JSON.stringify(
          mockUsersList(
            [
              { id: "U001", name: "admin1", is_admin: true },
              { id: "U002", name: "admin2", is_admin: true },
            ],
            { nextCursor: "cursor_page_2" },
          ),
        ),
      );
    }

    return new Response(
      JSON.stringify(
        mockUsersList([
          { id: "U003", name: "owner1", is_owner: true },
          { id: "U004", name: "owner2", is_owner: true },
        ]),
      ),
    );
  });

  const context = createContext({ inputs: {} });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 4);
  assertEquals(result.outputs?.approvers?.length, 4);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - APIエラー時にエラーを返す", async () => {
  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(mockApiError("users_list_not_allowed")),
    );
  });

  const context = createContext({ inputs: {} });
  const result = await handler(context);

  assertEquals(result.outputs?.count, 0);
  assertEquals(result.outputs?.approvers?.length, 0);
  assertEquals(typeof result.error, "string");
  assertEquals(result.error?.includes("users_list_not_allowed"), true);

  mf.reset();
});

Deno.test("GetAuthorizedApprovers - approverの属性が正しく設定される", async () => {
  mf.mock("POST@/api/users.list", () => {
    return new Response(
      JSON.stringify(
        mockUsersList([
          {
            id: "U001",
            name: "full_approver",
            real_name: "Full Approver",
            is_admin: true,
            is_owner: true,
            is_primary_owner: true,
          },
        ]),
      ),
    );
  });

  const context = createContext({ inputs: {} });
  const result = await handler(context);

  const approver = result.outputs?.approvers?.[0];
  assertEquals(approver?.id, "U001");
  assertEquals(approver?.name, "full_approver");
  assertEquals(approver?.real_name, "Full Approver");
  assertEquals(approver?.is_admin, true);
  assertEquals(approver?.is_owner, true);
  assertEquals(approver?.is_primary_owner, true);

  mf.reset();
});
