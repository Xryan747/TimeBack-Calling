import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import EditPage from './pages/EditPage';
import CallPage from './pages/CallPage';
import ChatListPage from './pages/ChatListPage';
import ChatWindowPage from './pages/ChatWindowPage';
import ProfilePage from './pages/ProfilePage';
import ServicesPage from './pages/ServicesPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import ManagePage from './pages/ManagePage';

function RequireAuth({ children }) {
  const authed = localStorage.getItem('auth') === 'true';
  if (!authed) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/chat" element={
          <RequireAuth><ChatListPage /></RequireAuth>
        } />
        <Route path="/chat/:id" element={
          <RequireAuth><ChatWindowPage /></RequireAuth>
        } />
        <Route path="/edit/:id" element={
          <RequireAuth><EditPage /></RequireAuth>
        } />
        <Route path="/call/:id" element={
          <RequireAuth><CallPage /></RequireAuth>
        } />
        <Route path="/me" element={
          <RequireAuth><ProfilePage /></RequireAuth>
        } />
        <Route path="/services" element={
          <RequireAuth><ServicesPage /></RequireAuth>
        } />
        <Route path="/settings" element={
          <RequireAuth><SettingsPage /></RequireAuth>
        } />
        <Route path="/about" element={
          <RequireAuth><AboutPage /></RequireAuth>
        } />
        <Route path="/manage" element={
          <RequireAuth><ManagePage /></RequireAuth>
        } />
      </Routes>
    </div>
  );
}
