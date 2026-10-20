import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { EvidenceCentrePage } from './pages/EvidenceCentrePage';
import { InspectionWorkbenchPage } from './pages/InspectionWorkbenchPage';
import { SafetyInspectionPage } from './pages/SafetyInspectionPage';
import { EvidenceGraphPage } from './pages/EvidenceGraphPage';
import { PlanningCostPage } from './pages/PlanningCostPage';
import { ProjectPlanningPage } from './pages/ProjectPlanningPage';
import { ValuationPage } from './pages/ValuationPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SiteAssistantPage } from './pages/SiteAssistantPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/evidence" element={<EvidenceCentrePage />} />
        <Route path="/inspections" element={<InspectionWorkbenchPage />} />
        <Route path="/inspections/:findingId" element={<InspectionWorkbenchPage />} />
        <Route path="/inspection" element={<Navigate to="/inspections" replace />} />
        <Route path="/inspection/:findingId" element={<InspectionWorkbenchPage />} />
        <Route path="/safety-inspection" element={<SafetyInspectionPage />} />

        <Route path="/evidence-graph" element={<EvidenceGraphPage />} />
        <Route path="/planning" element={<PlanningCostPage />} />
        <Route path="/project-planning" element={<ProjectPlanningPage />} />
        <Route path="/valuation" element={<ValuationPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/assistant" element={<SiteAssistantPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}
