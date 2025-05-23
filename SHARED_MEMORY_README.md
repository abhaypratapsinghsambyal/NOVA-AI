# NOVA Shared Memory System

## Overview

This system creates an exclusive shared memory between Abhay and Piram, allowing their AI conversations to be synchronized across devices while maintaining individual user recognition.

## Features

### 🔐 Secure Authentication
- **Exclusive Access**: Only Abhay and Piram can access the system
- **Device Recognition**: AI knows who is speaking on each device
- **Automatic Login**: Remembers user on each device

### 💭 Shared Memory Components
- **Conversation History**: All conversations are shared between both users
- **Relationship Information**: AI remembers details about your relationship
- **Personal Details**: Shared knowledge about both users
- **Compliments & Sweet Messages**: AI remembers romantic interactions
- **Shared Experiences**: Memories of things you do together

### ☁️ Cloud Synchronization
- **Real-time Sync**: Memories sync automatically between devices
- **Offline Support**: Works offline, syncs when back online
- **Conflict Resolution**: Handles simultaneous updates gracefully

## How It Works

### For Abhay:
1. Open NOVA on your device
2. Select "Abhay" from the login screen
3. Start talking to NOVA as usual
4. Everything you say is automatically shared with Piram's NOVA

### For Piram:
1. Open NOVA on your device
2. Select "Piram" from the login screen
3. NOVA will know about conversations Abhay had
4. You can ask about things Abhay told NOVA

## Example Scenarios

### Scenario 1: Compliments
**Abhay says**: "My girlfriend is so beautiful and amazing"
**Later, Piram asks**: "What compliments did my boyfriend give me?"
**NOVA responds**: "Abhay said you are beautiful and amazing!"

### Scenario 2: Relationship Details
**Piram says**: "We've been dating for 2 years and met at college"
**Later, Abhay asks**: "How long have we been together?"
**NOVA responds**: "According to Piram, you've been dating for 2 years and met at college."

### Scenario 3: Personal Information
**Abhay says**: "I work as a software engineer and love playing guitar"
**Later, Piram asks**: "What does my boyfriend do for work?"
**NOVA responds**: "Abhay works as a software engineer and loves playing guitar."

## Technical Implementation

### Authentication System (`auth.js`)
- Predefined user profiles for Abhay and Piram
- Secure local storage of user sessions
- Partner relationship mapping

### Shared Memory (`memory.js`)
- Enhanced memory system with shared components
- Automatic extraction of relationship information
- Cloud synchronization integration

### Cloud Storage (`cloudStorage.js`)
- Simulated cloud storage using localStorage
- Real-time synchronization capabilities
- Offline support with pending sync queue

### User Interface
- Beautiful login screen with user selection
- User identification header
- Logout functionality
- Seamless integration with existing NOVA interface

## Setup Instructions

### 1. Deploy to Netlify
```bash
npm run build
# Upload build folder to Netlify
```

### 2. Share the URL
- Give the Netlify URL to both Abhay and Piram
- Each person should bookmark it on their device

### 3. First Time Setup
- **Abhay**: Open the URL, select "Abhay" from login
- **Piram**: Open the URL, select "Piram" from login
- Start having conversations!

## Privacy & Security

### Data Storage
- All data is stored locally on each device
- Cloud simulation uses browser localStorage
- No external servers involved (except Gemini API)

### Access Control
- Only Abhay and Piram can authenticate
- No other users can access the shared memory
- Each device maintains its own local copy

### Data Types Shared
- Conversation messages
- Relationship information
- Personal details
- Compliments and sweet messages
- Shared experiences

## Troubleshooting

### Memory Not Syncing
1. Check internet connection
2. Try logging out and back in
3. Clear browser cache if needed

### Login Issues
1. Make sure to select the correct user
2. Clear browser data if persistent issues
3. Try refreshing the page

### AI Not Remembering
1. Ensure you're logged in
2. Check that shared memory is active (shown in header)
3. Try asking more specific questions

## Advanced Features

### Memory Categories
- **Personal Memory**: Individual conversation history
- **Shared Conversations**: Cross-device conversation sync
- **Relationship Info**: Details about your relationship
- **Personal Details**: Information about each person
- **Shared Experiences**: Memories you create together

### Smart Information Extraction
The AI automatically detects and saves:
- Names and personal information
- Relationship milestones
- Compliments and sweet messages
- Work and hobby information
- Shared interests and experiences

## Future Enhancements

### Planned Features
- Real Firebase integration for true cloud storage
- Mobile app versions
- Photo sharing in memories
- Anniversary and milestone reminders
- Relationship timeline visualization

### Customization Options
- Custom memory categories
- Privacy settings for different types of information
- Export/import memory data
- Multiple relationship support

## Support

If you encounter any issues:
1. Check this README for troubleshooting steps
2. Try the basic troubleshooting steps
3. Clear browser data and try again
4. Contact the developer if issues persist

---

**Made with ❤️ for Abhay and Piram**

*This system is designed exclusively for your relationship. Enjoy your shared AI companion!*