#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Test Slack API users.list endpoint
 */

import { load } from "std/dotenv/mod.ts";

// Load .env file
const env = await load({
  export: true,
  allowEmptyValues: true,
  defaultsPath: null,
  examplePath: null,
});

const ADMIN_TOKEN = Deno.env.get("SLACK_ADMIN_USER_TOKEN") ||
  env["SLACK_ADMIN_USER_TOKEN"];

if (!ADMIN_TOKEN) {
  console.error("SLACK_ADMIN_USER_TOKEN is not set in .env");
  Deno.exit(1);
}

console.log("Testing users.list API with Admin User Token...");
console.log("Token prefix:", ADMIN_TOKEN.substring(0, 10) + "...");

// Test 1: users.list without parameters
console.log("\n=== Test 1: users.list without parameters ===");
try {
  const response1 = await fetch("https://slack.com/api/users.list", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${ADMIN_TOKEN}`,
    },
  });
  const result1 = await response1.json();
  console.log("Response ok:", result1.ok);
  console.log("Error:", result1.error);
  console.log("Members count:", result1.members?.length);
} catch (error) {
  console.error("Test 1 failed:", error);
}

// Test 2: users.list with limit parameter
console.log("\n=== Test 2: users.list with limit=10 ===");
try {
  const response2 = await fetch("https://slack.com/api/users.list?limit=10", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${ADMIN_TOKEN}`,
    },
  });
  const result2 = await response2.json();
  console.log("Response ok:", result2.ok);
  console.log("Error:", result2.error);
  console.log("Members count:", result2.members?.length);
  if (result2.members && result2.members.length > 0) {
    console.log("First member:", {
      id: result2.members[0].id,
      name: result2.members[0].name,
      is_admin: result2.members[0].is_admin,
      is_bot: result2.members[0].is_bot,
    });
  }
} catch (error) {
  console.error("Test 2 failed:", error);
}

// Test 3: users.info
console.log("\n=== Test 3: users.info for current user ===");
try {
  const response3 = await fetch("https://slack.com/api/auth.test", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${ADMIN_TOKEN}`,
    },
  });
  const authResult = await response3.json();
  console.log("Auth test ok:", authResult.ok);
  console.log("User ID:", authResult.user_id);

  if (authResult.ok && authResult.user_id) {
    const response4 = await fetch(
      `https://slack.com/api/users.info?user=${authResult.user_id}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ADMIN_TOKEN}`,
        },
      },
    );
    const userResult = await response4.json();
    console.log("users.info ok:", userResult.ok);
    console.log("Error:", userResult.error);
    if (userResult.user) {
      console.log("User info:", {
        id: userResult.user.id,
        name: userResult.user.name,
        is_admin: userResult.user.is_admin,
        is_owner: userResult.user.is_owner,
      });
    }
  }
} catch (error) {
  console.error("Test 3 failed:", error);
}
