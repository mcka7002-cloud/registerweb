# CLAUDE.md

## Always plan before doing

Before any change, show a plan and **wait for the user's OK**. A change means editing, creating or deleting
files, running commands that modify anything (installs, migrations, git commits/pushes, DB writes), or
publishing anything.

- The plan lists the steps, the files or systems each step touches, and how the result will be verified.
- Reading files, searching, and running read-only checks (tests, typecheck, `git status`) are allowed before
  the plan, to make it accurate.
- Approval covers only the plan that was shown. If the work turns out to need something the plan didn't
  include, stop and show the updated plan first.
- When the user's message already approves a specific action ("commit this", "apply the fix"), that counts
  as approval for that action only.

## Track work in Figma

`README.md` is background information. Task status lives on page **06 Tasks** of
[Figma RegisterWeb](https://www.figma.com/design/oY12YnecLV5ObKXacDqP3D/RegisterWeb) (one card per task, `#<number>`).

- When work on a task starts: set the card's owner and change its badge to **กำลังทำ** (in progress).
- When it's merged: change the badge to **เสร็จแล้ว** (done).
- Work that has no card gets a new card in the matching column (next free number, "หลัง #…" dependencies).
- Badge colours use the file's library variables: Secondary for ยังไม่เริ่ม, Warning (Background/Warning/Tertiary
  + Text/Warning/Default) for กำลังทำ, Positive (Background/Positive/Tertiary + Text/Positive/Default) for เสร็จแล้ว.
  Card text uses IBM Plex Sans Thai (column titles are SemiBold; load it before editing them).
- Figma changes follow the plan-first rule like any other change.

## Big tasks: split to sub-agents, then review the whole

- When a task is too big for one pass, write the contract first (files each part owns, interfaces, done
  criteria; see `docs/mvp1/contracts.md`), then give each part to a sub-agent in its own git worktree.
  Parts that touch the same files never run at the same time.
- The lead merges the branches and runs one overall review: tests, typecheck, lint, build, the ADR 0001 data
  access rules, and an end-to-end run of the demo script. Sub-agent reports are not proof; check the result.
