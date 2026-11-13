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
