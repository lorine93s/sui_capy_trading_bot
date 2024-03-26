import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import { Keypair } from '@mysten/sui.js/cryptography'
import { SuiSupportedNetworks, rammSuiConfigs } from '@ramm/ramm-sui-sdk'

import { Capybot } from './capybot'
import { Coin, Assets } from './coins'
import { CetusPool } from './dexs/cetus/cetus'
import { Arbitrage } from './strategies/arbitrage'
import { RAMMPool } from './dexs/ramm-sui/ramm-sui'

// Convenience map from name to address for commonly used coins
export const coins = {
    SUI: '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    USDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    CETUS: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
    CETUS0: '0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
    BRT: '0x5580c843b6290acb2dbc7d5bf8ab995d4d4b6ba107e2a283b4d481aab1564d68::brt::BRT',
    WETH: '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
    TOCE: '0xd2013e206f7983f06132d5b61f7c577638ff63171221f4f600a98863febdfb47::toce::TOCE',
    USDT: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN',
    WBTC: '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN',
}

// Setup default amount to trade for each token in each pool. Set to approximately 0.1 USD each.
export const defaultAmount: Record<string, number> = {}
defaultAmount[coins.SUI] = 100_000_000
defaultAmount[coins.USDC] = 100_000
defaultAmount[coins.CETUS] = 1_500_000_000
defaultAmount[coins.CETUS0] = 1_500_000_000
defaultAmount[coins.BRT] = 15_000_000_000_000
defaultAmount[coins.WETH] = 10_000
defaultAmount[coins.TOCE] = 10_000_000_000
defaultAmount[coins.USDT] = 100_000
defaultAmount[coins.WBTC] = 300

// A conservative upper limit on the max gas price per transaction block in SUI
export const MAX_GAS_PRICE_PER_TRANSACTION = 4_400_000

const RIDE_THE_TREND_LIMIT = 1.000005
// Arbitrage threshold - 0.05%, or above
const ARBITRAGE_RELATIVE_LIMIT = 1.0005
const MARKET_DIFFERENCE_LIMIT = 1.01

// Setup wallet from passphrase.
const cetusUsdcSuiPhrase = process.env.CETUS_SUI_USDC_ADMIN_PHRASE
export const cetusUsdcSuiKeypair = Ed25519Keypair.deriveKeypair(cetusUsdcSuiPhrase!)

const rammUsdcSuiPhrase = process.env.RAMM_SUI_USDC_ADMIN_PHRASE
export const rammUsdcSuiKeypair = Ed25519Keypair.deriveKeypair(rammUsdcSuiPhrase!)

enum SupportedPools {
    Cetus,
    RAMM
}

type PoolData = {
    address: string,
    keypair: Keypair
}

export const poolAddresses: { [key in SupportedPools]: Record<string, PoolData> } = {
    [SupportedPools.Cetus]: {
        "SUI/USDC": {
            address: "0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630",
            keypair: cetusUsdcSuiKeypair
        }
    },
    [SupportedPools.RAMM]: {
        "SUI/USDC": {
            address: "0x4ee5425220bc12f2ff633d37b1dc1eb56cc8fd96b1c72c49bd4ce6e895bd6cd7",
            keypair: rammUsdcSuiKeypair
        }
    }
}


let capybot = new Capybot('mainnet')

const cetusUSDCtoSUI = new CetusPool(
    '0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630',
    Assets.USDC,
    Assets.SUI,
    cetusUsdcSuiKeypair,
    'mainnet'
)

const rammUSDCtoSUI = new RAMMPool(
    rammSuiConfigs[SuiSupportedNetworks.mainnet][0],
    '0x4ee5425220bc12f2ff633d37b1dc1eb56cc8fd96b1c72c49bd4ce6e895bd6cd7',
    Assets.USDC,
    Assets.SUI,
    rammUsdcSuiKeypair,
    'mainnet'
)

/* const rammSUItoUSDT = new RAMMPool(
    rammSuiConfigs[SuiSupportedNetworks.mainnet][0],
    '0x4ee5425220bc12f2ff633d37b1dc1eb56cc8fd96b1c72c49bd4ce6e895bd6cd7',
    coins.SUI,
    coins.USDT,
    'mainnet'
) */

capybot.addPool(cetusUSDCtoSUI, cetusUsdcSuiKeypair)
capybot.addPool(rammUSDCtoSUI, rammUsdcSuiKeypair)
// TODO: fix the way `capybot` stores pool information, so that a RAMM pool with over 2 assets
// can be added more than once e.g. for its `SUI/USDC` and `SUI/USDT` pairs.
// FIXED, although the below still needs its own keypair loaded with SUI and USDT to work.
//capybot.addPool(rammSUItoUSDT)

console.log('CETUS UUID: ' +  cetusUSDCtoSUI.uuid);
console.log('RAMM UUID: ' + rammUSDCtoSUI.uuid);



// Add arbitrage strategy: SUI/USDC -> USDC/SUI
capybot.addStrategy(
    new Arbitrage(
        [
            {
                poolUuid: cetusUSDCtoSUI.uuid,
                coinA: cetusUSDCtoSUI.coinA,
                coinB: cetusUSDCtoSUI.coinB,
                a2b: false,
            },
            {
                poolUuid: rammUSDCtoSUI.uuid,
                coinA: rammUSDCtoSUI.coinA,
                coinB: rammUSDCtoSUI.coinB,
                a2b: true,
            }
        ],
        defaultAmount[coins.SUI],
        ARBITRAGE_RELATIVE_LIMIT,
        'Arbitrage: SUI -CETUS-> USDC -RAMM-> SUI'
    )
)

// Start the bot
capybot.loop(3.6e6, 1000)
