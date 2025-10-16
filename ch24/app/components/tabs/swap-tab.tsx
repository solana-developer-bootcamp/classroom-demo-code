"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PublicKey } from "@solana/web3.js"

import { TokenAmountInput } from "@/components/token-amount-input"
import { SlippageSelector } from "@/components/slippage-selector"
import type { Pool } from "@/components/pool-selector"
import { ArrowUpDown, AlertTriangle, Database, Percent } from "lucide-react"
import { useWallet } from "@/components/wallet-provider"
import { CustomPoolSelector } from "@/components/custom-pool-selector"
import { RefreshButton } from "@/components/refresh-button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { useDex } from "@/hooks/use-dex"
import { useDexSwap } from "@/hooks/dex/use-dex-swap"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { TOKEN_SYMBOL_MAP, DEFAULT_SLIPPAGE, ERROR_MESSAGES } from "@/lib/constants"

// 获取代币符号的辅助函数
const getTokenSymbol = (address: string) => {
  return TOKEN_SYMBOL_MAP[address] || address.slice(0, 8) + "..."
}

// Skeleton component for loading state
function SkeletonLoader({ className }: { className?: string }) {
  return <div className={cn("h-4 bg-slate-700/50 rounded animate-pulse", className)} />
}

export function SwapTab() {
  // Hooks
  const { connected, publicKey } = useWallet()
  const { t } = useLanguage()
  const { toast } = useToast()
  const dex = useDex()
  const swapHook = useDexSwap()
  
  // 基础状态
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [swapDirection, setSwapDirection] = useState<"AtoB" | "BtoA">("AtoB")
  const [amountIn, setAmountIn] = useState("")
  const [amountOut, setAmountOut] = useState("")
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE)
  const [priceImpact, setPriceImpact] = useState(0)
  const [swapping, setSwapping] = useState(false) // For swap transaction
  const [calculating, setCalculating] = useState(false)
  
  // 池子相关状态
  const [pools, setPools] = useState<Pool[]>([])
  const [poolsLoading, setPoolsLoading] = useState(false)
  
  // 选中池子的详细信息
  const [poolReserves, setPoolReserves] = useState<{ 
    tokenAReserve: number; 
    tokenBReserve: number;
    tokenAMint: string;
    tokenBMint: string;
  } | null>(null)
  const [userTokenABalance, setUserTokenABalance] = useState<number>(0)
  const [userTokenBBalance, setUserTokenBBalance] = useState<number>(0)
  const [isLoadingPoolDetails, setIsLoadingPoolDetails] = useState(false) // For pool data refresh

  // 获取配置信息
  useEffect(() => {
    if (connected && dex.fetchGlobalConfig) {
      dex.fetchGlobalConfig()
    }
  }, [connected, dex.fetchGlobalConfig])

  // 获取当前交易手续费率
  const getCurrentSwapFeeRate = () => {
    if (dex.globalConfig?.swapFeeRate != null) {
      return dex.globalConfig.swapFeeRate / 10000 // 万分比转换为小数
    }
    return 0.003 // 默认0.3%
  }

  // 格式化手续费显示
  const formatSwapFeeRate = () => {
    const feeRate = getCurrentSwapFeeRate()
    return `${(feeRate * 100).toFixed(1)}%`
  }

  // 自动获取流动性池列表 - 只在连接时获取一次
  useEffect(() => {
    const fetchPools = async () => {
      if (!connected || !dex.getAllPools) return
      
      setPoolsLoading(true)
      try {
        logger.info('🔄 加载流动性池列表...')
        const realPools = await dex.getAllPools()
        
        // 将真实的 PoolInfo 转换为组件需要的 Pool 格式
        const convertedPools: Pool[] = realPools.map((poolInfo) => ({
          address: poolInfo.address,
          tokenA: {
            address: poolInfo.tokenAMint,
            symbol: poolInfo.tokenASymbol || getTokenSymbol(poolInfo.tokenAMint)
          },
          tokenB: {
            address: poolInfo.tokenBMint,
            symbol: poolInfo.tokenBSymbol || getTokenSymbol(poolInfo.tokenBMint)
          },
          reserveA: 0, // 不在这里获取储备量
          reserveB: 0
        }))
        
        setPools(convertedPools)
        logger.info('✅ 已加载', convertedPools.length, '个流动性池')
        
      } catch (error) {
        logger.error('❌ 加载池子失败:', error)
        toast({
          variant: "destructive",
          title: "加载失败",
          description: ERROR_MESSAGES.NETWORK_ERROR,
        })
      } finally {
        setPoolsLoading(false)
      }
    }

    fetchPools()
  }, [connected, dex.getAllPools])

  // 当选中池子改变时，获取该池子的详细信息（包括储备量和用户余额）
  const fetchPoolDetails = async () => {
    if (!selectedPool || !connected) {
      setPoolReserves(null)
      setUserTokenABalance(0)
      setUserTokenBBalance(0)
      setAmountOut("")
      setPriceImpact(0)
      return
    }

    setIsLoadingPoolDetails(true)
    try {
      logger.info('🔄 获取池子详细信息:', selectedPool)
      const poolAddress = new PublicKey(selectedPool)
      
      // 获取池子储备量
      const reserves = await dex.getPoolReserves(poolAddress)
      if (reserves) {
        setPoolReserves({
          tokenAReserve: reserves.tokenAReserve,
          tokenBReserve: reserves.tokenBReserve,
          tokenAMint: reserves.tokenAMint,
          tokenBMint: reserves.tokenBMint
        })
        logger.info('✅ 获取到储备量:', reserves)
        
        // 如果钱包已连接，获取用户代币余额
        if (publicKey && dex.getUserTokenBalance) {
          try {
            const [tokenABalance, tokenBBalance] = await Promise.all([
              dex.getUserTokenBalance(new PublicKey(reserves.tokenAMint)),
              dex.getUserTokenBalance(new PublicKey(reserves.tokenBMint))
            ])
            
            setUserTokenABalance(tokenABalance)
            setUserTokenBBalance(tokenBBalance)
            logger.info('✅ 获取到用户余额:', { tokenA: tokenABalance, tokenB: tokenBBalance })
          } catch (err) {
            logger.error('❌ 获取用户余额失败:', err)
            setUserTokenABalance(0)
            setUserTokenBBalance(0)
          }
        }
      }
    } catch (error) {
      logger.error('❌ 获取池子储备量失败:', error)
      setPoolReserves(null)
      setUserTokenABalance(0)
      setUserTokenBBalance(0)
    } finally {
      setIsLoadingPoolDetails(false)
    }
  }

  // Effect for initial load or when selectedPool changes
  useEffect(() => {
    fetchPoolDetails()
  }, [selectedPool, connected, publicKey])

  const pool = pools.find((p: Pool) => p.address === selectedPool)

  // Get the input and output tokens based on swap direction
  const inputTokenBalance = swapDirection === "AtoB" ? userTokenABalance : userTokenBBalance
  const outputTokenBalance = swapDirection === "AtoB" ? userTokenBBalance : userTokenABalance
  
  // Get token symbols from pool data
  const inputTokenSymbol = swapDirection === "AtoB" ? pool?.tokenA.symbol : pool?.tokenB.symbol
  const outputTokenSymbol = swapDirection === "AtoB" ? pool?.tokenB.symbol : pool?.tokenA.symbol

  // Get the reserves based on swap direction
  const reserveIn = swapDirection === "AtoB" ? poolReserves?.tokenAReserve || 0 : poolReserves?.tokenBReserve || 0
  const reserveOut = swapDirection === "AtoB" ? poolReserves?.tokenBReserve || 0 : poolReserves?.tokenAReserve || 0

  // Calculate the exchange rate
  const exchangeRate = reserveIn && reserveOut ? reserveOut / reserveIn : 0

  // Format the exchange rate for display
  const formatExchangeRate = () => {
    if (!inputTokenSymbol || !outputTokenSymbol || !exchangeRate) return "0"
    return `1 ${inputTokenSymbol} ≈ ${exchangeRate.toFixed(6)} ${outputTokenSymbol}`
  }

  // Calculate the minimum amount out based on slippage
  const minAmountOut = amountOut
    ? (Number.parseFloat(amountOut) * (1 - slippage / 100)).toFixed(6)
    : "0"

  // 计算交换输出 - 当输入金额或交换方向改变时
  useEffect(() => {
    if (isLoadingPoolDetails || !pool || !amountIn || !poolReserves || !connected) {
      if (!isLoadingPoolDetails) {
        // Only clear if not actively refreshing, to avoid flicker
        setAmountOut("")
        setPriceImpact(0)
      }
      return
    }

    const amountInValue = Number.parseFloat(amountIn)
    if (isNaN(amountInValue) || amountInValue <= 0) {
      setAmountOut("")
      setPriceImpact(0)
      return
    }

    const calculateOutput = async () => {
      setCalculating(true)
      try {
        const poolAddress = new PublicKey(pool.address)
        const isAToB = swapDirection === "AtoB"
        
        const result = await swapHook.calculateSwapOutput(
          poolAddress, 
          amountInValue, 
          isAToB,
          dex.getPoolReserves
        )
        
        if (result) {
          setAmountOut(result.expectedOutput.toFixed(6))
          setPriceImpact(result.priceImpact)
        } else {
          // 计算失败时重置
          setAmountOut("")
          setPriceImpact(0)
        }
      } catch (err) {
        logger.error('计算交换输出失败:', err)
        // 计算失败时重置
        setAmountOut("")
        setPriceImpact(0)
      } finally {
        setCalculating(false)
      }
    }

    // 防抖处理
    const debounceTimer = setTimeout(calculateOutput, 500)
    return () => clearTimeout(debounceTimer)
  }, [amountIn, pool, swapDirection, poolReserves, reserveIn, reserveOut, connected, isLoadingPoolDetails, swapHook.calculateSwapOutput, dex.getPoolReserves])

  // Flip the swap direction
  const handleFlipDirection = () => {
    setSwapDirection((prev: "AtoB" | "BtoA") => (prev === "AtoB" ? "BtoA" : "AtoB"))
    setAmountIn("") // Clear amounts on flip
    setAmountOut("")
    // Data doesn't need to be re-fetched, just re-calculated by useEffect
  }

  // Handle refresh button click - 刷新选中池子的详细信息
  const handleUIRefresh = () => {
    fetchPoolDetails()
  }

  // 执行交换
  const handleSwap = async () => {
    if (!pool || !connected || !poolReserves) return
    
    // 防止重复提交
    if (swapping || dex.loading) {
      logger.warn('交换正在进行中，忽略重复请求')
      return
    }

    setSwapping(true) // For swap transaction itself
    try {
      const poolAddress = new PublicKey(pool.address)
      const amountInValue = Number.parseFloat(amountIn)
      const minAmountOutValue = Number.parseFloat(minAmountOut)

      // 获取输入和输出代币的mint地址
      const inputMint = new PublicKey(swapDirection === "AtoB" ? poolReserves.tokenAMint : poolReserves.tokenBMint)
      const outputMint = new PublicKey(swapDirection === "AtoB" ? poolReserves.tokenBMint : poolReserves.tokenAMint)

      logger.info('🔄 开始交换:', {
        pool: poolAddress.toString(),
        amountIn: amountInValue,
        minAmountOut: minAmountOutValue,
        inputMint: inputMint.toString(),
        outputMint: outputMint.toString()
      })

      const result = await swapHook.swap(poolAddress, amountInValue, minAmountOutValue, swapDirection === "AtoB")
      
      if (result) {
        toast({
          variant: "success",
          title: t.swap.swapSuccess,
          description: t.swap.swapSuccessDesc
            .replace("{0}", amountIn)
            .replace("{1}", inputTokenSymbol || "")
            .replace("{2}", amountOut)
            .replace("{3}", outputTokenSymbol || ""),
        })

        // Reset form after successful swap
        setAmountIn("")
        setAmountOut("")
        
        // 刷新池子详细信息
        setTimeout(() => {
          fetchPoolDetails()
        }, 2000)
      } else {
        throw new Error("交易失败")
      }
    } catch (error) {
      logger.error('❌ 交换失败:', error)
      
      // 特殊处理重复交易错误
      const errorMessage = error instanceof Error ? error.message : String(error)
      let userFriendlyMessage: string = ERROR_MESSAGES.TRANSACTION_FAILED
      
      if (errorMessage.includes('already been processed')) {
        userFriendlyMessage = "交易可能已经被处理过，请检查您的余额或刷新页面"
      } else if (errorMessage.includes('insufficient')) {
        userFriendlyMessage = "余额不足，请检查您的代币余额"
      } else if (errorMessage.includes('slippage')) {
        userFriendlyMessage = "滑点过大，请调整滑点设置或减少交易数量"
      }
      
      toast({
        variant: "destructive",
        title: t.swap.swapError,
        description: userFriendlyMessage,
      })
    } finally {
      setSwapping(false)
    }
  }

  const isSwapDisabled = () => {
    if (isLoadingPoolDetails || !connected || !pool) return true
    if (!amountIn || !amountOut) return true
    if (Number.parseFloat(amountIn) <= 0) return true
    if (calculating) return true
    return Number.parseFloat(amountIn) > inputTokenBalance
  }

  const getSwapButtonText = () => {
    if (isLoadingPoolDetails) return t.common.loading
    if (!connected) return t.common.connectWallet
    if (!pool) return t.common.selectPool
    if (!amountIn) return t.common.inputAmount
    if (calculating) return t.common.loading
    if (Number.parseFloat(amountIn) > inputTokenBalance) return t.common.insufficientBalance
    return t.swap.swap
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-fuchsia-500">
          {t.swap.title}
        </h3>
        <RefreshButton
          onClick={handleUIRefresh}
          disabled={!selectedPool}
          loading={isLoadingPoolDetails}
        />
      </div>

      <CustomPoolSelector
        value={selectedPool}
        onChange={(value) => {
          setSelectedPool(value)
          // Data refresh will be triggered by useEffect watching selectedPool
        }}
        pools={pools}
        loading={poolsLoading}
      />

      {pool && (
        <>
          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="p-3 space-y-2">
              {/* Pool Address & Exchange Rate */}
              <div className="flex justify-between items-center text-xs text-slate-400">
                <div className="truncate">
                  {t.swap.poolAddress}:{" "}
                  {isLoadingPoolDetails ? (
                    <SkeletonLoader className="w-20 inline-block ml-1" />
                  ) : (
                    <span className="font-mono">{`${pool.address.slice(0, 4)}...${pool.address.slice(-4)}`}</span>
                  )}
                </div>
                <div className="text-right whitespace-nowrap">
                  {isLoadingPoolDetails ? <SkeletonLoader className="w-32 inline-block ml-1" /> : formatExchangeRate()}
                </div>
              </div>

              {/* Divider and Info Section */}
              <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
                {/* Token A Reserve */}
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-violet-400" />
                    <span>{t.swap.reserve.replace("{0}", pool.tokenA.symbol)}:</span>
                  </div>
                  {isLoadingPoolDetails ? (
                    <SkeletonLoader className="w-24" />
                  ) : (
                    <span className="text-slate-200 font-medium">
                      {poolReserves?.tokenAReserve?.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                      {pool.tokenA.symbol}
                    </span>
                  )}
                </div>

                {/* Token B Reserve */}
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-fuchsia-400" />
                    <span>{t.swap.reserve.replace("{0}", pool.tokenB.symbol)}:</span>
                  </div>
                  {isLoadingPoolDetails ? (
                    <SkeletonLoader className="w-28" />
                  ) : (
                    <span className="text-slate-200 font-medium">
                      {poolReserves?.tokenBReserve?.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                      {pool.tokenB.symbol}
                    </span>
                  )}
                </div>

                {/* Trading Fee */}
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-sky-400" />
                    <span>{t.swap.tradingFee}:</span>
                  </div>
                  {isLoadingPoolDetails ? (
                    <SkeletonLoader className="w-16" />
                  ) : (
                    <span className="text-slate-200 font-medium">{formatSwapFeeRate()}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-slate-300">{t.swap.from}</div>
              {inputTokenSymbol && (
                <div className="text-xs text-slate-400">
                  {`${t.common.balance}:`}{" "}
                  {isLoadingPoolDetails ? (
                    <SkeletonLoader className="w-16 inline-block" />
                  ) : (
                    `${inputTokenBalance.toLocaleString()} ${inputTokenSymbol}`
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-grow">
                <TokenAmountInput
                  value={amountIn}
                  onChange={setAmountIn}
                  max={inputTokenBalance}
                  decimals={6}
                  showMaxButton
                  onMaxClick={() => {
                    setAmountIn(inputTokenBalance.toFixed(6))
                  }}
                  disabled={isLoadingPoolDetails}
                />
              </div>
              <div className="w-1/3">
                {inputTokenSymbol && (
                  <Button
                    variant="outline"
                    className="w-full h-full bg-slate-800/50 border-slate-700 text-slate-200"
                    disabled
                  >
                    <div className="flex items-center">
                      {isLoadingPoolDetails ? <SkeletonLoader className="w-10" /> : <span>{inputTokenSymbol}</span>}
                    </div>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFlipDirection}
              disabled={isLoadingPoolDetails}
              className="h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:text-violet-300 hover:bg-slate-700 transition-colors"
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="sr-only">{t.swap.switchDirection || "切换方向"}</span>
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-slate-300">{t.swap.to}</div>
              {outputTokenSymbol && (
                <div className="text-xs text-slate-400">
                  {`${t.common.balance}:`}{" "}
                  {isLoadingPoolDetails ? (
                    <SkeletonLoader className="w-16 inline-block" />
                  ) : (
                    `${outputTokenBalance.toLocaleString()} ${outputTokenSymbol}`
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-grow relative">
                <TokenAmountInput
                  value={isLoadingPoolDetails ? "" : amountOut} // Show empty during refresh for amountOut
                  onChange={() => {}} // Read-only
                  decimals={6}
                  disabled
                  placeholder={isLoadingPoolDetails ? "" : "0.0"}
                  className={calculating || isLoadingPoolDetails ? "bg-slate-700/30 animate-pulse" : ""}
                />
                {isLoadingPoolDetails && !amountOut && (
                  <SkeletonLoader className="absolute inset-0 m-px rounded-md border border-transparent" />
                )}
              </div>
              <div className="w-1/3">
                {outputTokenSymbol && (
                  <Button
                    variant="outline"
                    className="w-full h-full bg-slate-800/50 border-slate-700 text-slate-200"
                    disabled
                  >
                    <div className="flex items-center">
                      {isLoadingPoolDetails ? <SkeletonLoader className="w-10" /> : <span>{outputTokenSymbol}</span>}
                    </div>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <SlippageSelector
              value={slippage}
              onChange={(value) => {
                setSlippage(value)
              }}
            />
            <div className="text-xs text-slate-400">
              {isLoadingPoolDetails ? (
                <SkeletonLoader className="w-32" />
              ) : (
                `${t.swap.minReceived}: ${minAmountOut} ${outputTokenSymbol || ""}`
              )}
            </div>
          </div>

          {!isLoadingPoolDetails && priceImpact > 0 && (
            <div className={cn("text-xs flex items-center", priceImpact > 5 ? "text-red-400" : "text-amber-400")}>
              {priceImpact > 5 && <AlertTriangle className="h-3 w-3 mr-1" />}
              {t.swap.priceImpact}: {priceImpact.toFixed(2)}%{priceImpact > 5 && ` (${t.swap.highPriceImpact})`}
            </div>
          )}
          {isLoadingPoolDetails && <SkeletonLoader className="w-40 h-3" />}

          <Button
            onClick={handleSwap}
            disabled={isSwapDisabled() || swapping || dex.loading}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
          >
            {swapping || dex.loading ? t.common.processing : getSwapButtonText()}
          </Button>
        </>
      )}
    </div>
  )
}
