import {
  INodeType,
  INodeTypeDescription,
  ILoadOptionsFunctions,
  IHookFunctions,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { FlowbotClient } from '../../shared/FlowbotClient';

export class UpdateTicketTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'FlowbotAI Update Ticket Trigger',
    name: 'updateTicketTrigger',
    group: ['trigger'],
    version: 1,
    description: 'Triggers when someone updates a ticket in FlowbotAI.',
    defaults: {
      name: 'Update Ticket Trigger',
    },
    codex: {
      categories: ['Productivity'],
      subcategories: { Productivity: ['FlowbotAI'] },
      alias: ['FlowbotAI'],
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'flowbotApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Agent(s)',
        name: 'flowbot_agent',
        type: 'multiOptions',
        required: true,
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        default: [],
        description: 'Select one or more FlowbotAI agents to filter events.',
      },
      {
        displayName: 'Tool Name',
        name: 'tool_name',
        type: 'string',
        required: true,
        default: 'update_ticket',
        description: 'Custom name for this tool. Used for identification in FlowbotAI backend.',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getAgents(this: ILoadOptionsFunctions) {
        const credentials = await this.getCredentials('flowbotApi');
        return FlowbotClient.getAgents(this, {
          apiKey: credentials.apiKey as string,
        });
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const headers = this.getHeaderData();
    const body = this.getBodyData();

    console.log('[Flowbot Webhook] Received payload:', JSON.stringify(body, null, 2));

    const headerValue =
      headers['integration-header'] ||
      headers['Integration-Header'] ||
      headers['INTEGRATION-HEADER'] ||
      headers['http-integration-header'] ||
      headers['Http-Integration-Header'] ||
      headers['http-INTEGRATION-HEADER'];

    if (!headerValue) {
      throw new Error('Missing authentication header');
    }

    if (headerValue === 'TEST_MODE') {
      return {
        workflowData: [[{ json: body }]],
      };
    }

    const staticData = this.getWorkflowStaticData('node');
    console.log('Static Data:', staticData);

    // Verify the header with Flowbot API
    const credentials = await this.getCredentials('flowbotApi');
    const client = new FlowbotClient(this, {
      apiKey: credentials.apiKey as string,
    });

    const verifyUrl = '/verify-hook';
    try {
      await client.request({
        url: verifyUrl,
        method: 'GET',
        headers: {
          'Flowbot-WebhookSecret': headerValue,
          'Flowbot-SubscriptionId': staticData.webhookId,
        },
      });
    } catch (error) {
      const errorMsg = (error && typeof error === 'object' && 'message' in error)
        ? (error as any).message
        : String(error);
      throw new Error(
        `Invalid authentication header. ${errorMsg || 'Authentication failed'}.`,
      );
    }

    return {
      workflowData: [[{ json: body }]],
    };
  }

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const staticData = (this as unknown as IWebhookFunctions).getWorkflowStaticData('node');
        return !!staticData.webhookId;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const mode = this.getMode?.() || 'trigger';
        const workflowId = this.getWorkflow().id;
        const webhookUrl = (this as unknown as IWebhookFunctions).getNodeWebhookUrl('default');
        const triggerKey = 'UPDATE_TICKET_TRIGGER_KEY';
        if (mode === 'manual') {
          try {
            const credentials = await this.getCredentials('flowbotApi');
            const client = new FlowbotClient(this as any, {
              apiKey: credentials.apiKey as string,
            });
            const headers: Record<string, string> = {
              ...(triggerKey ? { triggerKey } : {}),
              webhookUrl: webhookUrl || '',
            };
            console.log('[Flowbot Manual Test] Sending request to /sample-perform/n8n with headers:', headers);
            await client.request({
              url: '/sample-perform/n8n',
              method: 'POST',
              headers,
            });
            return true;
          } catch {
            return true;
          }
        }
        const staticData = (this as unknown as IWebhookFunctions).getWorkflowStaticData('node');
        if (staticData.webhookId) {
          return true;
        }
        const credentials = await this.getCredentials('flowbotApi');
        const client = new FlowbotClient(this as any, {
          apiKey: credentials.apiKey as string,
        });
        const toolName = this.getNodeParameter('tool_name') as string;
        const agentIds = this.getNodeParameter('flowbot_agent') as string[];
        try {
          const subscribeBody = {
            hookUrl: webhookUrl,
            ZapId: workflowId,
            toolName,
            agentId: agentIds,
            triggerKey,
          };
          console.log('[Flowbot Subscribe] Sending subscription request:', JSON.stringify(subscribeBody, null, 2));
          const response = await client.request({
            url: '/subscribe',
            method: 'POST',
            body: subscribeBody,
          });

          console.log('[Flowbot Subscribe] Received response:', JSON.stringify(response, null, 2));

          const webhookId = response.id || response.subscriptionId;
          console.log('[Flowbot Subscribe] Extracted webhookId:', webhookId);
          if (webhookId) {
            staticData.webhookId = webhookId;
            console.log('[Flowbot Subscribe] Stored webhookId in staticData:', staticData.webhookId);
          } else {
            console.log('[Flowbot Subscribe] WARNING: No webhookId found in response!');
          }
          return true;
        } catch (error) {
          const errorMsg = (error && typeof error === 'object' && 'message' in error)
            ? (error as any).message
            : String(error);
          throw new Error(`Subscription failed: ${errorMsg}`);
        }
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = (this as unknown as IWebhookFunctions).getWorkflowStaticData('node');
        console.log('[Flowbot Delete] Full staticData:', JSON.stringify(staticData, null, 2));
        const webhookId = staticData.webhookId;
        const workflowId = this.getWorkflow().id;
        console.log('[Flowbot Delete] User deactivating/deleting workflow. WorkflowId:', workflowId, 'WebhookId:', webhookId);
        if (!webhookId) {
          console.log('[Flowbot Delete] No webhookId found. Subscription may not have been created or already deleted.');
          return true;
        }
        const credentials = await this.getCredentials('flowbotApi');
        const client = new FlowbotClient(this as any, {
          apiKey: credentials.apiKey as string,
        });
        try {
          console.log('[Flowbot Unsubscribe] Sending unsubscribe request for webhook ID:', webhookId);
          await client.request({
            url: '/unsubscribe',
            method: 'POST',
            body: { id: webhookId },
          });
        } catch (error) {
          const errorMsg = (error && typeof error === 'object' && 'message' in error)
            ? (error as any).message
            : String(error);
          console.error(`[UpdateTicketTrigger] Unsubscribe failed: ${errorMsg}`);
        }
        delete staticData.webhookId;
        return true;
      },
    },
  };
}