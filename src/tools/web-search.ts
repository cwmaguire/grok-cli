import { ToolResult } from '../types/index.js';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  response_time: number;
}

export interface WebSearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
  topic?: 'general' | 'news' | 'finance';
}

export class WebSearchTool {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
  }

  get name(): string {
    return 'web_search';
  }

  get description(): string {
    return 'Search the web for current information using Tavily API';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<ToolResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Web search not available. Set TAVILY_API_KEY environment variable to enable.\n\nGet a free API key at: https://tavily.com'
      };
    }

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Search query is required'
      };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: query.trim(),
          search_depth: options.searchDepth || 'basic',
          max_results: options.maxResults || 5,
          include_answer: options.includeAnswer ?? true,
          topic: options.topic || 'general'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid Tavily API key. Check your TAVILY_API_KEY environment variable.'
          };
        }
        return {
          success: false,
          error: `Tavily API error (${response.status}): ${errorText}`
        };
      }

      const data = await response.json() as TavilyResponse;

      // Format the results for display
      let output = `**Web Search Results for:** "${data.query}"\n`;
      output += `*Response time: ${data.response_time.toFixed(2)}s*\n\n`;

      if (data.answer) {
        output += `## Summary\n${data.answer}\n\n`;
      }

      if (data.results && data.results.length > 0) {
        output += `## Sources\n\n`;
        data.results.forEach((result, index) => {
          output += `### ${index + 1}. ${result.title}\n`;
          output += `**URL:** ${result.url}\n`;
          output += `${result.content}\n\n`;
        });
      } else {
        output += 'No results found.\n';
      }

      return {
        success: true,
        output,
        data: {
          query: data.query,
          answer: data.answer,
          results: data.results,
          responseTime: data.response_time
        }
      };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'Web search timed out. Try a simpler query.'
        };
      }
      return {
        success: false,
        error: `Web search failed: ${error.message}`
      };
    }
  }
}
