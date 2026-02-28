import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const savedTheme = localStorage.getItem('term_theme') ?? 'Dark';
document.documentElement.setAttribute('data-theme', savedTheme.toLowerCase());

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
