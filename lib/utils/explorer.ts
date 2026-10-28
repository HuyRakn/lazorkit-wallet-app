/** Solana Explorer links for the active cluster. */
export const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_ENABLE_MAINNET === 'true' ? 'mainnet-beta' : 'devnet';

const suffix = SOLANA_CLUSTER === 'mainnet-beta' ? '' : `?cluster=${SOLANA_CLUSTER}`;

export const explorerTxUrl = (signature: string) => `https://explorer.solana.com/tx/${signature}${suffix}`;
export const explorerAddressUrl = (address: string) => `https://explorer.solana.com/address/${address}${suffix}`;
