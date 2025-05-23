// cloudStorage.js - Handles cloud-based storage for shared memories

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, query, orderByChild, startAt } from 'firebase/database';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCGghf36t0F2oAGbyIcdiFpgAj4mOoTRCM",
  authDomain: "nova-accc8.firebaseapp.com",
  projectId: "nova-accc8",
  storageBucket: "nova-accc8.firebasestorage.app",
  messagingSenderId: "779173243834",
  appId: "1:779173243834:web:f0f4a4bf3ce2c1484e4b83",
  measurementId: "G-3WVTF3HMWY",
  databaseURL: "https://nova-accc8-default-rtdb.firebaseio.com/"
};

class CloudStorageService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingSync = [];
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingData();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Initialize Firebase
    this.app = initializeApp(FIREBASE_CONFIG);
    this.database = getDatabase(this.app);
    this.memoriesRef = ref(this.database, 'sharedMemories');
  }

  // Generate unique memory ID
  generateMemoryId() {
    return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save shared memory to cloud
  async saveSharedMemory(memoryData) {
    const memoryId = this.generateMemoryId();
    const timestamp = new Date().toISOString();
    
    const memoryEntry = {
      id: memoryId,
      ...memoryData,
      timestamp,
      synced: false
    };

    if (this.isOnline) {
      try {
        await this.uploadToCloud(memoryEntry);
        memoryEntry.synced = true;
      } catch (error) {
        console.error('Failed to sync to cloud:', error);
        this.pendingSync.push(memoryEntry);
      }
    } else {
      this.pendingSync.push(memoryEntry);
    }

    return memoryEntry;
  }

  // Upload memory to cloud
  async uploadToCloud(memoryEntry) {
    try {
      await push(this.memoriesRef, memoryEntry);
      console.log('Memory synced to cloud:', memoryEntry.id);
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
      throw error; // Re-throw to be caught by saveSharedMemory
    }
  }

  // Fetch shared memories from cloud
  async fetchSharedMemories(lastSyncTime = null) {
    try {
      let queryRef = this.memoriesRef;
      if (lastSyncTime) {
        queryRef = query(this.memoriesRef, orderByChild('timestamp'), startAt(lastSyncTime));
      }

      // This is a one-time fetch, not a real-time listener
      // For real-time updates, use onMemoryUpdate
      return new Promise((resolve, reject) => {
        onValue(queryRef, (snapshot) => {
          const memories = [];
          snapshot.forEach((childSnapshot) => {
            memories.push(childSnapshot.val());
          });
          resolve(memories);
        }, (error) => {
          console.error('Failed to fetch shared memories:', error);
          reject(error);
        }, { onlyOnce: true });
      });

    } catch (error) {
      console.error('Failed to fetch shared memories:', error);
      return [];
    }
  }

  // Sync pending data when back online
  async syncPendingData() {
    if (this.pendingSync.length === 0) return;
    
    console.log(`Syncing ${this.pendingSync.length} pending memories...`);
    
    const successfullySynced = [];
    for (const memory of this.pendingSync) {
      try {
        await this.uploadToCloud(memory);
        successfullySynced.push(memory);
      } catch (error) {
        console.error('Failed to sync pending memory:', error);
        // Stop syncing if one fails to avoid issues
        break;
      }
    }
    
    // Remove successfully synced items from pendingSync
    this.pendingSync = this.pendingSync.filter(memory => 
      !successfullySynced.some(synced => synced.id === memory.id)
    );
  }

  // Listen for real-time updates
  onMemoryUpdate(callback) {
    // Use Firebase listener for real-time updates
    onValue(this.memoriesRef, (snapshot) => {
      const memories = [];
      snapshot.forEach((childSnapshot) => {
        memories.push(childSnapshot.val());
      });
      callback(memories);
    }, (error) => {
      console.error('Firebase real-time update failed:', error);
    });
  }

  // Clear all cloud data (for testing - use with caution!)
  async clearCloudData() {
    // In a real app, you might not expose this or require auth
    // For testing, we'll remove the 'sharedMemories' node
    try {
      const db = getDatabase();
      await set(ref(db, 'sharedMemories'), null);
      console.log('Cloud data cleared.');
      this.pendingSync = [];
    } catch (error) {
      console.error('Failed to clear cloud data:', error);
    }
  }
}

export const cloudStorage = new CloudStorageService();
export default cloudStorage;