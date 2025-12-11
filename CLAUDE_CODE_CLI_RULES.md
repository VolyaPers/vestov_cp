# Claude Code CLI - Testing Rules

## 🎯 Quick Answer

**Claude Code CLI reads `CLAUDE.md`, NOT `.cursorrules`**

- `.cursorrules` = **Cursor Chat** only
- `CLAUDE.md` = **Claude Code CLI** + other Claude tools
- Both files are now configured in your project ✅

## 📋 How Claude Code CLI Finds Instructions

When you run `claude` from CLI in this directory:
1. ✅ Reads `CLAUDE.md` (project root)
2. ✅ Reads `package.json` scripts
3. ✅ Reads project structure automatically
4. ❌ Does NOT read `.cursorrules`

## 🚀 Using Claude Code CLI

```bash
# Example usage
claude "Add a new dashboard feature with tests"

# Claude Code will:
# 1. Read CLAUDE.md for project rules (including testing requirements)
# 2. Implement the feature
# 3. MUST create unit tests
# 4. MUST create E2E tests
# 5. Run: npm run test && npm run test:e2e
# 6. Verify: npm run build (no TS errors)
```

## 📁 File Organization

```
Vestov CP/
├── .cursorrules          ← For Cursor Chat ONLY
├── CLAUDE.md             ← For Claude Code CLI + other Claude tools ⭐
├── package.json          ← Script definitions (used by both)
├── src/__tests__/        ← Unit tests location
├── server/src/__tests__/ ← Backend tests location
└── cypress/e2e/          ← E2E tests location
```

## ✅ What's Configured

Your `CLAUDE.md` now includes:
- Mandatory testing requirements
- Test file locations
- Command list (test, build, lint)
- Checklist before submitting code
- Example feature testing workflow

## 💡 Key Insight

**Claude Code CLI is "self-policing"** when you:
1. Define rules in `CLAUDE.md`
2. Include a checklist it must follow
3. Make clear: "DO NOT skip testing"

Claude Code will see these instructions and follow them automatically!

## 🔄 Workflow Example

```bash
# 1. Start a feature
claude "Implement export PDF functionality"

# 2. Claude Code reads CLAUDE.md and sees:
#    - Must create unit tests
#    - Must create E2E tests
#    - Must pass: npm run test && npm run test:e2e
#    - Must pass: npm run build

# 3. Claude Code implements it WITH tests included
# 4. Runs verification commands
# 5. Reports: "Feature complete ✅ All tests passing"
```

---

**Bottom Line**: You now have testing rules that Claude Code CLI will follow! 🎉
