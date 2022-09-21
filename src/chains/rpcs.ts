import {INetworksProviders, ProvidersRegistry} from '@hovoh/evmcontractsregistry'
import axios from 'axios'

export type ChainsResponse = ChainInfo[]

export interface ChainInfo {
  name: string
  chain: string
  icon: string
  rpc: string[]
  faucets: any[]
  nativeCurrency: NativeCurrency
  infoURL: string
  shortName: string
  chainId: number
  networkId: number
  slip44: number
  ens: Ens
  explorers: Explorer[]
}

export interface NativeCurrency {
  name: string
  symbol: string
  decimals: number
}

export interface Ens {
  registry: string
}

export interface Explorer {
  name: string
  url: string
  standard: string
}

export class ChainidRPCProvider extends ProvidersRegistry {
  async init(infuraKey: string) {
    const response = await axios.get<ChainsResponse>('https://chainid.network/chains.json')

    // eslint-disable-next-line unicorn/no-array-reduce
    this.networks = response.data.reduce((acc, chain) => {
      acc[chain.chainId] = {
        httpRpc: chain.rpc.map(url => url.replace('${INFURA_API_KEY}', infuraKey)),
        wsRpc: [],
      }
      return acc
    }, {} as INetworksProviders)
  }
}
