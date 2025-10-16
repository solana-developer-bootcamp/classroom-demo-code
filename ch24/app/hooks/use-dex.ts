"use client";

import { PublicKey } from '@solana/web3.js';
import { DexOperations } from './types/dex-types';
import { useDexAdmin } from './dex/use-dex-admin';
import { useDexLiquidity } from './dex/use-dex-liquidity';
import { useDexSwap } from './dex/use-dex-swap';
import { useDexQuery } from './dex/use-dex-query';
import { useDexRewards } from './dex/use-dex-rewards';

// 导出程序ID和地址查找函数，保持向后兼容
export { DEX_PROGRAM_ID } from './constants';
export { findPoolAddress as getPoolAddress } from './utils/address-utils';

export function useDex(): DexOperations {
  // 使用各个功能模块的 hooks
  const admin = useDexAdmin();
  const liquidity = useDexLiquidity();
  const swap = useDexSwap();
  const query = useDexQuery();
  const rewards = useDexRewards();

  // 合并所有 loading 和 error 状态
  const loading = admin.loading || liquidity.loading || swap.loading || query.loading || rewards.loading;
  const error = admin.error || liquidity.error || swap.error || query.error || rewards.error;

  return {
    // 状态
    loading,
    error,
    globalConfig: admin.globalConfig,

    // 新的管理功能
    initializeConfig: admin.initializeConfig,
    updateConfigBasic: admin.updateConfigBasic,
    updateAuthority: admin.updateAuthority,
    updateTreasury: admin.updateTreasury,
    fetchGlobalConfig: admin.fetchGlobalConfig,

    // 流动性功能 - 使用类型断言处理签名不匹配
    initializePool: liquidity.initializePool as any,
    addLiquidity: liquidity.addLiquidity,
    removeLiquidity: liquidity.removeLiquidity,
    estimateLpTokens: liquidity.estimateLpTokens,
    calculateOptimalLiquidityAmounts: liquidity.calculateOptimalLiquidityAmounts as any,
    calculateMaxRemovableLiquidity: (poolAddress, userLpBalance) =>
      liquidity.calculateMaxRemovableLiquidity(poolAddress, userLpBalance, query.getPoolReserves),
    calculateRemoveLiquidityOutput: (poolAddress, lpAmount) =>
      liquidity.calculateRemoveLiquidityOutput(poolAddress, lpAmount, query.getPoolReserves),

    // 交换功能 - 使用类型断言处理签名不匹配
    swap: swap.swap as any,
    calculateSwapOutput: swap.calculateSwapOutput as any,

    // 查询功能
    getPoolAddress: query.getPoolAddress,
    getPoolInfo: query.getPoolInfo,
    getAllPools: query.getAllPools,
    getPoolReserves: query.getPoolReserves,
    getUserTokenBalance: query.getUserTokenBalance,
    getUserLpTokenBalance: query.getUserLpTokenBalance,
    getUserTokens: query.getUserTokens,

    // 奖励功能
    getUserUnclaimedRewards: rewards.getUserUnclaimedRewards,
    claimRewards: rewards.claimRewards,

    // 新增地址查找方法
    getUserPositionAddress: (pool: PublicKey, user: PublicKey) => {
      // 实现新的用户仓位地址查找
      const { findUserPositionAddress } = require('./utils/address-utils');
      return findUserPositionAddress(pool, user);
    },
    getVaultAddress: (pool: PublicKey, tokenMint: PublicKey) => {
      // 实现vault地址查找
      const { findVaultAddress } = require('./utils/address-utils');
      return findVaultAddress(pool, tokenMint);
    },
    getUserPosition: async (poolAddress: PublicKey, userAddress: PublicKey) => {
      // 这个方法需要在rewards模块中实现
      return null;
    },

    // 向后兼容的方法
    getUserAccountAddress: rewards.getUserAccountAddress,
  };
} 