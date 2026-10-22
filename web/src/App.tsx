import { Route, Routes } from 'react-router-dom';

import { DashboardLayout } from './dashboard/DashboardLayout';
import { AppProviders } from './providers/AppProviders';
import { DocumentationPage } from './pages/DocumentationPage';
import { PlannerPage } from './pages/PlannerPage';
import { TtsPlannerPage } from './pages/TtsPlannerPage';
import { SanitizationPage } from './pages/SanitizationPage';
import { TtsOrderBumpPage } from './pages/TtsOrderBumpPage';
import { TtsKitchenPage } from './pages/TtsKitchenPage';
import { TtsSanitizationPage } from './pages/TtsSanitizationPage';

export default function App() {
  return (
    <AppProviders>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<SanitizationPage />} />
          <Route path="tts" element={<TtsSanitizationPage />} />
          <Route path="tts-kitchen" element={<TtsKitchenPage />} />
          <Route path="tts-order" element={<TtsOrderBumpPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="planner-tts" element={<TtsPlannerPage />} />
          <Route path="documentation" element={<DocumentationPage />} />
        </Route>
      </Routes>
    </AppProviders>
  );
}
