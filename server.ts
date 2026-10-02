import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { DEFAULT_PLAN_PROMPT } from "./lib/plan-mode-input";

const OLD_DEFAULT_PROMPT =
  "YOU ARE ONLY TO ANALYZE THE SITUATION AND RECOMMEND A PLAN, YOU ARE NOT TO CODE OR TAKE ANY ACTION";

/** Persisted per thread once Plan Mode has been turned on there. */
interface StoredThreadState {
  enabled: boolean;
}

const threadKey = (threadId: string) => `thread:${threadId}`;

export const rpcContract = defineRpcContract({
  setPlanMode: {
    input: z.object({
      threadId: z.string(),
      enabled: z.boolean(),
    }),
    output: z.object({
      ok: z.boolean(),
      enabled: z.boolean(),
    }),
  },
  getPlanMode: {
    input: z.object({
      threadId: z.string().nullable().optional(),
    }),
    output: z.object({
      enabled: z.boolean(),
      /** Plan Mode was on at some point in this thread. */
      planned: z.boolean(),
      defaultOn: z.boolean(),
      prompt: z.string(),
    }),
  },
});

function effectivePrompt(prompt: unknown): string {
  return typeof prompt === "string" && prompt.trim() && prompt !== OLD_DEFAULT_PROMPT
    ? prompt
    : DEFAULT_PLAN_PROMPT;
}

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("Plan Mode plugin initialized");

  const settings = bb.settings.define({
    defaultOn: {
      type: "boolean",
      label: "Default Plan Mode on for new chats",
      description: "When enabled, the new-chat composer starts in Plan Mode.",
      default: false,
    },
    prompt: {
      type: "string",
      label: "Plan Mode Prompt Directive",
      description: "Directive attached (hidden) to each message sent while Plan Mode is on.",
      experimental_multiline: true,
      default: DEFAULT_PLAN_PROMPT,
    },
  });

  bb.rpc.register(rpcContract, {
    async setPlanMode({ threadId, enabled }) {
      const stored = await bb.storage.kv.get<StoredThreadState>(threadKey(threadId));
      // A thread that was never planned needs no record: it is off and has no
      // plan-mode history to contradict.
      if (enabled || stored) {
        await bb.storage.kv.set(threadKey(threadId), { enabled } satisfies StoredThreadState);
      }
      return { ok: true, enabled };
    },
    async getPlanMode({ threadId }) {
      const current = await settings.get();
      const defaultOn = current?.defaultOn === true;
      const prompt = effectivePrompt(current?.prompt);
      if (!threadId) {
        return { enabled: defaultOn, planned: false, defaultOn, prompt };
      }
      const stored = await bb.storage.kv.get<StoredThreadState>(threadKey(threadId));
      return { enabled: stored?.enabled === true, planned: stored !== undefined, defaultOn, prompt };
    },
  });

  bb.events.on("thread.deleted", async ({ thread }) => {
    await bb.storage.kv.delete(threadKey(thread.id));
  });
}
