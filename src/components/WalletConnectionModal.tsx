'use client';

import { useState } from 'react';
import { useAccount, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, LogOut, Copy, Check, ExternalLink, Shield, ShieldCheck, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDrGreenKeyOwnership } from '@/hooks/useNFTOwnership';
import { cn } from '@/lib/utils';

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletConnectionModal({ isOpen, onClose }: WalletConnectionModalProps) {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const { hasNFT, isLoading: nftLoading } = useDrGreenKeyOwnership();

  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const currentChain = chains.find((c) => c.id === chainId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </DialogTitle>
          <DialogDescription>
            {isConnected
              ? 'Manage your wallet connection and view your NFT access status.'
              : 'Connect your wallet to access exclusive features and verify your Digital Key ownership.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isConnected ? (
            <div className="flex justify-center">
              <ConnectButton.Custom>
                {({ openConnectModal, connectModalOpen }) => (
                  <Button
                    onClick={openConnectModal}
                    disabled={connectModalOpen}
                    size="lg"
                    className="w-full"
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Address Display */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Wallet className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{truncateAddress(address!)}</p>
                      <p className="text-xs text-muted-foreground">
                        via {connector?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyAddress}
                    className="h-8 w-8"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Balance & Network */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-sm font-medium">
                      {balance ? `${(Number(balance.value) / Math.pow(10, balance.decimals)).toFixed(4)} ${balance.symbol}` : '—'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex flex-col items-start rounded-lg border border-border bg-muted/50 p-3 text-left hover:bg-muted transition-colors">
                        <p className="text-xs text-muted-foreground">Network</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                          {currentChain?.name || 'Unknown'}
                          <ChevronDown className="h-3 w-3" />
                        </p>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {chains.map((chain) => (
                        <DropdownMenuItem
                          key={chain.id}
                          onClick={() => switchChain({ chainId: chain.id })}
                          className={cn(chain.id === chainId && 'bg-muted')}
                        >
                          {chain.name}
                          {chain.id === chainId && (
                            <Check className="ml-auto h-4 w-4" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* NFT Access Status */}
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    hasNFT
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-amber-500/50 bg-amber-500/10'
                  )}
                >
                  {nftLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm">Checking NFT ownership...</span>
                    </div>
                  ) : hasNFT ? (
                    <>
                      <ShieldCheck className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">
                          Digital Key Verified
                        </p>
                        <p className="text-xs text-green-600/80 dark:text-green-500/80">
                          Full access to exclusive features
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          No Digital Key Found
                        </p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                          Some features may be restricted
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (address) {
                        window.open(
                          `https://polygonscan.com/address/${address}`,
                          '_blank'
                        );
                      }
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on Explorer
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      disconnect();
                      onClose();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Floating wallet button that can be placed anywhere in the app
 * Opens the wallet connection modal when clicked
 */
interface WalletButtonProps {
  className?: string;
  /** Data attribute for programmatic triggering */
  'data-wallet-trigger'?: string;
}

export function WalletButton({ className, ...props }: WalletButtonProps) {
  const { isConnected, address } = useAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const { hasNFT } = useDrGreenKeyOwnership();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <Button
        variant={isConnected ? 'outline' : 'default'}
        onClick={() => setModalOpen(true)}
        className={cn('gap-2', className)}
        data-wallet-trigger="true"
        {...props}
      >
        {isConnected ? (
          <>
            {hasNFT ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <Wallet className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{truncateAddress(address!)}</span>
            <span className="sm:hidden">Wallet</span>
          </>
        ) : (
          <>
            <Wallet className="h-4 w-4" />
            <span>Connect</span>
          </>
        )}
      </Button>
      <WalletConnectionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
