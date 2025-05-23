// openRouterService.js - Handles Mistral API calls through OpenRouter
import { getMemoryContext, addUserMessage, addAIResponse, extractUserInfo } from './memory';

const OPENROUTER_API_KEY = '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'; // Ensure this is your actual, correct API key
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function streamChatResponse(userMessage, onChunk) {
  try {
    console.log('Calling OpenRouter API with message:', userMessage);
    
    // Add user message to memory
    await addUserMessage(userMessage);
    
    // Extract user info from message
    await extractUserInfo(userMessage);
    
    // Get memory context
    const memoryContext = getMemoryContext();
    
    const requestBody = {
      model: "mistralai/devstral-small:free",
      messages: [
        {
          role: "system",
          content: `You are NOVA, an AI assistant with shared memory. Here's your memory context:\n${memoryContext}\n\nRespond naturally and conversationally. Keep responses concise but helpful.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 500
    };
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'NOVA AI Assistant'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    // Add full response to memory
    if (fullResponse) {
      await addAIResponse(fullResponse);
    }
    
    return fullResponse;
    
  } catch (error) {
    console.error('Error in streamChatResponse:', error);
    throw error;
  }
}
const model = 'mistralai/devstral-small:free'; // Using Mistral: Devstral Small (free)
