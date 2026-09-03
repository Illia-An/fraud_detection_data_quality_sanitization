import { Route, Routes } from 'react-router-dom';

import { DashboardLayout } from './dashboard/DashboardLayout';
import { AppProviders } from './providers/AppProviders';
import { DocumentationPage } from './pages/DocumentationPage';
import { SanitizationPage } from './pages/SanitizationPage';

export default function App() {
  return (
    <AppProviders>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<SanitizationPage />} />
          <Route path="documentation" element={<DocumentationPage />} />
        </Route>
      </Routes>
    </AppProviders>
  );
}
