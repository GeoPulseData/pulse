import type { IPGeoPulse, IPRecord } from './types.js'
import { findIPData, loadData, readData } from './utils.js'
import fs from 'node:fs/promises'

export let ipRanges: IPRecord[] | undefined

export async function geoPulse(ip: string): Promise<IPGeoPulse | undefined> {
    if (!ipRanges) {
        ipRanges = await readData('ip-ranges.json')
    }

    if (!ipRanges) {
        await loadData(localLoader)

        ipRanges = await readData('ip-ranges.json')
    }

    if (!ipRanges) {
        return
    }

    if (ipRanges.length > 0) {
        return findIPData(ip, ipRanges)
    }

    // If IP isn't in the RIPE or APNIC range, check ARIN
    // const whoisData = await fetchARINWHOIS(ip)
    // console.log('whois ->', whoisData)
    // if (whoisData && !Array.isArray(whoisData)) {
    //     return whoisData;
    // }

    return
}

function localLoader() {
    return fs.cp('../ip-ranges.json', './ip-ranges.json')
}

function cloudLoader() {
    // TODO
}

const x = {
    'continent': {
        'code': 'EU',
        'geonameId': 6255148,
        'names': {
            'de': 'Europa',
            'en': 'Europe',
            'es': 'Europa',
            'fr': 'Europe',
            'ja': 'ヨーロッパ',
            'pt-BR': 'Europa',
            'ru': 'Европа',
            'zh-CN': '欧洲'
        }
    },
    'country': {
        'geonameId': 798549,
        'isInEuropeanUnion': true,
        'isoCode': 'RO',
        'names': {
            'de': 'Rumänien',
            'en': 'Romania',
            'es': 'Rumanía',
            'fr': 'Roumanie',
            'ja': 'ルーマニア',
            'pt-BR': 'Romênia',
            'ru': 'Румыния',
            'zh-CN': '罗马尼亚'
        }
    },
    'registeredCountry': {
        'geonameId': 798549,
        'isInEuropeanUnion': true,
        'isoCode': 'RO',
        'names': {
            'de': 'Rumänien',
            'en': 'Romania',
            'es': 'Rumanía',
            'fr': 'Roumanie',
            'ja': 'ルーマニア',
            'pt-BR': 'Romênia',
            'ru': 'Румыния',
            'zh-CN': '罗马尼亚'
        }
    },
    'traits': {
        'isAnonymous': false,
        'isAnonymousProxy': false,
        'isAnonymousVpn': false,
        'isAnycast': false,
        'isHostingProvider': false,
        'isLegitimateProxy': false,
        'isPublicProxy': false,
        'isResidentialProxy': false,
        'isSatelliteProvider': false,
        'isTorExitNode': false,
        'ipAddress': '86.120.70.185',
        'network': '86.120.64.0/21'
    },
    'city': {
        'geonameId': 683506,
        'names': {
            'de': 'Bukarest',
            'en': 'Bucharest',
            'es': 'Bucarest',
            'fr': 'Bucarest',
            'ja': 'ブカレスト',
            'pt-BR': 'Bucareste',
            'ru': 'Бухарест',
            'zh-CN': '布加勒斯特'
        }
    },
    'location': {
        'accuracyRadius': 200,
        'latitude': 44.4946,
        'longitude': 26.0578,
        'timeZone': 'Europe/Bucharest'
    },
    'postal': {
        'code': '014132'
    },
    'subdivisions': [
        {
            'geonameId': 683504,
            'isoCode': 'B',
            'names': {
                'en': 'București',
                'fr': 'Bucarest'
            }
        }
    ]
}
