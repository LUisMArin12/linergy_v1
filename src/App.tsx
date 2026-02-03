// src/App.tsx
import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import WelcomePage from './pages/WelcomePage';
import NotFoundPage from './pages/NotFoundPage';

const MapPage = lazy(() => import('./pages/MapPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AdminLinesPage = lazy(() => import('./pages/AdminLinesPage'));
const AdminImportPage = lazy(() => import('./pages/AdminImportPage'));

import RegisterFaultModal from './components/modals/RegisterFaultModal';
import ShareModal from './components/modals/ShareModal';
import { ToastProvider } from './contexts/ToastContext';
import { SearchProvider } from './contexts/SearchContext';
import { MapFocusProvider } from './contexts/MapFocusContext';

export default function App() {
  const [showShare, setShowShare] = useState(false);

  return (
    <BrowserRouter>
      <ToastProvider>
        <SearchProvider>
          {/*  MapFocusProvider DEBE estar dentro del Router */}
          <MapFocusProvider>
            <Suspense fallback={<div className="p-6 text-sm text-[#6B7280]">Cargando…</div>}>
            <Routes>
              <Route path="/" element={<WelcomePage />} />

              <Route path="/dashboard" element={<AppLayout onShare={() => setShowShare(true)} />}>
                <Route index element={<Navigate to="/dashboard/mapa" replace />} />
                <Route path="mapa" element={<MapPage />} />
                <Route path="reportes" element={<ReportsPage />} />
                <Route path="admin/lineas" element={<AdminLinesPage />} />
                <Route path="admin/importar" element={<AdminImportPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>

            {/*  Modales dentro de providers (por si usan context) */}
            <RegisterFaultModal />

            <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} />
          </MapFocusProvider>
        </SearchProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}