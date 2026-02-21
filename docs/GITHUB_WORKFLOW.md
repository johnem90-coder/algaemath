# GitHub Workflow Guide

Complete guide for using GitHub to manage AlgaeMath development.

---

## Overview

**Current Situation:** You're comfortable with VSCode + Copilot + Claude, but new to GitHub collaboration workflows.

**Goal:** Use GitHub to:
- Track progress
- Enable collaboration (now or later)
- Maintain history
- Deploy automatically

---

## Initial Setup (One Time)

### 1. Create GitHub Repository

**Option A: Via GitHub Website**
1. Go to https://github.com
2. Click "New repository"
3. Name: `algaemath`
4. Description: "Interactive educational platform for photobioreactor modeling"
5. Make it **Public** (or Private if you prefer)
6. Check "Add a README file"
7. Add `.gitignore` template: **Node**
8. Click "Create repository"

**Option B: Via Command Line (after local project exists)**
```bash
cd algaemath
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/algaemath.git
git push -u origin main
```

---

### 2. Clone to Your Computer (if created on GitHub first)

```bash
cd ~/Projects  # or wherever you keep projects
git clone https://github.com/YOUR_USERNAME/algaemath.git
cd algaemath
```

---

### 3. Set Up Next.js Project

```bash
npx create-next-app@latest . --typescript --tailwind --app
# Answer prompts (use recommended defaults)

# Install dependencies (from QUICK_START.md)
npm install recharts katex @types/katex
# ... etc

# Test it works
npm run dev
# Open http://localhost:3000
```

---

### 4. Initial Commit

```bash
git add .
git commit -m "chore: initialize Next.js project with dependencies"
git push origin main
```

---

## Branch Strategy (Simple)

You'll use a simple two-branch strategy:

```
main
  -- Always deployable, production-ready code

feature/[page-name]
  -- Work in progress for specific page
```

**No `develop` branch needed** when working solo. Keep it simple!

---

## Workflow for Building Each Page

### Phase 1: Plan in Claude Project

**In Claude Project chat:**
```
You: "I want to build the Core Concepts page. Help me plan:
1. Component structure
2. Data flow
3. What models I need to create first"

Claude: [provides architecture advice]

You: "Okay, I'll start with just the Light Response Explorer.
Give me the step-by-step plan."

Claude: [provides detailed steps]
```

**No git commands during planning phase!**

---

### Phase 2: Create Feature Branch

**Back in VSCode terminal:**

```bash
# Make sure you're starting from main
git checkout main
git pull origin main  # Get latest changes (important if collaborating)

# Create new branch for this page
git checkout -b feature/light-response-explorer

# You're now on the feature branch
# All your work will be isolated here
```

**Branch naming convention:**
- `feature/[component-name]` - New feature
- `fix/[bug-description]` - Bug fix
- `refactor/[what-changed]` - Code improvement
- `docs/[what-changed]` - Documentation only

**Examples:**
- `feature/light-response-explorer`
- `feature/core-concepts-page`
- `fix/chart-rendering-bug`
- `refactor/model-registry-types`

---

### Phase 3: Build in VSCode

**Now you code!**

```bash
# Create files as planned
mkdir -p app/core-concepts/components
touch app/core-concepts/components/LightResponseExplorer.tsx

# Open in VSCode
code app/core-concepts/components/LightResponseExplorer.tsx

# Use Copilot to help write code
# Test frequently: npm run dev
```

---

### Phase 4: Commit Frequently (Every 30-60 Minutes)

**Why commit often?**
- Save checkpoints (can go back if you break something)
- Track what you did
- Smaller, understandable changes

**When to commit:**
- Component structure complete (even if empty)
- Working feature (even if not perfect)
- Before trying something risky
- Before taking a break
- When you reach a natural stopping point

**How to commit:**

```bash
# See what changed
git status

# See detailed changes
git diff

# Add specific files
git add app/core-concepts/components/LightResponseExplorer.tsx

# Or add everything (be careful!)
git add .

# Commit with descriptive message
git commit -m "feat: add light response explorer component"
```

---

### Commit Message Convention

Format: `type: description`

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code improvement (no behavior change)
- `style:` - Formatting, whitespace
- `docs:` - Documentation only
- `test:` - Adding tests
- `chore:` - Maintenance (dependencies, config)

**Examples:**
```bash
git commit -m "feat: add light response explorer component"
git commit -m "feat: implement model selector dropdown"
git commit -m "fix: chart not updating when slider moves"
git commit -m "refactor: extract curve generation to utility function"
git commit -m "style: format code with prettier"
git commit -m "docs: add component usage examples"
git commit -m "chore: upgrade recharts to v2.10"
```

**Good messages:**
- Describe WHAT changed
- Use present tense ("add" not "added")
- Be specific

**Bad messages:**
- "wip" (work in progress - says nothing)
- "fix bug" (which bug?)
- "update files" (which files? why?)

---

### Phase 5: Push to GitHub (End of Work Session)

**When to push:**
- End of work session
- Before switching tasks
- When feature is working (even if incomplete)
- At least once per day if actively working

**How to push:**

```bash
# Push your branch to GitHub
git push origin feature/light-response-explorer

# First time pushing this branch? Git will tell you to set upstream:
git push --set-upstream origin feature/light-response-explorer

# After that, just:
git push
```

**What happens:**
- Your code backs up to GitHub
- Others can see your progress (if collaborating)
- You can continue on another computer
- GitHub shows your branch in the web interface

---

### Phase 6: Create Pull Request (When Feature Complete)

**When the component/page is done:**

1. **Go to GitHub website**
2. Navigate to your repository
3. You'll see: "feature/light-response-explorer had recent pushes"
4. Click **"Compare & pull request"**

5. **Fill in PR template:**

```markdown
## What does this PR do?
Adds the Light Response Explorer component to the Core Concepts page.
Users can move a slider to see how light intensity affects growth rate.

## Type of Change
- [x] New feature (Core Concepts - Light Response Explorer)
- [ ] Bug fix
- [ ] Refactoring

## Testing
- [x] Component renders without errors
- [x] Slider updates chart in real-time
- [x] Calculates correct growth factor values
- [x] Responsive on mobile/tablet/desktop

## Screenshots
[Attach screenshot of the component]

## Notes
- Uses Banerjee model with default parameters
- Next step: add model selector dropdown
```

6. Click **"Create pull request"**

---

### Phase 7A: Solo Workflow - Merge Immediately

**If working alone:**

1. Review your own changes (good habit!)
2. Click **"Merge pull request"**
3. Click **"Confirm merge"**
4. Click **"Delete branch"** (keeps repo clean)

```bash
# Back in VSCode terminal:
git checkout main
git pull origin main  # Get the merged changes
git branch -d feature/light-response-explorer  # Delete local branch

# You're back on main with your new feature!
```

---

### Phase 7B: Collaborative Workflow - Wait for Review

**If collaborating:**

1. **Create PR** (same as above)
2. **Notify collaborator:**
   - Tag them in PR: `@collaborator-username can you review?`
   - Or message them: "PR ready for review"

3. **Collaborator reviews:**
   - Looks at code changes
   - Tests locally if needed
   - Leaves comments/suggestions

4. **Address feedback:**

```bash
# Still on your feature branch
# Make requested changes
git add .
git commit -m "fix: address PR feedback - improve parameter validation"
git push

# PR automatically updates!
```

5. **Merge when approved:**
   - Collaborator clicks "Approve"
   - You (or they) click "Merge pull request"
   - Delete branch

6. **Update your local:**

```bash
git checkout main
git pull origin main
git branch -d feature/light-response-explorer
```

---

## Example: Complete Page Workflow

Let's walk through building the Core Concepts page:

### Day 1: Light Response Explorer

```bash
# Morning: Plan in Claude Project
# (no git commands)

# Start coding
git checkout main
git pull origin main
git checkout -b feature/light-response-explorer

# Code for 1 hour
git add .
git commit -m "feat: add light response explorer skeleton"

# Code more, add slider
git add .
git commit -m "feat: add intensity slider with Shadcn UI"

# Code more, add chart
git add .
git commit -m "feat: add recharts visualization"

# End of day
git push origin feature/light-response-explorer

# Create PR, merge (solo), or request review (collaborative)
```

### Day 2: Temperature Response Explorer

```bash
# Start fresh
git checkout main
git pull origin main
git checkout -b feature/temperature-response-explorer

# Build component
# Commit 2-3 times during the day
# Push at end

# Create PR, merge
```

### Day 3: Complete Core Concepts Page

```bash
git checkout main
git pull origin main
git checkout -b feature/core-concepts-page-complete

# Add remaining explorers
# Integrate all components into page
# Add navigation, layout, downloads

# Commit several times
# Push at end
# Create PR, merge
```

**Result:** Core Concepts page complete! Move to next page.

---

## Common Scenarios & Solutions

### Scenario 1: "I broke something, want to go back"

**Option A: Undo last commit (not pushed yet)**
```bash
git reset --soft HEAD~1
# Your changes are back to "uncommitted" state
# Fix the issue, then commit again
```

**Option B: Go back to any previous commit**
```bash
# See commit history
git log --oneline

# Copy the commit hash you want to go back to
git checkout abc1234  # Replace with actual hash

# Look around, test
# When ready to go back to present:
git checkout feature/your-branch-name
```

**Option C: Abandon all changes since last commit**
```bash
git restore .  # Careful! Can't undo this
```

---

### Scenario 2: "I want to see what changed"

```bash
# See which files changed
git status

# See actual code changes (not committed yet)
git diff

# See changes in specific file
git diff app/core-concepts/page.tsx

# See changes in last commit
git show

# See changes in specific commit
git show abc1234
```

---

### Scenario 3: "I forgot to commit before switching branches"

```bash
# Save current work without committing
git stash

# Switch branches
git checkout other-branch

# Later, get your work back
git checkout original-branch
git stash pop
```

---

### Scenario 4: "I need to sync with collaborator's changes"

```bash
# You're on your feature branch
git checkout feature/your-feature

# Get latest from main
git fetch origin main
git merge origin/main

# Or shortcut (does fetch + merge):
git pull origin main

# Resolve any conflicts if needed
```

---

### Scenario 5: "My branch is way behind main"

```bash
git checkout feature/old-branch
git rebase main

# Or safer:
git merge main

# If there are conflicts, git will tell you
# Edit conflicted files, then:
git add .
git rebase --continue  # if rebasing
# or
git merge --continue   # if merging
```

---

## Collaboration Patterns

### Pattern 1: Working on Different Pages (No Conflicts)

**You:** Building Core Concepts page
**Collaborator:** Building Models page

**Workflow:**
1. Both create feature branches from main
2. Work independently
3. Push and create PRs
4. Review each other's PRs
5. Merge when approved
6. Both pull main to stay synced

**No conflicts!**

---

### Pattern 2: Working on Same Page (Potential Conflicts)

**You:** Adding Light Response Explorer
**Collaborator:** Adding Temperature Response Explorer

**Workflow:**
1. Communicate: "I'm working on Light Response"
2. They work on different component file
3. You both edit `page.tsx` to import your components
4. Whoever merges first is easy
5. Second person gets merge conflict in `page.tsx`

**Resolving conflict:**
```tsx
// page.tsx will look like:
import { LightResponseExplorer } from './components/LightResponseExplorer'
<<<<<<< HEAD
import { TemperatureResponseExplorer } from './components/TemperatureResponseExplorer'
=======
// Your version or their version here
>>>>>>> main

// Fix it to include both:
import { LightResponseExplorer } from './components/LightResponseExplorer'
import { TemperatureResponseExplorer } from './components/TemperatureResponseExplorer'

// Then:
git add app/core-concepts/page.tsx
git commit -m "merge: resolve conflict in page imports"
git push
```

---

### Pattern 3: Reviewing Code

**As the reviewer:**

1. **Look at the PR on GitHub**
   - Click "Files changed" tab
   - Review code line by line

2. **Leave comments:**
   - Click line number
   - Click "+" icon
   - Write comment: "Should this be `const` instead of `let`?"
   - Click "Start a review"

3. **Test locally (optional but good):**
```bash
git fetch origin
git checkout feature/their-branch-name
npm run dev
# Test the feature
# If good:
git checkout main
```

4. **Approve or Request Changes:**
   - Click "Review changes"
   - Select "Approve" or "Request changes"
   - Submit review

---

## GitHub Issues (Task Tracking)

### Creating Issues

**When to create an issue:**
- New page to build
- Bug discovered
- Feature idea
- Question/discussion

**How to create:**
1. Go to repository on GitHub
2. Click "Issues" tab
3. Click "New issue"

**Example:**

```markdown
Title: Build Temperature Response Explorer component

Labels: feature, core-concepts

Description:
Create the Temperature Response Explorer component for the Core Concepts page.

## Requirements
- [ ] Interactive slider (10-45C)
- [ ] Response curve chart
- [ ] Model selector (Marsullo, James, Arrhenius)
- [ ] Show current temperature + growth factor
- [ ] Visual zones: suboptimal/optimal/lethal

## Models Needed
- lib/models/temperature/marsullo.ts
- lib/models/temperature/james.ts
- lib/models/temperature/arrhenius.ts

## Related
- Depends on: #1 (Light Response Explorer - for pattern)
- Part of: #5 (Complete Core Concepts page)

Assigned to: @yourself
```

---

### Issue Labels

Create these labels:
- `feature` - New functionality
- `bug` - Something broken
- `docs` - Documentation
- `question` - Discussion
- `core-concepts` - Related to Core Concepts page
- `simulators` - Related to simulators
- `good-first-issue` - Easy for new contributors

---

### Linking PRs to Issues

In your PR description:
```markdown
Closes #12
```

When PR merges, issue #12 automatically closes!

---

## .gitignore Configuration

Make sure your `.gitignore` includes:

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/
build/
dist/

# Environment variables
.env
.env.local
.env*.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Temporary
*.tmp
temp/
```

---

## Quick Reference Commands

```bash
# Daily workflow
git checkout main
git pull origin main
git checkout -b feature/my-feature
# ... work ...
git add .
git commit -m "feat: description"
git push origin feature/my-feature

# Syncing
git checkout main
git pull origin main

# Checking status
git status
git log --oneline
git diff

# Undoing
git restore .  # Discard uncommitted changes
git reset --soft HEAD~1  # Undo last commit

# Branching
git branch  # List branches
git branch -d feature/old-branch  # Delete branch
git checkout -b feature/new-branch  # Create and switch

# Stashing
git stash  # Save current work
git stash pop  # Restore saved work
```

---

## When to Commit, Push, and PR

### Commit (Save Checkpoint)
- Every 30-60 minutes while coding
- After completing a sub-task
- Before trying something experimental
- Before taking a break

### Push (Backup to GitHub)
- End of each work session
- Before switching computers
- At least once per day
- After significant progress

### Pull Request (Request to Merge)
- Feature is complete and tested
- Ready for review (if collaborating)
- Ready to deploy to production

---

## Summary: Your Daily Git Routine

**Morning:**
```bash
git checkout main
git pull origin main
git checkout -b feature/todays-work
```

**During work:**
```bash
# Every hour or so:
git add .
git commit -m "feat: progress on X"
```

**End of day:**
```bash
git push origin feature/todays-work
# Create PR if feature complete
# Or continue tomorrow
```

**Next day:**
```bash
git checkout feature/todays-work
git pull origin main  # Get any changes
# Continue working
```

**When complete:**
```bash
# Create PR on GitHub
# Review and merge
git checkout main
git pull origin main
git branch -d feature/todays-work
```

---

You're ready to use GitHub effectively! Start with the solo workflow, and the collaborative workflow will feel natural when you're ready to add a collaborator.
