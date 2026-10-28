'use client';

import React from 'react';
import { LazorkitProvider } from '@lazorkit/wallet';

// Silence @solana/web3.js benign websocket reconnect & rate limit retry logs from triggering Next.js dev overlay
if (typeof window !== 'undefined') {
	const origError = console.error;
	console.error = (...args: any[]) => {
		const raw = args[0];
		const msg = typeof raw === 'string' ? raw : (raw && typeof raw.message === 'string' ? raw.message : String(raw ?? ''));
		if (/ws error|429|max usage reached|Server responded with/i.test(msg)) {
			console.warn('[solana-rpc]', ...args);
			return;
		}
		origError.apply(console, args);
	};
}

type Props = { children: React.ReactNode };

export function LazorkitRootProvider({ children }: Props) {
	// Read env from Next public variables
	const rawRpc = process.env.NEXT_PUBLIC_LAZORKIT_RPC_URL || process.env.LAZORKIT_RPC_URL || 'https://api.devnet.solana.com';
	const rpcUrl = rawRpc.includes('47712b7a-ea63-49b8-9685-dff77d9eb55a')
		? 'https://api.devnet.solana.com'
		: rawRpc;
	const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:3001';
	const localPaymaster = `${apiBase}/api/paymaster`;
	const rawPaymaster = process.env.NEXT_PUBLIC_LAZORKIT_PAYMASTER_URL || process.env.LAZORKIT_PAYMASTER_URL || localPaymaster;
	// LazorKit public kora endpoint (kora.devnet.lazorkit.com) does not allow devnet v2 program 57bTNWqtYTJbWuLWASKo6GqUTAK6oFDUR5c6hEc6V8nv.
	// Route through our local backend paymaster which signs with our funded admin treasury.
	const paymasterUrl = rawPaymaster.includes('kora.devnet.lazorkit.com') ? localPaymaster : rawPaymaster;
	const portalUrl = process.env.NEXT_PUBLIC_LAZORKIT_PORTAL_URL || process.env.LAZORKIT_PORTAL_URL || '';
	const v1PaymasterUrl = paymasterUrl;
	const cluster = process.env.NEXT_PUBLIC_ENABLE_MAINNET === 'true' ? 'mainnet' : 'devnet';

	// If envs are missing, still render children to avoid blocking the app
	if (!rpcUrl || !paymasterUrl || !portalUrl) {
		return <>{children}</>;
	}

	return (
		<LazorkitProvider
			rpcUrl={rpcUrl}
			portalUrl={portalUrl}
			cluster={cluster}
			paymasterConfig={{ paymasterUrl }}
			v1PaymasterConfig={{ paymasterUrl: v1PaymasterUrl }}
		>
			{children}
		</LazorkitProvider>
	);
}
