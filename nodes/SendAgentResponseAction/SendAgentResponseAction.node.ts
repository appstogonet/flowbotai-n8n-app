import { INodeType, INodeTypeDescription, IExecuteFunctions } from 'n8n-workflow';
import { FLOWBOT_API_BASE_URL } from '../../credentials/FlowbotApi.credentials';

export class SendAgentResponseAction implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Send Agent Response',
        name: 'sendAgentResponse',
        group: ['transform'],
        version: 1,
        description: 'Send a message response back to the agent for a specific call.',
        defaults: { name: 'Send Agent Response' },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [{ name: 'flowbotApi', required: true }],
        properties: [
            {
                displayName: 'Call ID',
                name: 'call_id',
                type: 'string',
                required: true,
                default: '',
                description: 'The Call ID from the trigger. Use the Call ID from the trigger output.',
            },
            {
                displayName: 'Message',
                name: 'message',
                type: 'string',
                required: true,
                default: '',
                description: 'The message to send to the agent.',
                typeOptions: {
                    rows: 4,
                },
            },
        ],
    };

    async execute(this: IExecuteFunctions) {
        const items = this.getInputData();
        const returnData = [];

        for (let i = 0; i < items.length; i++) {
            const callId = this.getNodeParameter('call_id', i) as string;
            const message = this.getNodeParameter('message', i) as string;

            if (!callId) {
                throw new Error('Missing call_id. Please map the Call ID field from your trigger.');
            }

            const credentials = await this.getCredentials('flowbotApi');
            const baseUrl = FLOWBOT_API_BASE_URL.endsWith('/')
                ? FLOWBOT_API_BASE_URL
                : FLOWBOT_API_BASE_URL + '/';

            const response = await this.helpers.request({
                method: 'POST',
                url: `${baseUrl}send_agent_response`,
                headers: {
                    'X-API-KEY': credentials?.apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'Flowbot-SourceIntegrationType': 'N8n',
                },
                body: {
                    message,
                    call_id: callId,
                },
                json: true,
            });

            returnData.push({
                json: {
                    success: true,
                    message,
                    call_id: callId,
                    response,
                },
            });
        }
        return this.prepareOutputData(returnData);
    }
}
