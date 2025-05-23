// geminiService.js - Handles Gemini API calls with memory integration
import { getMemoryContext, addUserMessage, addAIResponse, extractUserInfo } from './memory';

const GEMINI_API_KEY = 'AIzaSyDHtaZOBJNJhJJJhJJJhJJJhJJJhJJJhJJ'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
    const requestBody = {
      contents: [{
        role: 'user', // Explicitly set role for the user turn
        parts: []
      }]
    };
    
    // Add user message part
    requestBody.contents[0].parts.push({
      text: userMessage
    });
    
    // Add image if provided
    if (imageData) {
      const base64Data = imageData.split(',')[1];
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: base64Data
        }
      });
    }
    
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