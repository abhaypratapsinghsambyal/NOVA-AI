// memory.js - Handles permanent memory using browser storage

const MEMORY_STORAGE_KEY = 'nova_ai_memory';

// Load memory from browser storage
const loadMemory = () => {
  const memory = localStorage.getItem(MEMORY_STORAGE_KEY);
  return memory ? JSON.parse(memory) : { history: [], userInfo: {} };
};

// Save memory to browser storage
const saveMemory = (memory) => {
  localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
};

let currentMemory = loadMemory();

export const getMemoryContext = () => {
  // Format memory history for Gemini API
  const historyText = currentMemory.history.map(entry => `${entry.role}: ${entry.text}`).join('\n');
  const userInfoText = Object.entries(currentMemory.userInfo).map(([key, value]) => `${key}: ${value}`).join(', ');
  
  return `Past conversation history:\n${historyText}\n\nUser Information: ${userInfoText}\n\n`;
};

export const addUserMessage = (message) => {
  currentMemory.history.push({ role: 'user', text: message });
  saveMemory(currentMemory);
};

export const addAIResponse = (response) => {
  currentMemory.history.push({ role: 'ai', text: response });
  saveMemory(currentMemory);
};

export const extractUserInfo = (message) => {
  // Basic example: extract name if mentioned
  const nameMatch = message.match(/my name is (\w+)/i);
  if (nameMatch && nameMatch[1]) {
    currentMemory.userInfo.name = nameMatch[1];
    saveMemory(currentMemory);
  }
  // Add more sophisticated user info extraction logic here later
};

// Function to clear memory (for testing/debugging)
export const clearMemory = () => {
  currentMemory = { history: [], userInfo: {} };
  saveMemory(currentMemory);
};