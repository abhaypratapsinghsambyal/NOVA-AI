// geminiService.js - Handles Gemini API calls with memory integration
import { getMemoryContext, addUserMessage, addAIResponse, extractUserInfo } from './memory';

const GEMINI_API_KEY = 'AIzaSyBb0oyTl-uef9Cg0PgIENdg6xWhcIyffD0'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function callGeminiAPI(userMessage, imageData = null) {
  try {
    console.log('Calling Gemini API with message:', userMessage);
    
    // Add user message to memory
    await addUserMessage(userMessage);
    
    // Extract user info from message
    await extractUserInfo(userMessage);
    
    // Get memory context
    const memoryContext = getMemoryContext();
    
    // Prepare the request body
        const parts = [{ text: userMessage }];

        // Add image data part if provided and valid
        if (imageData && imageData.mimeType && imageData.data) {
            parts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                }
            });
        }

        const requestBody = {
            contents: [
                ...memoryContext, // Include previous conversational turns
                {
                    parts: parts,
                    role: 'user' // Current user turn
                }
            ]
        };
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not process that request.';
    
    // Add AI response to memory
    await addAIResponse(aiResponse);
    
    console.log('Gemini API response:', aiResponse);
    return { aiResponse };
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    const fallbackResponse = 'Sorry, I encountered an error processing your request.';
    await addAIResponse(fallbackResponse);
    return { aiResponse: fallbackResponse };
  }
}