export interface IPRecord {
    start: string
    end: string
    country: string
}


export interface IPGeoPulse {
    ip: string

    country?: {
        code: string
        name: string
        capital: string
        continentName: string
    }

    currency?: {
        code: string
        name: string
        symbol: string
    }
}
