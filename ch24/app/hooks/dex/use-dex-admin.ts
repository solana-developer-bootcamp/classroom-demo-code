import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useState, useCallback, useMemo } from 'react';
import { createProgram } from '../utils/program-utils';
import { findConfigAddress } from '../utils/address-utils';
import type { GlobalConfig } from '../types/dex-types';

export function useDexAdmin() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);

  // 获取 Anchor 程序实例
  const program = useMemo(() => {
    return createProgram(connection, publicKey, signTransaction, signAllTransactions);
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  // 初始化配置 (新方法名)
  const initializeConfig = useCallback(async (
    swapFeeRate: number,
    protocolFeeRate: number,
    treasury?: PublicKey
  ): Promise<string> => {
    if (!program || !publicKey) {
      setError('程序未初始化或钱包未连接');
      return '';
    }

    setLoading(true);
    setError(null);

    try {
      const config = findConfigAddress();
      
      // 如果没有提供treasury，使用当前用户公钥
      const treasuryToUse = treasury || publicKey;
      
      const transaction = await program.methods
        .initializeConfig(swapFeeRate, protocolFeeRate)
        .accounts({
          payer: publicKey,
          authority: publicKey,
          treasury: treasuryToUse,
          config: config,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // 检查provider是否存在
      if (!program.provider || !program.provider.sendAndConfirm) {
        throw new Error('程序provider未正确初始化');
      }

      const tx = await program.provider.sendAndConfirm(transaction, [], {
        commitment: 'confirmed',
      });

      console.log("✅ 配置初始化成功, 交易ID:", tx);
      return tx;
    } catch (err) {
      console.error('初始化配置失败:', err);
      setError(`初始化配置失败: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  // 更新配置 (新方法)
  const updateConfigBasic = useCallback(async (
    swapFeeRate: number,
    protocolFeeRate: number,
    isPaused: boolean
  ): Promise<string> => {
    if (!program || !publicKey) {
      setError('程序未初始化或钱包未连接');
      return '';
    }

    setLoading(true);
    setError(null);

    try {
      const config = findConfigAddress();
      
      const transaction = await program.methods
        .updateConfigBasic(swapFeeRate, protocolFeeRate, isPaused)
        .accounts({
          authority: publicKey,
          config: config,
        })
        .transaction();

      // 检查provider是否存在
      if (!program.provider || !program.provider.sendAndConfirm) {
        throw new Error('程序provider未正确初始化');
      }

      const tx = await program.provider.sendAndConfirm(transaction, [], {
        commitment: 'confirmed',
      });

      console.log("✅ 配置更新成功, 交易ID:", tx);
      return tx;
    } catch (err) {
      console.error('更新配置失败:', err);
      setError(`更新配置失败: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  // 更新权限
  const updateAuthority = useCallback(async (newAuthority: PublicKey): Promise<string> => {
    if (!program || !publicKey) {
      setError('程序未初始化或钱包未连接');
      return '';
    }

    setLoading(true);
    setError(null);

    try {
      const config = findConfigAddress();
      
      const transaction = await program.methods
        .updateAuthority()
        .accounts({
          authority: publicKey,
          newAuthority: newAuthority,
          config: config,
        })
        .transaction();

      // 检查provider是否存在
      if (!program.provider || !program.provider.sendAndConfirm) {
        throw new Error('程序provider未正确初始化');
      }

      const tx = await program.provider.sendAndConfirm(transaction, [], {
        commitment: 'confirmed',
      });

      console.log("✅ 权限更新成功, 交易ID:", tx);
      return tx;
    } catch (err) {
      console.error('更新权限失败:', err);
      setError(`更新权限失败: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  // 更新treasury
  const updateTreasury = useCallback(async (newTreasury: PublicKey): Promise<string> => {
    if (!program || !publicKey) {
      setError('程序未初始化或钱包未连接');
      return '';
    }

    setLoading(true);
    setError(null);

    try {
      const config = findConfigAddress();
      
      const transaction = await program.methods
        .updateTreasury()
        .accounts({
          authority: publicKey,
          newTreasury: newTreasury,
          config: config,
        })
        .transaction();

      // 检查provider是否存在
      if (!program.provider || !program.provider.sendAndConfirm) {
        throw new Error('程序provider未正确初始化');
      }

      const tx = await program.provider.sendAndConfirm(transaction, [], {
        commitment: 'confirmed',
      });

      console.log("✅ Treasury更新成功, 交易ID:", tx);
      return tx;
    } catch (err) {
      console.error('更新Treasury失败:', err);
      setError(`更新Treasury失败: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  // 获取配置状态
  const fetchGlobalConfig = useCallback(async (): Promise<void> => {
    if (!program) {
      setError('程序未初始化');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const config = findConfigAddress();
      
      // 使用新的账户名 'config'
      const configAccount = await (program.account as any).config.fetch(config);
      
      const globalConfigData: GlobalConfig = {
        admin: configAccount.authority.toString(),
        protocolFeeAccount: configAccount.treasury.toString(),
        swapFeeRate: configAccount.swapFeeRate,
        protocolFeeRate: configAccount.protocolFeeRate,
        isPaused: configAccount.isPaused,
      };

      setGlobalConfig(globalConfigData);
      console.log("✅ 配置获取成功:", globalConfigData);
    } catch (err) {
      console.error('获取配置失败:', err);
      setError(`获取配置失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [program]);

  return {
    loading,
    error,
    globalConfig,
    initializeConfig,
    updateConfigBasic,
    updateAuthority,
    updateTreasury,
    fetchGlobalConfig,
  };
} 