import type { Theme } from '@c15t/nextjs';

/**
 * Tailwind Theme
 *
 * Uses standard Tailwind colors (Slate/Blue) with backdrop blur effects.
 * This theme works well with Tailwind CSS projects.
 *
 * Customize the colors, typography, and slots below to match your design.
 *
 * @see https://c15t.com/docs/customization/theming
 */
export const theme: Theme = {
	colors: {
		primary: '#3b82f6', // blue-500
		primaryHover: '#2563eb', // blue-600
		surface: '#ffffff',
		surfaceHover: '#f8fafc', // slate-50
		border: '#e2e8f0', // slate-200
		borderHover: '#cbd5e1', // slate-300
		text: '#0f172a', // slate-900
		textMuted: '#64748b', // slate-500
		textOnPrimary: '#ffffff',
		switchTrack: '#e2e8f0',
		switchTrackActive: '#3b82f6',
		switchThumb: '#ffffff',
	},
	typography: {
		fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
	},
	radius: {
		sm: '0.125rem',
		md: '0.375rem',
		lg: '0.5rem',
		full: '9999px',
	},
	slots: {
		consentBannerCard:
			'border border-slate-200 bg-white/95 backdrop-blur-sm shadow-md',
		consentDialogCard:
			'border border-slate-200 bg-white/95 backdrop-blur-md shadow-xl',
		buttonPrimary:
			'bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors',
		buttonSecondary:
			'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors',
		consentBannerTitle: 'text-slate-900 font-semibold',
		consentBannerDescription: 'text-slate-500',
	},
};
