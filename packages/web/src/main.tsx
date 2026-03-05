import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
    console.warn("⚠️ Missing VITE_CLERK_PUBLISHABLE_KEY in .env");
}

const savedTheme = localStorage.getItem('term_theme') ?? 'Dark';
document.documentElement.setAttribute('data-theme', savedTheme.toLowerCase());

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {PUBLISHABLE_KEY ? (
            <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
                <App />
            </ClerkProvider>
        ) : (
            <App />
        )}
    </StrictMode>,
);
