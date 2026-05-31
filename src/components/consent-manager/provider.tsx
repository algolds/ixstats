'use client';

import type { ReactNode } from 'react';
import {
	ConsentDialog,
	ConsentManagerProvider,
	ConsentBanner,
} from '@c15t/nextjs';
import type { ConsentManagerProps } from '@c15t/nextjs';
import { DevTools } from '@c15t/dev-tools/react';
import { theme } from './theme';
/**
 * Client-side consent manager provider.
 * @see https://c15t.com/docs/frameworks/nextjs/quickstart
 */
export default function ConsentManagerClient({ children, ssrData }: ConsentManagerProps) {
	return (
		<ConsentManagerProvider options={{
			mode: 'hosted',
				backendURL: "/api/c15t",
				ssrData,
				theme,
			// Add your scripts here:
				// import { googleTagManager } from '@c15t/scripts/google-tag-manager';
				// scripts: [
				//   googleTagManager({ id: 'GTM-XXXXXX' }),
				// ],
		}}>
			<ConsentBanner />
			<ConsentDialog />
			<DevTools disabled={process.env.NODE_ENV === 'production'} />
			{children}
		</ConsentManagerProvider>
	);
}
