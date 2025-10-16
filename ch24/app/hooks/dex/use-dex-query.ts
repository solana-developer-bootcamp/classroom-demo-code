import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState, useCallback, useMemo } from 'react';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PoolInfo, PoolReserves } from '../types/dex-types';
import { findPoolAddress } from '../utils/address-utils';
import { createProgram } from '../utils/program-utils';
import { getTokenDecimals } from '../utils/token-utils';

export function useDexQuery() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取 Anchor 程序实例
  const program = useMemo(() => {
    return createProgram(connection, publicKey, signTransaction, signAllTransactions);
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  // 获取池子地址
  const getPoolAddress = useCallback((tokenX: PublicKey, tokenY: PublicKey): PublicKey => {
    return findPoolAddress(tokenX, tokenY);
  }, []);

  // 获取池子信息
  const getPoolInfo = useCallback(async (poolAddress: PublicKey): Promise<any> => {
    if (!program) {
      setError('程序未初始化');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // 使用新的账户名称 'pool'
      const accountInfo = await (program.account as any).pool.fetch(poolAddress);
      
      console.log('✅ 池子信息获取成功:', accountInfo);
      return accountInfo;
    } catch (err) {
      console.error('获取池子信息失败:', err);
      setError(`获取池子信息失败: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program]);

  // 获取所有流动性池
  const getAllPools = useCallback(async (): Promise<Array<PoolInfo>> => {
    if (!program) {
      setError('程序未初始化');
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      const pools: Array<PoolInfo> = [];

      // 使用新的账户名称 'pool'
      const poolAccounts = await (program.account as any).pool.all();
      
      for (const poolAccount of poolAccounts) {
        const poolInfo = poolAccount.account;
        
        // 使用新的字段名称
        let tokenXSymbol = poolInfo.tokenXMint.toBase58().slice(0, 8) + '...';
        let tokenYSymbol = poolInfo.tokenYMint.toBase58().slice(0, 8) + '...';
        
        pools.push({
          address: poolAccount.publicKey.toBase58(),
          // 保持向后兼容
          tokenAMint: poolInfo.tokenXMint.toBase58(),
          tokenBMint: poolInfo.tokenYMint.toBase58(),
          tokenASymbol: tokenXSymbol,
          tokenBSymbol: tokenYSymbol,
          // 新字段
          tokenXMint: poolInfo.tokenXMint.toBase58(),
          tokenYMint: poolInfo.tokenYMint.toBase58(),
          tokenXSymbol,
          tokenYSymbol,
        });
      }

      console.log('✅ 所有流动性池获取成功:', pools);
      return pools;
    } catch (err) {
      console.error('获取所有流动性池失败:', err);
      setError(`获取所有流动性池失败: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [program]);

  // 获取池子储备量
  const getPoolReserves = useCallback(async (poolAddress: PublicKey): Promise<PoolReserves | null> => {
    if (!program) {
      setError('程序未初始化');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // 获取池子信息
      const poolInfo = await (program.account as any).pool.fetch(poolAddress);
      
      // 获取vault地址并查询余额
      const vaultX = poolInfo.vaultX;
      const vaultY = poolInfo.vaultY;
      
      const vaultXAccount = await connection.getTokenAccountBalance(vaultX);
      const vaultYAccount = await connection.getTokenAccountBalance(vaultY);
      
      const tokenXReserve = vaultXAccount.value.uiAmount || 0;
      const tokenYReserve = vaultYAccount.value.uiAmount || 0;

      const reserves: PoolReserves = {
        // 向后兼容
        tokenAReserve: tokenXReserve,
        tokenBReserve: tokenYReserve,
        tokenAMint: poolInfo.tokenXMint.toBase58(),
        tokenBMint: poolInfo.tokenYMint.toBase58(),
        // 新字段
        tokenXReserve,
        tokenYReserve,
        tokenXMint: poolInfo.tokenXMint.toBase58(),
        tokenYMint: poolInfo.tokenYMint.toBase58(),
      };

      console.log('✅ 池子储备量获取成功:', reserves);
      return reserves;
    } catch (err) {
      console.error('获取池子储备量失败:', err);
      setError(`获取池子储备量失败: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, [program, connection]);

  // 获取用户代币余额
  const getUserTokenBalance = useCallback(async (tokenMint: PublicKey): Promise<number> => {
    if (!publicKey || !connection) {
      return 0;
    }

    try {
      // 使用关联代币账户地址
      const [associatedTokenAccount] = PublicKey.findProgramAddressSync(
        [
          publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const balance = await connection.getTokenAccountBalance(associatedTokenAccount);
      const balanceRaw = Number(balance.value.amount);
      
      // 获取代币精度
      const decimals = await getTokenDecimals(connection, tokenMint);
      
      // 转换为人类可读的数量
      const balance_ui = balanceRaw / Math.pow(10, decimals);

      console.log(`✅ 用户代币余额: ${balance_ui} (${tokenMint.toString()})`);
      return balance_ui;
    } catch (err) {
      console.error('获取用户代币余额失败:', err);
      return 0;
    }
  }, [publicKey, connection]);

  // 获取用户 LP 代币余额
  const getUserLpTokenBalance = useCallback(async (lpTokenMint: PublicKey): Promise<number> => {
    return getUserTokenBalance(lpTokenMint);
  }, [getUserTokenBalance]);

  // 获取用户所有代币
  const getUserTokens = useCallback(async (): Promise<Array<{
    mint: string;
    name: string;
    symbol: string;
    balance: number;
    decimals: number;
  }>> => {
    if (!publicKey || !connection) {
      return [];
    }

    try {
      setLoading(true);
      setError(null);

      // 获取用户所有的代币账户
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      );

      const tokens = [];

      for (const tokenAccount of tokenAccounts.value) {
        const accountInfo = tokenAccount.account.data.parsed.info;
        const mint = accountInfo.mint;
        const balance = accountInfo.tokenAmount.uiAmount || 0;
        const decimals = accountInfo.tokenAmount.decimals;

        // 只显示余额大于0的代币
        if (balance > 0) {
          // 尝试获取代币元数据（简化版本）
          let name = `Token ${mint.slice(0, 8)}...`;
          let symbol = mint.slice(0, 4).toUpperCase();

          // 检查是否是SOL wrapped token
          if (mint === 'So11111111111111111111111111111111111111112') {
            name = 'Wrapped SOL';
            symbol = 'WSOL';
          }

          tokens.push({
            mint,
            name,
            symbol,
            balance,
            decimals,
          });
        }
      }

      // 按余额降序排序
      tokens.sort((a, b) => b.balance - a.balance);

      console.log('✅ 用户代币获取成功:', tokens);
      return tokens;
    } catch (err) {
      console.error('获取用户代币失败:', err);
      setError(`获取用户代币失败: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  return {
    loading,
    error,
    getPoolAddress,
    getPoolInfo,
    getAllPools,
    getPoolReserves,
    getUserTokenBalance,
    getUserLpTokenBalance,
    getUserTokens,
  };
} 