import { ConfigForm } from '../components/ConfigForm';
import { HowItWorksCard } from '../components/HowItWorksCard';
import { SampleDataPanel } from '../components/SampleDataPanel';

export function SanitizationPage() {
  return (
    <>
      <HowItWorksCard />
      <SampleDataPanel />
      <ConfigForm />
    </>
  );
}
