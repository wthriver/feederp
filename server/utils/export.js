const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function generatePDFReport(title, headers, data, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.fontSize(16).text(title, { align: 'center' });
            doc.moveDown();
            
            if (options.subtitle) {
                doc.fontSize(10).text(options.subtitle, { align: 'center' });
                doc.moveDown();
            }

            if (options.dateRange) {
                doc.fontSize(8).text(options.dateRange, { align: 'center' });
                doc.moveDown();
            }

            doc.moveDown();

            const startX = 30;
            let startY = doc.y;
            const colWidths = options.columnWidths || headers.map(() => 100);

            doc.fontSize(9).font('Helvetica-Bold');
            let xPos = startX;
            headers.forEach((header, i) => {
                doc.text(header, xPos, startY, { width: colWidths[i], align: 'left' });
                xPos += colWidths[i];
            });

            startY += 15;
            doc.moveTo(startX, startY - 5).lineTo(doc.page.width - 30, startY - 5).stroke();

            doc.font('Helvetica').fontSize(8);
            data.forEach((row, rowIndex) => {
                if (startY > doc.page.height - 50) {
                    doc.addPage();
                    startY = 30;
                }

                xPos = startX;
                let values = Object.values(row);
                if (options.excludeColumns) {
                    values = values.filter((_, idx) => !options.excludeColumns.includes(headers[idx]));
                }

                values.forEach((val, i) => {
                    const formatted = formatValue(val, options.formatters?.[headers[i]]);
                    doc.text(String(formatted), xPos, startY, { width: colWidths[i], align: 'left' });
                    xPos += colWidths[i];
                });

                startY += 15;
            });

            doc.moveDown();
            doc.fontSize(8).text(
                `Generated on: ${new Date().toLocaleString()}`,
                30,
                doc.page.height - 30
            );

            if (options.footer) {
                doc.text(options.footer, 30, doc.page.height - 45);
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function formatValue(value, formatter) {
    if (value === null || value === undefined) return '-';
    if (formatter === 'currency') return `₹${parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (formatter === 'number') return parseFloat(value).toLocaleString('en-IN');
    if (formatter === 'percentage') return `${parseFloat(value).toFixed(2)}%`;
    if (formatter === 'date') return new Date(value).toLocaleDateString('en-IN');
    return String(value);
}

async function generateExcelReport(title, headers, data, options = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FeedMill ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(options.sheetName || 'Report');

    sheet.mergeCells('A1:' + String.fromCharCode(65 + headers.length - 1) + '1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    if (options.subtitle) {
        sheet.mergeCells('A2:' + String.fromCharCode(65 + headers.length - 1) + '2');
        const subtitleCell = sheet.getCell('A2');
        subtitleCell.value = options.subtitle;
        subtitleCell.font = { size: 10 };
        subtitleCell.alignment = { horizontal: 'center' };
    }

    const headerRow = sheet.addRow(options.subtitle ? 3 : 2);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    data.forEach((row, rowIndex) => {
        const dataRow = sheet.addRow();
        let values = Object.values(row);
        if (options.excludeColumns) {
            values = values.filter((_, idx) => !options.excludeColumns.includes(headers[idx]));
        }

        values.forEach((val, colIndex) => {
            const cell = dataRow.getCell(colIndex + 1);
            const formatter = options.formatters?.[headers[colIndex]];
            
            if (formatter === 'currency') {
                cell.value = parseFloat(val) || 0;
                cell.numFmt = '₹#,##0.00';
            } else if (formatter === 'number') {
                cell.value = parseFloat(val) || 0;
                cell.numFmt = '#,##0';
            } else if (formatter === 'percentage') {
                cell.value = parseFloat(val) || 0;
                cell.numFmt = '0.00%';
            } else if (formatter === 'date') {
                cell.value = val ? new Date(val) : '';
                cell.numFmt = 'dd/mm/yyyy';
            } else {
                cell.value = val || '-';
            }

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    if (options.columnWidths) {
        options.columnWidths.forEach((width, index) => {
            sheet.getColumn(index + 1).width = width;
        });
    } else {
        sheet.columns.forEach(column => {
            column.width = 15;
        });
    }

    if (options.addTotals && data.length > 0) {
        const lastRow = sheet.addRow();
        lastRow.font = { bold: true };
        lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

        const firstCol = lastRow.getCell(1);
        firstCol.value = 'Total';
        
        Object.keys(data[0]).forEach((key, index) => {
            const cell = lastRow.getCell(index + 2);
            const formatter = options.formatters?.[key];
            if (formatter === 'currency' || formatter === 'number') {
                const sum = data.reduce((acc, row) => acc + (parseFloat(row[key]) || 0), 0);
                cell.value = sum;
                if (formatter === 'currency') {
                    cell.numFmt = '₹#,##0.00';
                } else {
                    cell.numFmt = '#,##0';
                }
            }
        });
    }

    return workbook;
}

function generateInvoicePDF(invoice, customer, items, company, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.fontSize(20).text(company.name || 'FEED MILL ERP', { align: 'center' });
            doc.fontSize(10).text(company.address || '', { align: 'center' });
            doc.moveDown(2);

            doc.fontSize(14).text('INVOICE', { align: 'center' });
            doc.moveDown();

            doc.fontSize(10);
            doc.text(`Invoice No: ${invoice.invoice_number}`);
            doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`);
            if (invoice.due_date) {
                doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}`);
            }

            doc.moveDown();
            doc.text(`Bill To:`);
            doc.font('Helvetica-Bold').text(customer.name);
            doc.font('Helvetica').text(customer.address || '');
            doc.text(`GSTIN: ${customer.gstin || 'N/A'}`);

            doc.moveDown(2);

            const tableTop = doc.y;
            const colWidths = [200, 80, 80, 80, 80];
            const headers = ['Description', 'Qty', 'Rate', 'Amount'];

            doc.font('Helvetica-Bold').fontSize(9);
            let xPos = 40;
            headers.forEach((header, i) => {
                doc.text(header, xPos, tableTop, { width: colWidths[i], align: i > 1 ? 'right' : 'left' });
                xPos += colWidths[i];
            });

            doc.moveTo(40, tableTop + 12).lineTo(doc.page.width - 40, tableTop + 12).stroke();

            doc.font('Helvetica').fontSize(9);
            let yPos = tableTop + 20;

            items.forEach(item => {
                xPos = 40;
                doc.text(item.description || item.name, xPos, yPos, { width: colWidths[0] });
                xPos += colWidths[0];
                doc.text(String(item.quantity), xPos, yPos, { width: colWidths[1], align: 'right' });
                xPos += colWidths[1];
                doc.text(`₹${parseFloat(item.rate).toFixed(2)}`, xPos, yPos, { width: colWidths[2], align: 'right' });
                xPos += colWidths[2];
                doc.text(`₹${parseFloat(item.amount || (item.quantity * item.rate)).toFixed(2)}`, xPos, yPos, { width: colWidths[3], align: 'right' });
                yPos += 15;
            });

            yPos += 20;
            doc.moveTo(350, yPos).lineTo(doc.page.width - 40, yPos).stroke();

            doc.font('Helvetica-Bold');
            doc.text('Subtotal:', 350, yPos + 5);
            doc.text(`₹${parseFloat(invoice.subtotal || invoice.total_amount).toFixed(2)}`, 450, yPos + 5, { width: 100, align: 'right' });

            if (invoice.tax_amount > 0) {
                yPos += 15;
                doc.font('Helvetica');
                doc.text('Tax:', 350, yPos);
                doc.text(`₹${parseFloat(invoice.tax_amount).toFixed(2)}`, 450, yPos, { width: 100, align: 'right' });
            }

            yPos += 20;
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text('Total:', 350, yPos);
            doc.text(`₹${parseFloat(invoice.total_amount).toFixed(2)}`, 450, yPos, { width: 100, align: 'right' });

            doc.fontSize(8);
            doc.text(`Amount in Words: ${numberToWords(invoice.total_amount)}`, 40, yPos + 30);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const hundred = Math.floor(num / 100);
    num %= 100;

    let result = '';
    if (crore > 0) result += (crore > 19 ? ones[Math.floor(crore / 10)] + ' ' + ones[crore % 10] : ones[crore]) + ' Crore ';
    if (lakh > 0) result += (lakh > 19 ? tens[Math.floor(lakh / 10)] + ' ' + ones[lakh % 10] : ones[lakh]) + ' Lakh ';
    if (thousand > 0) result += (thousand > 19 ? tens[Math.floor(thousand / 10)] + ' ' + ones[thousand % 10] : ones[thousand]) + ' Thousand ';
    if (hundred > 0) result += ones[hundred] + ' Hundred ';
    if (num > 0) {
        if (num < 20) result += ones[num];
        else result += tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    }

    return result + ' Rupees Only';
}

module.exports = {
    generatePDFReport,
    generateExcelReport,
    generateInvoicePDF,
    formatValue,
    numberToWords
};
