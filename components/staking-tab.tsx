'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Coins,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useWalletStore } from '@/lib/store/wallet';
import { useWallet } from '@/hooks/use-lazorkit-wallet';
import { defaultConnection } from '@/lib/services/jupiter';
import { explorerAddressUrl, explorerTxUrl } from '@/lib/utils/explorer';
import { toast } from '@/hooks/use-toast';
import {
  getDevnetValidators,
  getUserStakeAccounts,
  buildCreateAndDelegateStake,
  buildDeactivateStake,
  buildWithdrawStake,
  type ValidatorInfo,
  type UserStakeAccount,
} from '@/lib/services/staking';
import { PublicKey } from '@solana/web3.js';

export function StakingTab() {
  const { tokens, pubkey, refreshBalances, addActivity } = useWalletStore();
  const lz = useWallet();
  const activeAddress = lz.address || pubkey;

  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [stakeAccounts, setStakeAccounts] = useState<UserStakeAccount[]>([]);
  const [selectedValidator, setSelectedValidator] = useState<string>('');
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const solToken = tokens.find((t) => t.symbol === 'SOL');
  const solBalance = solToken?.amount || 0;

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [vals, userAccounts] = await Promise.all([
        getDevnetValidators(defaultConnection),
        activeAddress ? getUserStakeAccounts(defaultConnection, activeAddress) : Promise.resolve([]),
      ]);
      setValidators(vals);
      if (vals.length > 0 && !selectedValidator) {
        setSelectedValidator(vals[0].votePubkey);
      }
      setStakeAccounts(userAccounts);
    } catch (err) {
      console.error('[staking] load error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeAddress, selectedValidator]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalStaked = stakeAccounts.reduce((acc, a) => acc + (a.state === 'active' || a.state === 'activating' ? a.stakedSol : 0), 0);

  const handleStake = async () => {
    const amountNum = parseFloat(stakeAmount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid SOL amount', variant: 'destructive' });
      return;
    }
    if (amountNum > solBalance) {
      toast({ title: 'Insufficient balance', description: 'You do not have enough SOL', variant: 'destructive' });
      return;
    }
    if (!selectedValidator) {
      toast({ title: 'Select a validator', variant: 'destructive' });
      return;
    }
    if (!activeAddress || !lz.signAndSendTransaction) {
      toast({ title: 'Wallet not connected', variant: 'destructive' });
      return;
    }

    setActionInProgress('stake');
    try {
      const walletPubkey = new PublicKey(activeAddress);
      const votePubkey = new PublicKey(selectedValidator);

      const { instructions, stakePubkey } = await buildCreateAndDelegateStake(
        defaultConnection,
        walletPubkey,
        votePubkey,
        amountNum
      );

      const sig = await lz.signAndSendTransaction(instructions);

      addActivity?.({
        id: Date.now().toString(),
        kind: 'send',
        ts: new Date().toISOString(),
        summary: `Staked ${amountNum} SOL to ${selectedValidator.slice(0, 4)}...${selectedValidator.slice(-4)}`,
        amount: amountNum,
        token: 'SOL',
        counterparty: stakePubkey.toBase58(),
        status: 'Success',
        tx: sig,
      } as any);

      toast({
        title: '✅ Stake Confirmed',
        description: `Successfully staked ${amountNum} SOL on Solana Devnet`,
      });

      setStakeAmount('');
      setTimeout(() => {
        loadData(true);
        refreshBalances?.().catch(console.error);
      }, 2500);
    } catch (err: any) {
      console.error('[staking] stake error:', err);
      toast({
        title: 'Staking Failed',
        description: err?.message || 'Transaction rejected on chain',
        variant: 'destructive',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeactivate = async (stakeAccountPubkey: string) => {
    if (!activeAddress || !lz.signAndSendTransaction) return;

    setActionInProgress(`deactivate_${stakeAccountPubkey}`);
    try {
      const walletPubkey = new PublicKey(activeAddress);
      const stakePubkey = new PublicKey(stakeAccountPubkey);

      const ixs = buildDeactivateStake(walletPubkey, stakePubkey);
      const sig = await lz.signAndSendTransaction(ixs);

      toast({
        title: 'Unstake Initiated',
        description: 'Stake account is deactivating and will become inactive next epoch.',
      });

      setTimeout(() => loadData(true), 2500);
    } catch (err: any) {
      console.error('[staking] deactivate error:', err);
      toast({ title: 'Unstake Failed', description: err?.message || 'Transaction rejected', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleWithdraw = async (stakeAccountPubkey: string, totalSol: number) => {
    if (!activeAddress || !lz.signAndSendTransaction) return;

    setActionInProgress(`withdraw_${stakeAccountPubkey}`);
    try {
      const walletPubkey = new PublicKey(activeAddress);
      const stakePubkey = new PublicKey(stakeAccountPubkey);
      const totalLamports = Math.round(totalSol * 1e9);

      const ixs = buildWithdrawStake(walletPubkey, stakePubkey, totalLamports);
      const sig = await lz.signAndSendTransaction(ixs);

      toast({
        title: 'Withdraw Successful',
        description: `${totalSol.toFixed(4)} SOL returned to your smart wallet.`,
      });

      setTimeout(() => {
        loadData(true);
        refreshBalances?.().catch(console.error);
      }, 2500);
    } catch (err: any) {
      console.error('[staking] withdraw error:', err);
      toast({ title: 'Withdraw Failed', description: err?.message || 'Transaction rejected', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-page-enter">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="premium-depth-card rounded-2xl p-5 space-y-2 border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Staked SOL</span>
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {totalStaked.toFixed(4)} <span className="text-sm font-semibold text-primary">SOL</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Securing Solana Devnet through your smart account</p>
        </div>

        <div className="premium-depth-card rounded-2xl p-5 space-y-2 border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estimated APY</span>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">~6.8%</div>
          <p className="text-[10px] text-muted-foreground">Native validator protocol inflation yield</p>
        </div>

        <div className="premium-depth-card rounded-2xl p-5 space-y-2 border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stake Accounts</span>
            <ShieldCheck className="h-5 w-5 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-foreground">{stakeAccounts.length}</div>
          <p className="text-[10px] text-muted-foreground">Seed-derived PDA stake accounts owned by vault</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stake SOL Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4 shadow-xl border border-border/40">
            <div className="border-b border-border/20 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" /> Stake SOL
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delegate SOL to an active validator on Solana Devnet.
              </p>
            </div>

            {/* Validator Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Select Validator</Label>
              <select
                value={selectedValidator}
                onChange={(e) => setSelectedValidator(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-background/50 border border-border/50 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {validators.map((v, i) => (
                  <option key={v.votePubkey} value={v.votePubkey}>
                    #{i + 1} {v.votePubkey.slice(0, 6)}...{v.votePubkey.slice(-6)} (Comm: {v.commission}%, {v.activatedStakeSol.toLocaleString()} SOL)
                  </option>
                ))}
              </select>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <Label className="font-bold text-foreground">Amount</Label>
                <span className="text-muted-foreground">
                  Available: <span className="font-mono text-foreground font-bold">{solBalance.toFixed(4)} SOL</span>
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="h-11 pr-16 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setStakeAmount(Math.max(0, solBalance - 0.01).toFixed(4))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 transition"
                >
                  MAX
                </button>
              </div>

              {/* Quick amount presets */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[0.1, 0.25, 0.5, 1.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStakeAmount(preset.toString())}
                    className="py-1 rounded-lg text-[10px] font-bold bg-white/[0.03] border border-border/30 hover:border-primary/40 hover:text-primary transition"
                  >
                    {preset} SOL
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleStake}
              disabled={actionInProgress !== null || !activeAddress || parseFloat(stakeAmount) <= 0}
              className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl gap-2 mt-2"
            >
              {actionInProgress === 'stake' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Staking...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Stake SOL on Devnet
                </>
              )}
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Requires 1 signature with passkey. Rent-exempt deposit (~0.002 SOL) is returned upon withdrawal.
            </p>
          </div>
        </div>

        {/* Right Column: Stake Accounts List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card rounded-2xl p-5 shadow-xl border border-border/40">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Your Stake Accounts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage delegations and withdraw returned stake.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => loadData(true)}
                disabled={loading}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
              </Button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-xs">Fetching stake accounts from Solana Devnet...</p>
              </div>
            ) : stakeAccounts.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Coins className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-bold text-foreground">No Active Stake Accounts</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Delegate SOL using the form on the left to start earning staking rewards on devnet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/20 mt-2">
                {stakeAccounts.map((acc) => {
                  const isDeactivatingThis = actionInProgress === `deactivate_${acc.pubkey}`;
                  const isWithdrawingThis = actionInProgress === `withdraw_${acc.pubkey}`;

                  return (
                    <div key={acc.pubkey} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-foreground">
                            {acc.stakedSol > 0 ? acc.stakedSol.toFixed(4) : acc.totalSol.toFixed(4)} SOL
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                              acc.state === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : acc.state === 'activating'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : acc.state === 'deactivating'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-muted/30 text-muted-foreground border-border/30'
                            }`}
                          >
                            {acc.state}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          <span>Account:</span>
                          <a
                            href={explorerAddressUrl(acc.pubkey)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            {acc.pubkey.slice(0, 6)}...{acc.pubkey.slice(-6)}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                        {acc.voter && (
                          <div className="text-[10px] font-mono text-muted-foreground truncate">
                            Validator: {acc.voter.slice(0, 6)}...{acc.voter.slice(-6)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {acc.state === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeactivate(acc.pubkey)}
                            disabled={actionInProgress !== null}
                            className="h-8 text-xs font-bold gap-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                          >
                            {isDeactivatingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                            Unstake
                          </Button>
                        )}
                        {acc.state === 'inactive' && (
                          <Button
                            size="sm"
                            onClick={() => handleWithdraw(acc.pubkey, acc.totalSol)}
                            disabled={actionInProgress !== null}
                            className="h-8 text-xs font-bold gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            {isWithdrawingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
                            Withdraw
                          </Button>
                        )}
                        {acc.state === 'deactivating' && (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Deactivating...
                          </span>
                        )}
                        {acc.state === 'activating' && (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Activating...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
