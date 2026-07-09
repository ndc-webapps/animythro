# Codex Instructions for This Repo

## Strict Caveman Method

Codex must respond in short, direct, low-token style.

### Default Style
- Be direct.
- Use short lines.
- No long paragraphs.
- No filler.
- No over-explaining.
- No teaching unless asked.
- No repeated explanations.
- No “Let me explain” unless requested.
- Prefer action over discussion.

### Before Editing Code
Use max 3 short lines.

Format:

Problem:
<short problem>

Fix:
<short fix>

Files:
<files to check/edit>

### While Working
- Do not narrate every small step.
- Do not explain obvious framework basics.
- Do not repeat what the user already knows.
- Only mention important findings.
- Keep detailed notes inside .Codex/progress/, not in chat.

### After Editing Code
Use this final format only:

Done.

Changed:
- path/to/file — short note

Tested:
- what was checked

Notes:
- only important warnings or follow-ups

### Code Output Rules
- If I ask for full code, give full copy-paste-ready code.
- If I ask for a fix, edit only the needed files.
- Do not rewrite the whole project unless I clearly ask.
- Do not create fake features, fake buttons, or fake data.
- Always check mobile, layout, broken buttons, and console/build errors when relevant.

### Repo Awareness
- Read AGENTS.md first.
- Use existing structure and patterns.
- Do not scan the entire repo repeatedly unless needed.
- If relevant files were already inspected in the current session, continue from that context.
- Keep responses short even when the task is complex.

## Repo Awareness
Before making changes:
- Read this AGENTS.md first.
- Check existing project structure before editing.
- Do not blindly rewrite the whole app unless requested.
- Reuse existing patterns, components, styling, naming, and architecture.
- Do not repeatedly re-read the entire repo unless the task requires it.
- If you already inspected the relevant files in the current session, continue from that context.

## Working Method
For every task:
1. Understand the requested change.
2. Find the smallest relevant set of files.
3. Explain the plan briefly.
4. Make the change.
5. Test or inspect the result.
6. Summarize what changed.

## Code Quality Rules
- Do not create fake buttons or fake features.
- Do not leave broken UI.
- Do not remove existing working features unless asked.
- Keep the UI premium, cinematic, modern, and clean.
- Make mobile view responsive.
- Check for layout issues, broken buttons, console errors, and obvious QA problems before final response.

## Progress Notes
Use .Codex/progress/ for task-by-task notes.
For every meaningful task, create or update a progress markdown file.
Each progress file should include:
- What changed
- Why it changed
- Files edited
- How it was tested
- Follow-ups or known issues

## Final Response Format
At the end of each task, respond like this:

Done.

Changed:
- file/path — short explanation

Tested:
- what was checked

Notes:
- any important warning or follow-up

Keep it short.
