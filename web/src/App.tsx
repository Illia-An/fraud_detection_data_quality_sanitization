import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout';
import { AppProviders } from './providers/AppProviders';
import { SanitizationPage } from './pages/SanitizationPage';

export default function App() {
  return (
    <AppProviders>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<SanitizationPage />} />
        </Route>
      </Routes>
    </AppProviders>
  );
}
