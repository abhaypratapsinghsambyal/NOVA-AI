// memory.js - Handles permanent memory using browser storage with shared memory support
import { getCurrentUser, getPartner } from './auth';
import { cloudStorage } from './cloudStorage';

const MEMORY_STORAGE_KEY = 'nova_ai_memory';
const SHARED_MEMORY_KEY = 'nova_shared_memory';
const LAST_SYNC_KEY = 'nova_last_sync';

// Load memory from browser storage
const loadMemory = () => {
  const memory = localStorage.getItem(MEMORY_STORAGE_KEY);
  return memory ? JSON.parse(memory) : { history: [], userInfo: {} };
};

// Load shared memory from browser storage
const loadSharedMemory = () => {
  const memory = localStorage.getItem(SHARED_MEMORY_KEY);
  return memory ? JSON.parse(memory) : { 
    conversations: [], 
    relationshipInfo: {},
    personalDetails: {},
    sharedExperiences: []
  };
};

// Save memory to browser storage
const saveMemory = (memory) => {
  localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memory));
};

// Save shared memory to browser storage
const saveSharedMemory = (sharedMemory) => {
  localStorage.setItem(SHARED_MEMORY_KEY, JSON.stringify(sharedMemory));
};

let currentMemory = loadMemory();
let sharedMemory = loadSharedMemory();

export const getMemoryContext = () => {
  const currentUser = getCurrentUser();
  const partner = getPartner();
  
  // Format individual memory history
  const historyText = currentMemory.history.map(entry => `${entry.role}: ${entry.text}`).join('\n');
  const userInfoText = Object.entries(currentMemory.userInfo).map(([key, value]) => `${key}: ${value}`).join(', ');
  
  // Format shared memory context
  const sharedConversations = sharedMemory.conversations
    .map(conv => `${conv.speaker} (${conv.timestamp}): ${conv.message}`)
    .join('\n');
  
  const relationshipInfo = Object.entries(sharedMemory.relationshipInfo)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  
  const personalDetails = Object.entries(sharedMemory.personalDetails)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  
  let context = `Current User: ${currentUser ? currentUser.name : 'Unknown'}\n`;
  
  if (partner) {
    context += `Partner: ${partner.name}\n`;
  }
  
  
  if (sharedConversations) {
    context += `Shared conversation history with partner:\n${sharedConversations}\n\n`;
  }
  
  if (relationshipInfo) {
    context += `Relationship Information: ${relationshipInfo}\n\n`;
  }
  
  if (personalDetails) {
    context += `Shared Personal Details: ${personalDetails}\n\n`;
  }
  
  return context;
};

export const addUserMessage = async (message) => {
  const currentUser = getCurrentUser();
  
  // Add to personal memory
  currentMemory.history.push({ role: 'user', text: message });
  saveMemory(currentMemory);
  
  // Add to shared memory if user is authenticated
  if (currentUser) {
    const sharedEntry = {
      speaker: currentUser.name,
      message: message,
      timestamp: new Date().toISOString(),
      type: 'user_message'
    };
    
    sharedMemory.conversations.push(sharedEntry);
    saveSharedMemory(sharedMemory);
    
    // Sync to cloud
    try {
      await cloudStorage.saveSharedMemory(sharedEntry);
    } catch (error) {
      console.error('Failed to sync user message to cloud:', error);
    }
  }
};

export const addAIResponse = async (response) => {
  const currentUser = getCurrentUser();
  
  // Add to personal memory
  currentMemory.history.push({ role: 'ai', text: response });
  saveMemory(currentMemory);
  
  // Add to shared memory if user is authenticated
  if (currentUser) {
    const sharedEntry = {
      speaker: 'NOVA',
      message: response,
      timestamp: new Date().toISOString(),
      type: 'ai_response',
      respondingTo: currentUser.name
    };
    
    sharedMemory.conversations.push(sharedEntry);
    saveSharedMemory(sharedMemory);
    
    // Sync to cloud
    try {
      await cloudStorage.saveSharedMemory(sharedEntry);
    } catch (error) {
      console.error('Failed to sync AI response to cloud:', error);
    }
  }
};

export const extractUserInfo = async (message) => {
  const currentUser = getCurrentUser();
  const partner = getPartner();
  
  // Basic name extraction
  const nameMatch = message.match(/my name is (\w+)/i);
  if (nameMatch && nameMatch[1]) {
    currentMemory.userInfo.name = nameMatch[1];
    saveMemory(currentMemory);
  }
  
  if (!currentUser) return;
  
  // Extract relationship information
  const relationshipPatterns = [
    { pattern: /my (girlfriend|boyfriend) is (\w+)/i, key: 'partner_name' },
    { pattern: /we have been (dating|together) for ([^.]+)/i, key: 'relationship_duration' },
    { pattern: /we met ([^.]+)/i, key: 'how_we_met' },
    { pattern: /our anniversary is ([^.]+)/i, key: 'anniversary' },
    { pattern: /(she|he) likes ([^.]+)/i, key: 'partner_likes' },
    { pattern: /(she|he) works as ([^.]+)/i, key: 'partner_job' },
    { pattern: /we both love ([^.]+)/i, key: 'shared_interests' }
  ];
  
  let hasNewInfo = false;
  
  relationshipPatterns.forEach(({ pattern, key }) => {
    const match = message.match(pattern);
    if (match) {
      const value = match[2] || match[1];
      if (value && value.trim()) {
        sharedMemory.relationshipInfo[key] = value.trim();
        hasNewInfo = true;
      }
    }
  });
  
  // Extract personal details about current user
  const personalPatterns = [
    { pattern: /I work as ([^.]+)/i, key: `${currentUser.id}_job` },
    { pattern: /I like ([^.]+)/i, key: `${currentUser.id}_likes` },
    { pattern: /I am (\d+) years old/i, key: `${currentUser.id}_age` },
    { pattern: /I live in ([^.]+)/i, key: `${currentUser.id}_location` }
  ];
  
  personalPatterns.forEach(({ pattern, key }) => {
    const match = message.match(pattern);
    if (match && match[1]) {
      sharedMemory.personalDetails[key] = match[1].trim();
      hasNewInfo = true;
    }
  });
  
  // Extract compliments and sweet messages
  const complimentPatterns = [
    /you are (beautiful|gorgeous|amazing|wonderful|perfect|lovely)/i,
    /I love (you|your [^.]+)/i,
    /you make me (happy|smile|feel [^.]+)/i
  ];
  
  complimentPatterns.forEach(pattern => {
    if (pattern.test(message)) {
      const compliment = {
        from: currentUser.name,
        to: partner ? partner.name : 'partner',
        message: message,
        timestamp: new Date().toISOString(),
        type: 'compliment'
      };
      
      if (!sharedMemory.sharedExperiences) {
        sharedMemory.sharedExperiences = [];
      }
      
      sharedMemory.sharedExperiences.push(compliment);
      hasNewInfo = true;
    }
  });
  
  if (hasNewInfo) {
    saveSharedMemory(sharedMemory);
    
    // Sync to cloud
    try {
      await cloudStorage.saveSharedMemory({
        type: 'relationship_update',
        relationshipInfo: sharedMemory.relationshipInfo,
        personalDetails: sharedMemory.personalDetails,
        sharedExperiences: sharedMemory.sharedExperiences
      });
    } catch (error) {
      console.error('Failed to sync relationship info to cloud:', error);
    }
  }
};

// Sync shared memories from cloud
export const syncSharedMemories = async () => {
  try {
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const newMemories = await cloudStorage.fetchSharedMemories(lastSync);
    
    newMemories.forEach(memory => {
      if (memory.type === 'user_message' || memory.type === 'ai_response') {
        // Check if this conversation entry already exists
        const exists = sharedMemory.conversations.some(conv => 
          conv.timestamp === memory.timestamp && conv.message === memory.message
        );
        
        if (!exists) {
          sharedMemory.conversations.push(memory);
        }
      } else if (memory.type === 'relationship_update') {
        // Merge relationship info
        Object.assign(sharedMemory.relationshipInfo, memory.relationshipInfo || {});
        Object.assign(sharedMemory.personalDetails, memory.personalDetails || {});
        
        if (memory.sharedExperiences) {
          sharedMemory.sharedExperiences = [
            ...(sharedMemory.sharedExperiences || []),
            ...memory.sharedExperiences
          ];
        }
      }
    });
    
    // Keep only last 100 conversations to prevent memory bloat
    if (sharedMemory.conversations.length > 100) {
      sharedMemory.conversations = sharedMemory.conversations.slice(-100);
    }
    
    saveSharedMemory(sharedMemory);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    
    console.log(`Synced ${newMemories.length} new shared memories`);
  } catch (error) {
    console.error('Failed to sync shared memories:', error);
  }
};

// Function to clear memory (for testing/debugging)
export const clearMemory = () => {
  currentMemory = { history: [], userInfo: {} };
  saveMemory(currentMemory);
};

// Function to clear shared memory (for testing/debugging)
export const clearSharedMemory = async () => {
  sharedMemory = { 
    conversations: [], 
    relationshipInfo: {},
    personalDetails: {},
    sharedExperiences: []
  };
  saveSharedMemory(sharedMemory);
  localStorage.removeItem(LAST_SYNC_KEY);
  await cloudStorage.clearCloudData();
};

// Initialize shared memory sync
export const initializeSharedMemory = () => {
  // Sync on startup
  syncSharedMemories();
  
  // Listen for real-time updates
  cloudStorage.onMemoryUpdate((newMemories) => {
    console.log('Received real-time memory updates:', newMemories.length);
    syncSharedMemories();
  });
  
  // Periodic sync every 30 seconds
  setInterval(syncSharedMemories, 30000);
};