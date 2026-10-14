// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { rpcContract } from "./server";

afterEach(() => {
  cleanup();
  document.querySelectorAll("textarea").forEach((editor) => editor.remove());
});

async function mountToggle(enabled = true) {
  const app = await loadPluginApp(() => import("./app"));
  const action = app.composerCustomizations[0]!.actions![0]!;
  const threadId = `mobile-toggle-${crypto.randomUUID()}`;
  const slot = renderSlot<object, typeof rpcContract>(action, {}, {
    context: { projectId: "project", threadId },
    rpc: {
      getPlanMode: () => ({ enabled, planned: enabled, defaultOn: false, prompt: "Plan only" }),
      setPlanMode: ({ enabled }: { enabled: boolean }) => ({ ok: true, enabled }),
    },
  });
  const button = slot.getByRole("button");
  await waitFor(() => expect(button.getAttribute("aria-pressed")).toBe(String(enabled)));
  return { slot, button, threadId };
}

function pointerDown(button: HTMLElement, pointerType: string, buttonNumber = 0) {
  const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: buttonNumber });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return fireEvent(button, event);
}

describe("Plan Mode toggle focus", () => {
  for (const pointerType of ["touch", "mouse", "pen"]) {
    it(`keeps the editor focused and toggles once on a ${pointerType} click`, async () => {
      const { slot, button, threadId } = await mountToggle();
      const editor = document.createElement("textarea");
      document.body.append(editor);
      editor.focus();
      // Model the mobile host boundary: an uncancelled press dismisses the
      // editor and removes composer actions before the compatibility click.
      if (pointerDown(button, pointerType)) {
        editor.blur();
        slot.lifecycle.unmount();
      }
      expect(document.activeElement).toBe(editor);
      expect(button.isConnected).toBe(true);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      fireEvent.pointerUp(button);
      fireEvent.click(button, { detail: 1 });
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(slot.inspection.rpcCalls.filter(({ method }) => method === "setPlanMode")).toEqual([
        { method: "setPlanMode", input: { threadId, enabled: false } },
      ]);
      editor.remove();
    });
  }

  it("does not toggle on a cancelled touch gesture or a secondary press", async () => {
    const { slot, button } = await mountToggle();
    pointerDown(button, "touch");
    fireEvent.pointerCancel(button);
    expect(pointerDown(button, "mouse", 2)).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(slot.inspection.rpcCalls.filter(({ method }) => method === "setPlanMode")).toEqual([]);
  });

  it("supports keyboard and assistive-technology clicks in both directions", async () => {
    const { button } = await mountToggle(false);
    button.focus();
    fireEvent.click(button, { detail: 0 });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(button);
    fireEvent.click(button, { detail: 0 });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
