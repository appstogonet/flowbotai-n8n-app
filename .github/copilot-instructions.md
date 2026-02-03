# Copilot Instructions for n8n-nodes-flowbotai

## Project Overview
This is an **n8n community package** that provides FlowbotAI integration nodes for the n8n automation platform. It enables users to receive webhook events from FlowbotAI and interact with the FlowbotAI API within n8n workflows.

## Architecture & Key Components

### Node Structure
- **Credentials**: [credentials/FlowbotApi.credentials.ts](credentials/FlowbotApi.credentials.ts) - Defines the `flowbotApi` credential with API key authentication
- **Triggers**: Webhook-based nodes in `nodes/*/Trigger/` that subscribe to FlowbotAI events
- **Actions**: Regular nodes for API operations (e.g., [SendAgentResponseAction](nodes/SendAgentResponseAction/SendAgentResponseAction.node.ts))
- **Shared Client**: [shared/FlowbotClient.ts](shared/FlowbotClient.ts) - Centralized HTTP client handling authentication and API requests

### Webhook Lifecycle (Critical Pattern)
All trigger nodes follow this pattern (see [CreateTicketTrigger.node.ts](nodes/CreateTicketTrigger/CreateTicketTrigger.node.ts)):
1. **checkExists**: Returns `true` if `staticData.webhookId` exists
2. **create**: Calls `/subscribe` endpoint with `hookUrl`, `agentId`, `toolName`, stores returned `id` in `staticData.webhookId`
3. **webhook**: Verifies `Integration-Header` via `/verify-hook` endpoint with `Flowbot-WebhookSecret` and `Flowbot-SubscriptionId` headers
4. **delete**: Calls `/unsubscribe` with stored webhook ID, cleans up `staticData.webhookId`

**Manual mode**: In manual mode, triggers call `/sample-perform/n8n` to preview sample data without creating actual subscriptions.

### API Client Pattern
- All API calls use `FlowbotClient` class (never direct `httpRequest`)
- Client automatically adds headers: `X-API-KEY`, `Flowbot-SourceIntegrationType: N8n`, `Accept: application/json`
- Base URL configured in [credentials/FlowbotApi.credentials.ts](credentials/FlowbotApi.credentials.ts) as `FLOWBOT_API_BASE_URL`
- Static helper: `FlowbotClient.getAgents()` used in `loadOptionsMethod` for agent dropdowns

### Entry Point & Exports
- [index.ts](index.ts) exports all nodes and credentials for n8n to discover
- Hidden nodes (commented out) are still in the codebase but not exported: StartTypingSoundAction, StopTypingSoundAction, CallTransferAction

## Development Workflow

### Building & Testing
```bash
npm run build          # Compiles TypeScript to dist/
npm test              # Runs Jest tests (*.test.ts files)
npm run lint          # ESLint with n8n-nodes-base plugin
```

### Package Structure (package.json)
- `n8n` field declares credentials and nodes arrays pointing to `dist/` compiled files
- `files` array includes source directories (nodes/, shared/, credentials/) for npm publish
- Community node packages use `n8nNodesApiVersion: 1`

### Testing n8n Nodes
- Use `npx @n8n/scan-community-package n8n-nodes-flowbotai` to validate package compliance
- Test nodes in n8n: Install locally with `npm link` or install from npm registry

## Coding Conventions

### Node Descriptors
- Set `group: ['trigger']` for webhook triggers, `group: ['transform']` for actions
- Use `webhooks` array with `responseMode: 'onReceived'` for trigger nodes
- Set `credentials: [{ name: 'flowbotApi', required: true }]` for all nodes requiring authentication

### Parameter Handling
```typescript
// Multi-select agents using loadOptions
{
  displayName: 'Agent(s)',
  name: 'flowbot_agent',
  type: 'multiOptions',
  typeOptions: { loadOptionsMethod: 'getAgents' },
  default: [],
}
```

### Static Data Pattern
Webhook triggers store state in workflow static data:
```typescript
const staticData = this.getWorkflowStaticData('node');
staticData.webhookId = response.id; // Store subscription ID
```

### Error Handling
- FlowbotClient normalizes errors to `Error` objects with messages
- Trigger delete operations silently handle errors (subscriptions may already be deleted)

## Integration Points

### FlowbotAI Backend API
- **Base URL**: https://flowbot.api.appstogo.net
- **Authentication**: `X-API-KEY` header
- **Key Endpoints**:
  - `GET /get-agents` - List available agents
  - `POST /subscribe` - Create webhook subscription
  - `POST /unsubscribe` - Remove webhook subscription  
  - `GET /verify-hook` - Verify webhook authenticity
  - `POST /send_agent_response` - Send message to agent
  - `POST /sample-perform/n8n` - Preview trigger data in manual mode

### n8n Framework
- Implements `INodeType` interface for all nodes
- Uses n8n's `IExecuteFunctions`, `IWebhookFunctions`, `IHookFunctions` context types
- Relies on `helpers.httpRequest()` for all HTTP operations (via FlowbotClient)

## Notes
- TypeScript target is ES2020 with CommonJS modules
- Test environment uses Jest with ts-jest preset
- Node.js 18+ required (specified in package.json engines)
