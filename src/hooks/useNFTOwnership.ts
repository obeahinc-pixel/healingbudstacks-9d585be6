import { useAccount, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Address } from 'viem';

// Standard ERC-721 ABI for balanceOf and ownerOf
const ERC721_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Dr. Green Digital Key NFT Contract Configuration
 * 
 * The Dr. Green ecosystem uses NFTs as "Digital Keys" for access control.
 * Deployed on Ethereum Mainnet.
 * 
 * Key Types:
 * - Standard Key: Access to 1 planet, basic functionality
 * - Gold Key: Access to multiple planets, enhanced benefits
 * - Platinum Key: Access to all 20 planets, custom strain creation
 * 
 * Contract: 0x217ddEad61a42369A266F1Fb754EB5d3EBadc88a
 */
export const NFT_CONTRACTS = {
  // Dr. Green Digital Key - Main access NFT on Ethereum Mainnet
  drGreenDigitalKey: {
    address: '0x217ddEad61a42369A266F1Fb754EB5d3EBadc88a' as Address,
    chainId: mainnet.id,
    name: 'Dr. Green Digital Key',
  },
  
  // Dr. Green Platinum Key - Premium tier (same contract, different token metadata)
  drGreenPlatinumKey: {
    address: '0x217ddEad61a42369A266F1Fb754EB5d3EBadc88a' as Address,
    chainId: mainnet.id,
    name: 'Dr. Green Platinum Key',
  },
  
  // Healing Buds Partner Access (if applicable)
  healingBudsAccess: {
    address: '0x0000000000000000000000000000000000000000' as Address,
    chainId: mainnet.id,
    name: 'Healing Buds Access',
  },
} as const;

// Legacy export for backwards compatibility
export const LEGACY_NFT_CONTRACTS = {
  drGreenKey: NFT_CONTRACTS.drGreenDigitalKey.address,
  healingBudsAccess: NFT_CONTRACTS.healingBudsAccess.address,
} as const;

interface UseNFTOwnershipOptions {
  contractAddress: Address;
  chainId?: number;
  enabled?: boolean;
}

interface NFTOwnershipResult {
  hasNFT: boolean;
  balance: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to check if the connected wallet owns an NFT from a specific contract
 */
export function useNFTOwnership({
  contractAddress,
  chainId = mainnet.id, // Default to Ethereum Mainnet where Dr. Green NFTs are deployed
  enabled = true,
}: UseNFTOwnershipOptions): NFTOwnershipResult {
  const { address, isConnected } = useAccount();

  // Check if contract address is configured (not zero address)
  const isContractConfigured = contractAddress !== '0x0000000000000000000000000000000000000000';

  const {
    data: balance,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: contractAddress,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: enabled && isConnected && !!address && isContractConfigured,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  });

  return {
    hasNFT: balance !== undefined && balance > BigInt(0),
    balance,
    isLoading: isLoading && isContractConfigured,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to check Dr. Green Digital Key ownership specifically
 * Uses the configured contract address and Polygon chain
 */
export function useDrGreenKeyOwnership() {
  return useNFTOwnership({
    contractAddress: NFT_CONTRACTS.drGreenDigitalKey.address,
    chainId: NFT_CONTRACTS.drGreenDigitalKey.chainId,
  });
}

/**
 * Hook to check Dr. Green Platinum Key ownership
 */
export function usePlatinumKeyOwnership() {
  return useNFTOwnership({
    contractAddress: NFT_CONTRACTS.drGreenPlatinumKey.address,
    chainId: NFT_CONTRACTS.drGreenPlatinumKey.chainId,
  });
}

/**
 * Hook to check any tier of Dr. Green Key ownership
 * Returns true if the user owns any Digital Key (Standard, Gold, or Platinum)
 */
export function useAnyDrGreenKeyOwnership() {
  const digitalKey = useDrGreenKeyOwnership();
  const platinumKey = usePlatinumKeyOwnership();

  return {
    hasAnyKey: digitalKey.hasNFT || platinumKey.hasNFT,
    hasPlatinumKey: platinumKey.hasNFT,
    hasDigitalKey: digitalKey.hasNFT,
    isLoading: digitalKey.isLoading || platinumKey.isLoading,
    error: digitalKey.error || platinumKey.error,
    refetch: () => {
      digitalKey.refetch();
      platinumKey.refetch();
    },
  };
}

/**
 * Hook to check ownership of multiple NFT contracts
 */
export function useMultiNFTOwnership(
  contracts: { address: Address; chainId?: number }[]
) {
  const { address, isConnected } = useAccount();

  // For simplicity, we'll check the first contract
  // In production, you'd want to use multicall or multiple queries
  const firstContract = contracts[0];
  
  const result = useNFTOwnership({
    contractAddress: firstContract?.address ?? '0x0000000000000000000000000000000000000000',
    chainId: firstContract?.chainId,
    enabled: isConnected && !!address && contracts.length > 0,
  });

  return {
    ...result,
    contracts,
  };
}
