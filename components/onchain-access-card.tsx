'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Fingerprint,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { useOnchainAccess } from '@/hooks/use-onchain-access';
import { explorerAddressUrl } from '@/lib/utils/explorer';
import { QUICK_PAY_LIMITS, TRUSTED_BROWSER_LIMITS, slotsToMs, type QuickLimits } from '@/lib/lazorkit/quick-access';

const short = (s: string, n = 4) => `${s.slice(0, n)}…${s.slice(-n)}`;

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const describeLimits = (l: QuickLimits) =>
  [
    `≤ ${l.solPerTx} SOL/tx`,
    l.solLifetime ? `${l.solLifetime} SOL total` : null,
    `≤ ${l.usdcPerTx} USDC/tx`,
    l.usdcLifetime ? `${l.usdcLifetime} USDC total` : null,
  ]
    .filter(Boolean)
    .join(' · ');

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-primary/10 text-primary border-primary/20',
  admin: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  spender: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

/**
 * On-chain keys of the LazorKit wallet: passkey owner, delegated device keys
 * (ROLE_SPENDER with a spending policy) and Quick Pay sessions. Read from the
 * program accounts, changed with one passkey approval each.
 */
export function OnchainAccessCard() {
  const { toast } = useToast();
  const {
    walletPda,
    isV2,
    access,
    loading,
    error,
    busy,
    sessionMarker,
    authorityMarker,
    refresh,
    trustThisBrowser,
    removeAuthority,
    enableQuickPay,
    revokeSession,
  } = useOnchainAccess();
  const [confirmPda, setConfirmPda] = useState<string | null>(null);

  if (!walletPda) return null;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast({ title: ok, description: 'Confirmed on Solana devnet.' });
    } catch (e) {
      const msg = (e as Error)?.message || 'Transaction failed';
      if (/cancel|abort|denied|not allowed/i.test(msg)) return;
      toast({ title: 'Action failed', description: msg, variant: 'destructive' });
    }
  };

  const activeSessions = access?.sessions.filter((s) => !s.expired) ?? [];
  const thisSessionActive = !!sessionMarker && activeSessions.some((s) => s.pda === sessionMarker.sessionPda);

  return (
    <section id="onchain-access" className="glass-card rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-border/10 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            On-chain Access
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-xl">
            Keys registered in your LazorKit wallet program on Solana devnet. Delegated keys and Quick Pay sessions sign
            without Face ID, only within their spending limits.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={explorerAddressUrl(walletPda)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            title="Wallet PDA on Solana Explorer"
          >
            {short(walletPda)} <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            id="onchain-access-refresh"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => refresh(true)}
            disabled={loading}
            title="Reload from chain"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!isV2 && (
        <div className="px-5 py-3 text-[11px] text-amber-300 bg-amber-500/5 border-b border-amber-500/10">
          This is a LazorKit v1 wallet: delegated keys have no spending policy there, so adding them is disabled.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/10">
        {/* Authorities */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Authorities</h4>
            <Button
              id="trust-this-browser"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!isV2 || !!authorityMarker || busy !== null}
              onClick={() => act(trustThisBrowser, 'This browser is now a trusted key')}
            >
              {busy === 'trust' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MonitorSmartphone className="h-3.5 w-3.5" />}
              {authorityMarker ? 'Browser trusted' : 'Trust this browser'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            A trusted browser holds a non-extractable Ed25519 key (spender role): {describeLimits(TRUSTED_BROWSER_LIMITS)}.
          </p>

          {error && <p className="text-[11px] text-destructive">{error}</p>}
          {!access && loading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading program accounts…
            </div>
          )}

          <ul className="space-y-2">
            {access?.authorities.map((a) => {
              const isThisBrowser = !!authorityMarker && authorityMarker.authorityPda === a.pda;
              const removable = a.role !== 0;
              return (
                <li
                  key={a.pda}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      {a.kind === 'passkey' ? (
                        <Fingerprint className="h-4 w-4 text-primary" />
                      ) : (
                        <KeyRound className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {a.kind === 'passkey' ? 'Passkey' : 'Device key'}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${ROLE_STYLE[a.roleName] ?? ROLE_STYLE.spender}`}
                        >
                          {a.roleName}
                        </span>
                        {isThisBrowser && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            THIS BROWSER
                          </span>
                        )}
                      </div>
                      <a
                        href={explorerAddressUrl(a.pda)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-muted-foreground hover:text-primary"
                      >
                        {a.publicKey ? `key ${short(a.publicKey)}` : `pda ${short(a.pda)}`}
                      </a>
                    </div>
                  </div>
                  {removable &&
                    (confirmPda === a.pda ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-[10px] px-2"
                          disabled={busy !== null}
                          onClick={() => {
                            setConfirmPda(null);
                            act(() => removeAuthority(a.pda), 'Key removed from the wallet');
                          }}
                        >
                          {busy === `remove:${a.pda}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setConfirmPda(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        disabled={busy !== null}
                        onClick={() => setConfirmPda(a.pda)}
                        title="Remove this key"
                      >
                        {busy === `remove:${a.pda}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    ))}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Sessions */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Quick Pay sessions
            </h4>
            <Button
              id="enable-quick-pay"
              size="sm"
              variant={thisSessionActive ? 'outline' : 'default'}
              className="h-8 text-xs gap-1.5"
              disabled={!isV2 || thisSessionActive || busy !== null}
              onClick={() => act(enableQuickPay, 'Quick Pay enabled for 24h')}
            >
              {busy === 'session' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              {thisSessionActive ? 'Quick Pay on' : 'Enable Quick Pay'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Send small payments without Face ID for 24h: {describeLimits(QUICK_PAY_LIMITS)}. Signing out deletes the session key.
          </p>

          {access && activeSessions.length === 0 && (
            <p className="text-[11px] text-muted-foreground py-3">No active session.</p>
          )}
          <ul className="space-y-2">
            {activeSessions.map((s) => {
              const mine = sessionMarker?.sessionPda === s.pda;
              return (
                <li
                  key={s.pda}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-white">{formatDuration(slotsToMs(s.slotsLeft))} left</span>
                      {mine && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          THIS BROWSER
                        </span>
                      )}
                      {!s.hasLimits && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
                          UNRESTRICTED
                        </span>
                      )}
                    </div>
                    <a
                      href={explorerAddressUrl(s.pda)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-muted-foreground hover:text-primary"
                    >
                      key {short(s.sessionKey)}
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] px-2 text-muted-foreground hover:text-destructive"
                    disabled={busy !== null}
                    onClick={() => act(() => revokeSession(s.pda), 'Session revoked')}
                  >
                    {busy === `revoke:${s.pda}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revoke'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
