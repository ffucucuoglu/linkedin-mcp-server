import type { ApiResult } from "./client.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// Shared formatter — keeps every tool consistent on how 402/410/422 are
// presented back to the LLM. We surface the API's error code verbatim so
// the model can branch on it ("extension_required" → tell the user to run
// the extension; "insufficient_credits" → tell the user to top up).

const SAFETY_CODES = new Set([
  "safety_limit",
  "too_fast",
  "outside_working_hours",
  "duplicate_target",
  "account_paused",
  "challenge_unresolved",
]);

export function formatResult<T>(result: ApiResult<T>): ToolResult {
  if (result.ok) {
    return {
      content: [
        { type: "text", text: JSON.stringify(result.data, null, 2) },
      ],
    };
  }

  const lines = [
    `LinkFetch API error (HTTP ${result.status}${
      result.code ? `, code: ${result.code}` : ""
    })`,
    result.message,
  ];

  // Extra nudges for the two states a caller needs to act on.
  if (result.code === "extension_required") {
    lines.push(
      "",
      "Resolution: the record isn't cached yet. Ask the user to open the LinkFetch Chrome extension on a signed-in LinkedIn tab and navigate to the relevant page; the extension will capture and POST it, and this call will succeed on retry.",
    );
  } else if (result.code === "linkedin_not_connected") {
    const b = (result.body ?? {}) as { connect_url?: string };
    lines.push(
      "",
      `Resolution: the result isn't cached and the user hasn't connected LinkedIn. Ask them to connect at ${b.connect_url ?? "https://linkfetch.io/linkedin"} (takes about a minute), or to use the LinkFetch Chrome extension, then retry.`,
    );
  } else if (result.code === "linkedin_session_expired") {
    const b = (result.body ?? {}) as { reconnect_url?: string; session_status?: string };
    lines.push(
      "",
      `Resolution: the user's LinkedIn session is ${b.session_status ?? "no longer valid"}. Explain plainly and ask them to reconnect at ${b.reconnect_url ?? "https://linkfetch.io/linkedin"}. Don't retry until they have.`,
    );
  } else if (result.code && SAFETY_CODES.has(result.code)) {
    const b = (result.body ?? {}) as { resets_at?: string | null };
    lines.push(
      "",
      `Resolution: this is LinkFetch's account-safety limit protecting the user's LinkedIn account from restriction — it cannot be bypassed.${
        b.resets_at ? ` Next allowed at ${b.resets_at}.` : ""
      } Explain this to the user in plain words, tell them when it resets, and offer to continue later. For challenge_unresolved: ask them to complete LinkedIn's security check on linkedin.com, then call linkfetch_safety_resume. Limits and reasons: linkfetch_safety_limits.`,
    );
  } else if (result.code === "insufficient_credits") {
    lines.push(
      "",
      "Resolution: top up at https://linkfetch.io/dashboard, then retry.",
    );
  }

  return {
    isError: true,
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
