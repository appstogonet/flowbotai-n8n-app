import { INodeType, INodeTypeDescription, IExecuteFunctions } from 'n8n-workflow';
import { FLOWBOT_API_BASE_URL } from '../../credentials/FlowbotApi.credentials';

export class StopTypingSoundAction implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Stop Typing Sound',
    name: 'stopTypingSound',
    group: ['transform'],
    version: 1,
    description: 'Stop the typing sound for the agent during an active call.',
    defaults: { name: 'Stop Typing Sound' },
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
        description: 'Call ID value from your trigger output.',
      },
    ],
  };

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const returnData = [];

    for (let i = 0; i < items.length; i++) {
      const callId = this.getNodeParameter('call_id', i) as string;
      const credentials = await this.getCredentials('flowbotApi');
      const baseUrl = FLOWBOT_API_BASE_URL.endsWith('/')
        ? FLOWBOT_API_BASE_URL
        : FLOWBOT_API_BASE_URL + '/';

      const response = await this.helpers.request({
        method: 'POST',
        url: `${baseUrl}actions/stop_typing_sound`,
        headers: {
          'X-API-KEY': credentials?.apiKey,
          Accept: 'application/json',
          'Flowbot-SourceIntegrationType': 'N8n',
        },
        body: { call_id: callId },
        json: true,
      });
      returnData.push({ json: { success: true, call_id: callId, response } });
    }
    return [returnData];
  }
}