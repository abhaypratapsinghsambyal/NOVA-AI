// Login.js - User authentication component for Abhay and Piram
import React, { useState, useEffect } from 'react';
import { setCurrentUser, getCurrentUser, getAuthorizedUsers, isAuthorizedUser } from './auth';
import './Login.css';

const Login = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const authorizedUsers = getAuthorizedUsers();

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = getCurrentUser();
    if (currentUser) {
      onLogin(currentUser);
    }
  }, [onLogin]);

  const handleLogin = async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    if (!isAuthorizedUser(selectedUser)) {
      setError('Unauthorized user');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const user = setCurrentUser(selectedUser);
      if (user) {
        console.log(`User ${user.name} logged in successfully`);
        onLogin(user);
      } else {
        setError('Login failed');
      }
    } catch (err) {
      setError('Login failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="nova-logo">
          <div className="nova-circle">
            <span className="nova-text">NOVA</span>
          </div>
        </div>
        
        <h2 className="login-title">Welcome to NOVA</h2>
        <p className="login-subtitle">Shared AI Memory System</p>
        
        <div className="user-selection">
          <h3>Select Your Identity</h3>
          <div className="user-options">
            {authorizedUsers.map(user => (
              <div 
                key={user.id}
                className={`user-option ${selectedUser === user.id ? 'selected' : ''}`}
                onClick={() => setSelectedUser(user.id)}
              >
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="user-name">{user.name}</div>
                  <div className="user-role">{user.relationship}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <button 
          className="login-button"
          onClick={handleLogin}
          disabled={isLoading || !selectedUser}
        >
          {isLoading ? 'Connecting...' : 'Connect to NOVA'}
        </button>
        
        <div className="login-info">
          <p>This system creates a shared memory between Abhay and Piram.</p>
          <p>Your conversations and memories will be synchronized across devices.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;