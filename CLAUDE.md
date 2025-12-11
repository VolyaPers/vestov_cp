# Claude Code Configuration - Flow Nexus Integration

## 📋 Testing Requirements for Claude Code CLI

**IMPORTANT: Claude Code CLI reads this file (CLAUDE.md), not .cursorrules**

### After Implementing Any Feature:
1. ✅ Feature code implemented and working
2. ✅ Unit tests created (80%+ coverage)
3. ✅ E2E tests created for user-facing features
4. ✅ All tests pass: `npm run test && npm run test:e2e`
5. ✅ Browser tested at http://localhost:5173/
6. ✅ NO TypeScript errors: `npm run build`
7. ✅ NO linting errors: `npm run lint`

### Test Locations
- **Unit Tests**: `src/__tests__/` (React components)
- **Backend Tests**: `server/src/__tests__/` (Node/Express logic)
- **E2E Tests**: `cypress/e2e/` (User workflows)
- **Test Data**: `cypress/fixtures/`

### Test Commands
```bash
npm run test              # Run unit tests (Vitest)
npm run test:watch       # Watch mode for unit tests
npm run test:e2e         # Run Cypress E2E tests
npm run test:coverage    # Generate coverage report
npm run build            # TypeScript compilation (catches type errors)
npm run lint             # Check linting (ESLint)
```

### Mandatory Checklist Before Submitting Code
- [ ] All unit tests written and passing
- [ ] E2E tests written for user-facing features
- [ ] `npm run build` completes without TypeScript errors
- [ ] `npm run lint` passes without warnings
- [ ] `npm run test:e2e` passes
- [ ] Feature tested manually in browser at http://localhost:5173/
- [ ] No console errors in browser DevTools

### Example: Testing a New Feature

If adding a new calendar feature:
1. Create `src/__tests__/pages/VacationPage.test.tsx`
2. Create `server/src/__tests__/routes/vacation.test.ts`
3. Create `cypress/e2e/calendar-vacation.cy.ts`
4. Test:
   - Date selection logic
   - API endpoints
   - User workflows
5. Run all tests:
   ```bash
   npm run test
   npm run test:e2e
   npm run build
   ```

### DO NOT SKIP TESTING
A feature without tests is considered incomplete. Claude Code should refuse to finish a task if tests are missing.

---

## 🌐 Flow Nexus Cloud Platform

Flow Nexus extends Claude Flow with cloud-powered features for AI development and deployment.

### Quick Start
1. **Register**: Use `mcp__flow-nexus__user_register` with email/password
2. **Login**: Use `mcp__flow-nexus__user_login` to access features
3. **Check Balance**: Use `mcp__flow-nexus__check_balance` for credits

### 🚀 Key Capabilities

**🤖 AI Swarms**
- Deploy multi-agent swarms in cloud sandboxes
- Pre-built templates for common architectures
- Auto-scaling and load balancing

**📦 E2B Sandboxes**
- `mcp__flow-nexus__sandbox_create` - Isolated execution environments
- Support for Node.js, Python, React, Next.js
- Real-time code execution with environment variables

**⚡ Workflows**
- `mcp__flow-nexus__workflow_create` - Event-driven automation
- Parallel task processing with message queues
- Reusable workflow templates

**🎯 Challenges & Learning**
- `mcp__flow-nexus__challenges_list` - Coding challenges
- Earn rUv credits by completing tasks
- Global leaderboard and achievements

**🧠 Neural Networks**
- `mcp__flow-nexus__neural_train` - Train custom models
- Distributed training across sandboxes
- Pre-built templates for ML tasks

**💰 Credits & Billing**
- Pay-as-you-go with rUv credits
- Auto-refill configuration available
- Free tier for getting started

### 🤖 Flow Nexus Agents

Specialized agents for Flow Nexus operations available in `.claude/agents/flow-nexus/`:

- **flow-nexus-auth**: Authentication and user management
- **flow-nexus-sandbox**: E2B sandbox deployment and management  
- **flow-nexus-swarm**: AI swarm orchestration and scaling
- **flow-nexus-workflow**: Event-driven workflow automation
- **flow-nexus-neural**: Neural network training and deployment
- **flow-nexus-challenges**: Coding challenges and gamification
- **flow-nexus-app-store**: Application marketplace management
- **flow-nexus-payments**: Credit management and billing
- **flow-nexus-user-tools**: User management and system utilities

### 📁 Flow Nexus Commands

Detailed Flow Nexus command documentation available in `.claude/commands/flow-nexus/`:

- `login-registration.md` - Authentication workflows
- `sandbox.md` - E2B sandbox management
- `swarm.md` - AI swarm deployment
- `workflow.md` - Automation workflows
- `neural-network.md` - ML model training
- `challenges.md` - Coding challenges
- `app-store.md` - App marketplace
- `payments.md` - Credit and billing
- `user-tools.md` - User utilities

### 💡 Example: Deploy a Swarm
```javascript
// 1. Login to Flow Nexus
mcp__flow-nexus__user_login({ 
  email: "user@example.com", 
  password: "password" 
})

// 2. Initialize swarm
mcp__flow-nexus__swarm_init({ 
  topology: "mesh", 
  maxAgents: 5 
})

// 3. Create sandbox
mcp__flow-nexus__sandbox_create({ 
  template: "node", 
  name: "api-dev" 
})

// 4. Orchestrate task
mcp__flow-nexus__task_orchestrate({
  task: "Build REST API with authentication",
  strategy: "parallel"
})
```

### 🔗 Integration with Claude Code

Flow Nexus seamlessly integrates with Claude Code through MCP (Model Context Protocol):

1. **Add MCP Server**: `claude mcp add flow-nexus npx flow-nexus@latest mcp start`
2. **Use in Claude Code**: Access all Flow Nexus tools through MCP interface
3. **Agent Coordination**: Use Flow Nexus agents for specialized cloud operations
4. **Command Reference**: Use slash commands for quick Flow Nexus operations

### 📚 Learn More

- Documentation: https://github.com/ruvnet/claude-flow#flow-nexus
- MCP Integration: Use `mcp__flow-nexus__*` tools in Claude Code
- Agent Usage: Type `/` in Claude Code to see Flow Nexus commands
- Community: Join discussions and share templates

---

**Ready to build with Flow Nexus? Start with authentication and explore the cloud-powered AI development platform!**
