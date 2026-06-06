/**
 * AI Summary Service
 * Generates AI-powered summaries of news articles
 */

import axios from 'axios';
import { API_KEYS } from '../config/apiKeys';

class SummaryService {
  // Generate AI summary from article content
  async generateSummary(title: string, summary: string, url?: string): Promise<string> {
    // For now, create an enhanced summary from the existing data
    // In the future, you can integrate with OpenAI, Anthropic, or other AI services
    
    // Enhanced summary - takes the existing summary and formats it better
    let enhancedSummary = summary;
    
    // If summary is too short, expand it with context from title
    if (enhancedSummary.length < 200) {
      enhancedSummary = `${title}. ${enhancedSummary} This development has significant implications for the market and investors should pay close attention to how this unfolds in the coming days.`;
    }
    
    // Format as a proper paragraph
    enhancedSummary = enhancedSummary
      .replace(/\s+/g, ' ') // Clean up whitespace
      .trim();
    
    // Ensure it ends with proper punctuation
    if (!enhancedSummary.match(/[.!?]$/)) {
      enhancedSummary += '.';
    }
    
    return enhancedSummary;
  }

  // Future: Integrate with OpenAI or other AI service
  // async generateAISummary(title: string, content: string): Promise<string> {
  //   const response = await axios.post('https://api.openai.com/v1/chat/completions', {
  //     model: 'gpt-3.5-turbo',
  //     messages: [
  //       { role: 'system', content: 'You are a financial news summarizer. Create a concise, informative summary.' },
  //       { role: 'user', content: `Summarize this article: ${title}\n\n${content}` }
  //     ],
  //     max_tokens: 200
  //   }, {
  //     headers: {
  //       'Authorization': `Bearer ${API_KEYS.OPENAI_API_KEY}`,
  //       'Content-Type': 'application/json'
  //     }
  //   });
  //   
  //   return response.data.choices[0].message.content;
  // }
}

export const summaryService = new SummaryService();
export default summaryService;





