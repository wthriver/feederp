export const CURRENCY = {
    symbol: '৳',
    code: 'BDT',
    name: 'Bangladeshi Taka',
    locale: 'bn-BD'
}

export function formatCurrency(amount, decimals = 0) {
    if (amount == null || isNaN(amount)) return `${CURRENCY.symbol}0`
    return `${CURRENCY.symbol}${Number(amount).toLocaleString('bn-BD', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}