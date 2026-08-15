import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppStoreProvider } from './store/AppStore';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppStoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppStoreProvider>
  </React.StrictMode>,
);
