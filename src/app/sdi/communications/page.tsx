import { GlassCard } from '../../../components/ui/enhanced-card';

export default function SecureCommunicationsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="max-w-2xl w-full p-12 animate-fade-in">
        <h1 className="text-4xl font-bold text-blue-100 mb-4">Secure Communications Center</h1>
        <p className="text-lg text-blue-200 mb-2">Encrypted diplomatic channels and secure correspondence.</p>
        <div className="text-blue-300">(Module under construction)</div>
      </GlassCard>
    </div>
  );
} 