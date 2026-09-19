import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CallProvider } from './context/CallContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <CallProvider>
      <App />
    </CallProvider>
  </BrowserRouter>
);
