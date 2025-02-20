export interface IPv4Record extends IPRecord {
    startNum: number
    endNum: number
}

export interface IPv6Record extends IPRecord {
    startNum: bigint
    endNum: bigint
}

export interface IPRecord {
    start: string
    end: string
    country: string
    asn?:{
        id: number,
        name: string,
        cidr: string
        country: string
    }
}

export interface Country {
    name: string
    code: string
    capital: string
    callingCode: string
    isEUMember: boolean
    currency?: {
        code: string;
        name: string;
        symbol: string;
    };
    flag: {
        svg: string;
        emoji: string
    }
    continent: {
        name: string;
        code: string;
    }
    language: {
        name: string;
        code: string
    }
}

export interface IPGeoPulse {
    ip: string,

    latitude?: string,
    longitude?: string,
    isMobile?: string,
    city?: string,
    state?: string,
    zip?: string,

    country: Country,
    exchangeRateBaseCurrency?: string,
    exchangeRate?: number,
    timeZone?: {
        name: string,
        localTime: string,
        localTimeUnix: string,
    },
    asn?: IPRecord['asn']
}
