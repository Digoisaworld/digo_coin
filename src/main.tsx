import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/styles.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
  requestAnimationFrame(() => document.getElementById('boot')?.remove());
}
