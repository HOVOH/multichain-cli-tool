import {Command, Flags} from '@oclif/core'
import axios from 'axios'
import {initOpenZeppelinAPI} from '@hovoh/openzeppelin-api'
import {ChainidRPCProvider} from '../chains/rpcs'
import {BigNumber} from 'ethers'
import {formatUnits} from 'ethers/lib/utils'

import * as dotenv from 'dotenv'
dotenv.config()

interface ChainIdResponse {
  [chainId: string]: {
    [tokenId: string]:{
      srcChainID: string
      destChainID: string
      logoUrl: string
      name: string
      symbol: string
      pairid: string
      SrcToken: SrcToken
      DestToken: DestToken
    }
  }
}

export interface SrcToken {
  ID: string
  Name: string
  Symbol: string
  Decimals: number
  Description: string
  DepositAddress: string
  DcrmAddress: string
  ContractAddress: string
  MaximumSwap: number
  MinimumSwap: number
  BigValueThreshold: number
  SwapFeeRate: number
  MaximumSwapFee: number
  MinimumSwapFee: number
  PlusGasPricePercentage: number
  DisableSwap: boolean
  IsDelegateContract: boolean
  BaseFeePercent: number
  routerABI: string
}

export interface DestToken {
  routerABI: string
  ID: string
  Name: string
  Symbol: string
  Decimals: number
  Description: string
  DcrmAddress: string
  ContractAddress: string
  MaximumSwap: number
  MinimumSwap: number
  BigValueThreshold: number
  SwapFeeRate: number
  MaximumSwapFee: number
  MinimumSwapFee: number
  PlusGasPricePercentage: number
  DisableSwap: boolean
  IsDelegateContract: boolean
  BaseFeePercent: number
}

export default class Backing extends Command {
  static description = 'Calculates backing for a token'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    // flag with a value (-n, --name=VALUE)
    name: Flags.string({char: 'n', description: 'regex pattern for the search filter'}),
    symbol: Flags.string({char: 's', description: 'symbol for the token'}),
    // flag with no value (-f, --force)
    // force: Flags.boolean({char: 'f'}),
  }

  static args = [{name: 'file'}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Backing)

    this.log('Querying https://bridgeapi.anyswap.exchange/v2/serverInfo/chainid')
    const response = await axios.get<ChainIdResponse>('https://bridgeapi.anyswap.exchange/v2/serverInfo/chainid')
    const targetTokens = Object.values(response.data)
    .flatMap(chain => Object.values(chain))
    .filter(token => token.symbol === flags.symbol)
    const provider = new ChainidRPCProvider()
    await provider.init(process.env.INFURA_API_KEY as string)
    const ozApi = initOpenZeppelinAPI(provider)
    this.log(`Found token ${flags.symbol} on networks ${targetTokens.map(token => token.destChainID + ' <- ' + token.srcChainID).join(', ')}`)
    let sumSrc = BigNumber.from('0')
    let sumDest = BigNumber.from('0')
    for (const tokenPair of targetTokens) {
      this.log(`--- Querying pair ${tokenPair.srcChainID} -> ${tokenPair.destChainID} ---`)
      const srcContract = ozApi.forNetwork(Number(tokenPair.srcChainID)).getContractInstance('ERC20', tokenPair.SrcToken.ContractAddress)
      // eslint-disable-next-line no-await-in-loop
      const srcBalance = await srcContract.balanceOf(tokenPair.SrcToken.DepositAddress)
      sumSrc = sumSrc.add(srcBalance)
      const destContract = ozApi.forNetwork(Number(tokenPair.destChainID)).getContractInstance('ERC20', tokenPair.DestToken.ContractAddress)
      // eslint-disable-next-line no-await-in-loop
      const destBalance = await destContract.totalSupply()
      sumDest = sumDest.add(destBalance)
      this.log('Token balances:')
      this.log(`Destination ${tokenPair.destChainID}: ${formatUnits(destBalance, tokenPair.DestToken.Decimals)}`)
      this.log(`Source ${tokenPair.destChainID}: ${formatUnits(srcBalance, tokenPair.SrcToken.Decimals)}`)
      this.log(`Delta: ${srcBalance.gt(destBalance) ? '+' + formatUnits(srcBalance.sub(destBalance)) : '-' + formatUnits(destBalance.sub(srcBalance))}`)
    }

    this.log('--- Total balances ---')
    this.log(`On sources: ${formatUnits(sumSrc, 18)}`)
    this.log(`On destinations: ${formatUnits(sumDest, 18)}`)
    this.log(`Delta: ${sumSrc.gt(sumDest) ? '+' + formatUnits(sumSrc.sub(sumDest)) : '-' + formatUnits(sumDest.sub(sumSrc))}`)
  }
}
