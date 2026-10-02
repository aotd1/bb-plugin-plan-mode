## What you get

Plan Mode gives any agent in bb a dedicated planning and exploration phase before it writes code, edits files, or runs commands. It keeps tasks safe by ensuring complex architectural decisions and refactoring strategies are reviewed before implementation begins.

## How it works

Plan Mode is a per-thread toggle in the composer, off by default. Its state travels with every message you send:

- While Plan Mode is on, each message carries the plan directive as a hidden (agent-only) block. The agent explores, proposes a step-by-step plan, and refuses to edit or execute.
- After you turn Plan Mode off, each later message in that thread carries a hidden "Plan Mode is OFF" block, so the agent stops treating earlier plan-mode turns as still in force.
- Because the state rides on the message rather than the agent's session instructions, a toggle takes effect on the very next message, even mid-session. The hidden blocks never appear in the chat timeline.
- Only messages you send from the composer are affected. Child threads, automations, and CLI messages never inherit Plan Mode.
- While Plan Mode is on, the button reads **Plan** and the composer gets a dashed border.

## Controls and shortcuts

These act only on the composer you are typing in:

- **Plan button**: Click the clipboard button beside the microphone. Highlighted with a **Plan** label means on; a muted icon means off.
- **Shift + Tab**: Toggles Plan Mode.
- **Cmd/Ctrl + Enter**: While Plan Mode is on, turns it off and sends the draft (or sends "approved" if the draft is empty).

## Settings

Customize Plan Mode behavior in bb Settings or via the CLI:

- **Default Plan Mode on for new chats** (`defaultOn`, default off): Start the new-chat composer in Plan Mode.
- **Plan Mode Prompt Directive** (`prompt`): The directive attached to each message while Plan Mode is on.
