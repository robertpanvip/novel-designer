import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import Dashboard from './pages/Dashboard';
import Writer from './pages/Writer';
import Characters from './pages/Characters';
import World from './pages/World';
import Plot from './pages/Plot';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/writer" element={<Writer />} />
        <Route path="/characters" element={<Characters />} />
        <Route path="/world" element={<World />} />
        <Route path="/plot" element={<Plot />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
