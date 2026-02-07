import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

export type GrokMessage = ChatCompletionMessageParam;

export interface GrokTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface GrokToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// NOTE: Built-in search tools (web_search, x_search, live_search) are NOT supported
// on the OpenAI-compatible /v1/chat/completions endpoint. They only work with the
// native xAI SDK (gRPC-based). Only function tools (type: "function") work here.

export interface GrokResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: GrokToolCall[];
    };
    finish_reason: string;
  }>;
}

export class GrokClient {
  private client: OpenAI;
  private currentModel: string = "grok-code-fast-1";
  private defaultMaxTokens: number;

  constructor(apiKey: string, model?: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      timeout: 360000,
    });
    const envMax = Number(process.env.GROK_MAX_TOKENS);
    this.defaultMaxTokens = Number.isFinite(envMax) && envMax > 0 ? envMax : 1536;
    if (model) {
      this.currentModel = model;
    }
  }

  setModel(model: string): void {
    this.currentModel = model;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  async chat(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string
  ): Promise<GrokResponse> {
    try {
      const requestPayload: any = {
        model: model || this.currentModel,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.7,
        max_tokens: this.defaultMaxTokens,
      };

      const response =
        await this.client.chat.completions.create(requestPayload);

      return response as GrokResponse;
    } catch (error: any) {
      throw new Error(`Grok API error: ${error.message}`);
    }
  }

  async *chatStream(
    messages: GrokMessage[],
    tools?: GrokTool[],
    model?: string
  ): AsyncGenerator<any, void, unknown> {
    try {
      const requestPayload: any = {
        model: model || this.currentModel,
        messages,
        tools: tools || [],
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        temperature: 0.7,
        max_tokens: this.defaultMaxTokens,
        stream: true,
      };

      const stream = (await this.client.chat.completions.create(
        requestPayload
      )) as any;

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      throw new Error(`Grok API error: ${error.message}`);
    }
  }

}
