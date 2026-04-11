import ExcelJS from 'exceljs'
import { format } from 'date-fns'

export async function exportToExcel(data, columns, filename = 'export') {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Data')

    // Add headers
    const headerRow = worksheet.addRow(columns.map(col => col.label || col.key))
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
    }
    headerRow.alignment = { horizontal: 'center' }

    // Add data rows
    data.forEach(item => {
        const row = columns.map(col => {
            const value = item[col.key]
            if (col.format === 'date' && value) {
                return format(new Date(value), 'dd-MM-yyyy')
            }
            if (col.format === 'currency' && value) {
                return Number(value).toFixed(2)
            }
            return value ?? ''
        })
        worksheet.addRow(row)
    })

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 10
        column.eachCell?.({ emoji: true }, cell => {
            const length = cell.value?.toString().length || 0
            if (length > maxLength) maxLength = length
        })
        column.width = Math.min(maxLength + 2, 50)
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Download
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
}

export async function exportToPDF(data, columns, title = 'Report') {
    // Using browser's print functionality for simplicity
    // In production, use a proper PDF library like jsPDF
    const printWindow = window.open('', '_blank')
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #1a5fb4; text-align: center; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background: #1a5fb4; color: white; }
                tr:nth-child(even) { background: #f9f9f9; }
                .footer { margin-top: 20px; text-align: right; font-size: 10px; color: #666; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <table>
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col.label || col.key}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            ${columns.map(col => `<td>${item[col.key] ?? ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">Generated on ${new Date().toLocaleString()}</div>
            <script>window.print()</script>
        </body>
        </html>
    `
    
    printWindow.document.write(html)
    printWindow.document.close()
}