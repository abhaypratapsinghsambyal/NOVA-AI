// auth.js - Handles user authentication and identification

const USER_STORAGE_KEY = 'nova_current_user';
const USERS_STORAGE_KEY = 'nova_registered_users';

// Predefined users (Abhay and Piram)
const AUTHORIZED_USERS = {
  'abhay': {
    id: 'abhay',
    name: 'Abhay',
    displayName: 'Abhay',
    relationship: 'boyfriend'
  },
  'piram': {
    id: 'piram',
    name: 'Piram',
    displayName: 'Piram',
    relationship: 'girlfriend'
  }
};

// Get current logged-in user
export const getCurrentUser = () => {
  const userData = localStorage.getItem(USER_STORAGE_KEY);
  return userData ? JSON.parse(userData) : null;
};

// Set current user
export const setCurrentUser = (userId) => {
  const user = AUTHORIZED_USERS[userId.toLowerCase()];
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return user;
  }
  return null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return getCurrentUser() !== null;
};

// Logout current user
export const logout = () => {
  localStorage.removeItem(USER_STORAGE_KEY);
};

// Get authorized users list
export const getAuthorizedUsers = () => {
  return Object.values(AUTHORIZED_USERS);
};

// Validate if user is authorized
export const isAuthorizedUser = (userId) => {
  return AUTHORIZED_USERS.hasOwnProperty(userId.toLowerCase());
};

// Get partner information
export const getPartner = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;
  
  const partnerId = currentUser.id === 'abhay' ? 'piram' : 'abhay';
  return AUTHORIZED_USERS[partnerId];
};