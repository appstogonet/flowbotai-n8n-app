import type {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties
} from 'n8n-workflow';

// Central configuration - modify this URL as needed
export const FLOWBOT_API_BASE_URL = 'https://flowbot.api.appstogo.net';

export class FlowbotApi implements ICredentialType {
    name = 'flowbotApi';
    displayName = 'Flowbot';
    documentationUrl = '';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            required: true,
        },
    ];
    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                'X-Api-Key': '={{$credentials.apiKey}}',
                'Flowbot-SourceIntegrationType': 'N8n',
            },
        },
    };
    test: ICredentialTestRequest = {
        request: {
            baseURL: FLOWBOT_API_BASE_URL,
            url: '/get-agents',
        },
    };
}