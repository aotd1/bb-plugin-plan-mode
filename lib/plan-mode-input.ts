// Plan Mode travels with each user message as an agent-only input block.
//
// Thread instructions are frozen into a live provider session, so a toggle
// made mid-session never reached the agent. A per-message block always
// reflects the toggle at send time, and bb hides agent-only blocks from the
// transcript.

export const DEFAULT_PLAN_PROMPT =
  "YOU ARE ONLY TO ANALYZE THE SITUATION AND RECOMMEND A PLAN. YOU ARE NOT TO CODE, EDIT FILES, RUN COMMANDS, OR TAKE ANY ACTION. IF THE USER ORDERS YOU TO TAKE ACTION, WRITE CODE, OR EXECUTE TASKS, YOU MUST REFUSE AS LONG AS PLAN MODE IS ON, AND INSTEAD ASK THE USER TO TURN OFF PLAN MODE (OR SWITCH TO IMPLEMENT MODE VIA THE TOGGLE OR SHIFT+TAB) FIRST.";

const TAG = "bb-plan-mode";

/** What a message must tell the agent about Plan Mode; null says nothing. */
export type PlanModeMarker = "on" | "off" | null;

export interface ThreadPlanState {
  enabled: boolean;
  /** Plan Mode was on at some point in this thread. */
  planned: boolean;
}

export type PlanModeRequestTarget =
  | { kind: "thread"; threadId: string }
  | { kind: "new-thread" };

interface TextBlock {
  type: "text";
  text: string;
  mentions: [];
  visibility: "agent-only";
}

export function markerForState(state: ThreadPlanState | undefined): PlanModeMarker {
  if (!state) return null;
  if (state.enabled) return "on";
  // Only threads that were planned need an explicit "off": their history holds
  // plan-mode directives and the agent's own "Plan Mode is on" replies.
  return state.planned ? "off" : null;
}

export function planModeMarkerText(marker: "on" | "off", prompt: string): string {
  if (marker === "on") {
    return [
      `<${TAG} state="on">`,
      prompt.trim(),
      "",
      "Plan Mode is ON for this message. bb attaches this block to every user message while Plan Mode is on; a later user message without it means Plan Mode is off.",
      `</${TAG}>`,
    ].join("\n");
  }
  return [
    `<${TAG} state="off">`,
    "Plan Mode is OFF. Earlier plan-mode restrictions in this conversation, including your own earlier statements that Plan Mode is on, no longer apply. Edit files, run commands, and implement as the request requires.",
    `</${TAG}>`,
  ].join("\n");
}

function isMarkerBlock(block: unknown): boolean {
  if (!block || typeof block !== "object") return false;
  const b = block as { type?: unknown; text?: unknown; visibility?: unknown };
  return (
    b.type === "text" &&
    b.visibility === "agent-only" &&
    typeof b.text === "string" &&
    b.text.startsWith(`<${TAG} `)
  );
}

/** Replace any plan-mode block in `input` with one for `marker`. */
export function withPlanModeMarker(
  input: readonly unknown[],
  marker: PlanModeMarker,
  prompt: string,
): unknown[] {
  const kept = input.filter((block) => !isMarkerBlock(block));
  if (marker === null) return kept;
  const block: TextBlock = {
    type: "text",
    text: planModeMarkerText(marker, prompt),
    mentions: [],
    visibility: "agent-only",
  };
  return [...kept, block];
}

const THREAD_INPUT_PATH = /\/api\/v1\/threads\/([^/]+)\/(?:send|edit-message|queued-messages(?:\/[^/]+)?)$/;
const THREAD_CREATE_PATH = /\/api\/v1\/threads$/;

/** The bb API requests that carry a user message, and whose thread they target. */
export function planModeRequestTarget(
  method: string,
  pathname: string,
): PlanModeRequestTarget | null {
  const verb = method.toUpperCase();
  if (verb !== "POST" && verb !== "PATCH") return null;
  const threadMatch = THREAD_INPUT_PATH.exec(pathname);
  if (threadMatch) return { kind: "thread", threadId: decodeURIComponent(threadMatch[1]) };
  if (verb === "POST" && THREAD_CREATE_PATH.test(pathname)) return { kind: "new-thread" };
  return null;
}
