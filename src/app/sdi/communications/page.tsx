import SecureComms from '../../../components/sdi/SecureComms';
import { InterfaceSwitcher } from '../../../components/shared/InterfaceSwitcher';
import { Button } from '../../../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createUrl } from '~/lib/url-utils';

export default function SecureCommunicationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-black/80 border-b border-white/10 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href={createUrl("/sdi")}>
              <Button variant="ghost" size="sm" className="text-blue-300 hover:text-blue-200">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to SDI
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white">Secure Communications</h1>
          </div>
          <InterfaceSwitcher currentInterface="sdi" />
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          <SecureComms />
        </div>
      </main>
    </div>
  );
} 