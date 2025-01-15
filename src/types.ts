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
}


export interface IPGeoPulse {
    ip: string,
    latitude: string,
    longitude: string,
    isMobile: string,
    city: string,
    state: string,
    zip: string,
    country: {
        code: string,
        name: string,
        capital: string,
        callingCode: string,
        is_eu_member: string,
        flag: {
            svg: string,
            emoji: string,
        },
    },
    continent: {
        name: string,
        code: string
    },
    currency: {
        code: string,
        name: string,
        symbol: string,
        exchangeRate: string,
    },
    timeZone: {
        "name": string,
        localTime: string,
        localTimeUnix: string,
    },
    language: {
        code: string,
        name: string,
    }
}
