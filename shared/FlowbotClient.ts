import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  IHttpRequestOptions,
  NodeApiError,
  INode,
} from 'n8n-workflow';
import { FLOWBOT_API_BASE_URL } from '../credentials/FlowbotApi.credentials';

type RequestCapable = IExecuteFunctions | ILoadOptionsFunctions | any;

export class FlowbotClient {
  private readonly baseUrl: string;
  private readonly sourceType: string = 'N8n';

  constructor(
    private readonly ctx: RequestCapable,
    private readonly credentials: { apiKey: string; baseUrl?: string },
  ) {
    const url = credentials.baseUrl || FLOWBOT_API_BASE_URL;
    this.baseUrl = url.endsWith('/') ? url : url + '/';
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-API-KEY': this.credentials.apiKey,
      'Flowbot-SourceIntegrationType': this.sourceType,
      Accept: 'application/json',
    };
  }

  async request<T = any>(options: Partial<IHttpRequestOptions> & { url?: string }): Promise<T> {
    const relative = (options.url ?? '').replace(/^\//, '');
    const url = options.url?.startsWith('http') ? options.url! : `${this.baseUrl}${relative}`;

    const opts: IHttpRequestOptions = {
      ...(options as IHttpRequestOptions),
      url,
      headers: {
        ...this.getHeaders(),
        ...(options.headers ?? {}),
      },
      json: true,
    };

    try {
      return await this.ctx.helpers.httpRequest!(opts);
    } catch (error: any) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: any): NodeApiError {
    const message = error?.error?.message || error?.message || 'Unknown error';
    const node: INode = this.ctx.getNode?.() || { 
      name: 'FlowbotClient', 
      type: 'n8n-nodes-flowbotai.flowbotClient', 
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    };
    return new NodeApiError(node, error, { message });
  }

  static async getAgents(helpers: ILoadOptionsFunctions, credentials: { apiKey: string; baseUrl?: string }) {
    const client = new FlowbotClient(helpers, credentials);
    const agents = await client.request<{ id: string; name: string }[]>({
      url: '/get-agents',
      method: 'GET',
    });
    return agents.map((a) => ({ name: a.name, value: a.id }));
  }
}