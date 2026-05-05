import type { Invoice, Currency, LineItem } from '../types';
import type { BusinessProfile } from './storage';

interface WeekLine {
  mondayDate: string;
  hours: number;
  amount: number;
}

interface ProjectGroup {
  projectName: string | null;
  weeks: WeekLine[];
  totalHours: number;
  totalAmount: number;
}

interface DetailedLine {
  date: string;
  projectName: string | null;
  description: string;
  hours: number;
  amount: number;
}

export async function generateInvoiceDocx(
  invoice: Invoice,
  companyName: string,
  billingAddress: string | undefined,
  groups: ProjectGroup[],
  totalHoursStr: string,
  totalAmountStr: string,
  rateStr: string,
  currency: Currency,
  profile: BusinessProfile,
  isRetainer: boolean,
  vatReverseCharge: boolean,
  vatNoticeText: string | undefined,
  retainerLine?: { description: string; amount: string },
  notes?: string,
  lineItems?: LineItem[],
  detailedLines?: DetailedLine[],
): Promise<void> {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, WidthType, AlignmentType, BorderStyle,
    TableLayoutType,
  } = await import('docx');

  const formatDateLocal = (await import('./dateUtils')).formatDate;
  const { formatCurrency: fmtCurrency, formatHours } = await import('./formatCurrency');

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0 },
    bottom: { style: BorderStyle.NONE, size: 0 },
    left: { style: BorderStyle.NONE, size: 0 },
    right: { style: BorderStyle.NONE, size: 0 },
  };

  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
  };

  const thickTopBorder = {
    top: { style: BorderStyle.SINGLE, size: 3, color: 'BBBBBB' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
  };

  // --- Header: "INVOICE" left, profile info right ---
  const profileLines: InstanceType<typeof TextRun>[] = [];
  if (profile.name) {
    profileLines.push(new TextRun({ text: profile.name, bold: true, size: 26, font: 'Calibri' }));
  }
  if (profile.address) {
    for (const line of profile.address.split('\n')) {
      profileLines.push(new TextRun({ break: 1, text: line, size: 20, color: '666666', font: 'Calibri' }));
    }
  }
  if (profile.email) {
    profileLines.push(new TextRun({ break: 1, text: profile.email, size: 20, color: '666666', font: 'Calibri' }));
  }
  if (profile.phone) {
    profileLines.push(new TextRun({ break: 1, text: profile.phone, size: 20, color: '666666', font: 'Calibri' }));
  }

  const headerTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'INVOICE', bold: true, size: 56, font: 'Calibri' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: profileLines.length > 0 ? profileLines : [new TextRun('')],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // --- Parties: Bill To (left) | Invoice Details (right) ---
  const rateLabel = isRetainer ? 'Monthly Retainer' : `${rateStr}/hr`;

  const partiesTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'BILL TO', size: 18, color: '888888', font: 'Calibri' })],
              }),
              new Paragraph({
                children: [new TextRun({ text: companyName, bold: true, size: 24, font: 'Calibri' })],
              }),
              ...((billingAddress && billingAddress.trim() ? billingAddress.split('\n') : []).map((line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 20, color: '555555', font: 'Calibri' })],
                })
              )),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'INVOICE DETAILS', size: 18, color: '888888', font: 'Calibri' })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Invoice #: ', color: '888888', size: 20, font: 'Calibri' }),
                  new TextRun({ text: invoice.invoiceNumber || '\u2014', size: 20, font: 'Calibri' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Date: ', color: '888888', size: 20, font: 'Calibri' }),
                  new TextRun({ text: formatDateLocal(invoice.invoiceDate), size: 20, font: 'Calibri' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Rate: ', color: '888888', size: 20, font: 'Calibri' }),
                  new TextRun({ text: rateLabel, size: 20, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // --- Line items table ---
  const tableRows: InstanceType<typeof TableRow>[] = [];

  if (isRetainer && retainerLine) {
    // Header row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Amount', bold: true, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
    // Data row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: retainerLine.description, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: retainerLine.amount, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
    // Line items
    if (lineItems) {
      for (const li of lineItems) {
        const detail = li.quantity && li.unitPrice ? ` (${li.quantity} × ${fmtCurrency(li.unitPrice, currency)})` : '';
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ children: [new TextRun({ text: li.description + detail, size: 20, font: 'Calibri' })] })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtCurrency(li.amount, currency), size: 20, font: 'Calibri' })] })],
              }),
            ],
          }),
        );
      }
    }
    // Totals footer
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: totalAmountStr, bold: true, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
  } else if (detailedLines) {
    // Header row — 4 columns: Date, Description, Hours, Amount
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Hours', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Amount', bold: true, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
    // Individual entry rows
    for (const line of detailedLines) {
      const desc = line.projectName ? `${line.projectName}: ${line.description}` : line.description;
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              borders: thinBorder,
              children: [new Paragraph({ children: [new TextRun({ text: formatDateLocal(line.date), size: 20, color: '555555', font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: thinBorder,
              children: [new Paragraph({ children: [new TextRun({ text: desc, size: 20, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: thinBorder,
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatHours(line.hours), size: 20, font: 'Calibri' })] })],
            }),
            new TableCell({
              borders: thinBorder,
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtCurrency(line.amount, currency), size: 20, font: 'Calibri' })] })],
            }),
          ],
        }),
      );
    }
    // Line items
    if (lineItems) {
      for (const li of lineItems) {
        const detail = li.quantity && li.unitPrice ? ` (${li.quantity} × ${fmtCurrency(li.unitPrice, currency)})` : '';
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 2,
                borders: thinBorder,
                children: [new Paragraph({ children: [new TextRun({ text: li.description + detail, size: 20, font: 'Calibri' })] })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '', size: 20, font: 'Calibri' })] })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtCurrency(li.amount, currency), size: 20, font: 'Calibri' })] })],
              }),
            ],
          }),
        );
      }
    }
    // Totals footer
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            borders: thickTopBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: totalHoursStr, bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: totalAmountStr, bold: true, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
  } else {
    // Header row — 3 columns: Description, Hours, Amount (weekly summary)
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Hours', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            shading: { fill: 'F5F5F5' },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Amount', bold: true, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
    // Data rows grouped by project
    for (const group of groups) {
      if (group.projectName) {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                borders: thinBorder,
                shading: { fill: 'F9F9F9' },
                children: [new Paragraph({ children: [new TextRun({ text: group.projectName, bold: true, size: 20, font: 'Calibri' })] })],
              }),
            ],
          }),
        );
      }
      for (const week of group.weeks) {
        const weekLabel = `Week of ${formatDateLocal(week.mondayDate)}`;
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({
                  indent: group.projectName ? { left: 360 } : undefined,
                  children: [new TextRun({ text: weekLabel, size: 20, color: '555555', font: 'Calibri' })],
                })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatHours(week.hours), size: 20, font: 'Calibri' })] })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtCurrency(week.amount, currency), size: 20, font: 'Calibri' })] })],
              }),
            ],
          }),
        );
      }
    }
    // Line items
    if (lineItems) {
      for (const li of lineItems) {
        const detail = li.quantity && li.unitPrice ? ` (${li.quantity} × ${fmtCurrency(li.unitPrice, currency)})` : '';
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ children: [new TextRun({ text: li.description + detail, size: 20, font: 'Calibri' })] })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '', size: 20, font: 'Calibri' })] })],
              }),
              new TableCell({
                borders: thinBorder,
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtCurrency(li.amount, currency), size: 20, font: 'Calibri' })] })],
              }),
            ],
          }),
        );
      }
    }
    // Totals footer
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: totalHoursStr, bold: true, size: 20, font: 'Calibri' })] })],
          }),
          new TableCell({
            borders: thickTopBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: totalAmountStr, bold: true, size: 20, font: 'Calibri' })] })],
          }),
        ],
      }),
    );
  }

  const lineItemsTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  // --- Notes ---
  const notesSection: InstanceType<typeof Paragraph>[] = [];
  if (notes) {
    notesSection.push(
      new Paragraph({ spacing: { before: 300 }, children: [
        new TextRun({ text: 'Notes: ', bold: true, size: 20, color: '666666', font: 'Calibri' }),
        new TextRun({ text: notes, size: 20, color: '666666', font: 'Calibri' }),
      ] }),
    );
  }

  // --- VAT Reverse Charge Notice ---
  const vatSection: InstanceType<typeof Paragraph>[] = [];
  if (vatReverseCharge) {
    const baseVatText = (vatNoticeText && vatNoticeText.trim()) || 'Reverse charge applies — recipient is liable for VAT under Articles 44 and 196 of EU VAT Directive 2006/112/EC.';
    const vatText = `${baseVatText}${profile.ein ? ` Supplier Tax ID (EIN): ${profile.ein}` : ''}`;
    vatSection.push(
      new Paragraph({
        spacing: { before: 300 },
        shading: { fill: 'EFF6FF' },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '93C5FD', space: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '93C5FD', space: 4 },
          left: { style: BorderStyle.SINGLE, size: 1, color: '93C5FD', space: 4 },
          right: { style: BorderStyle.SINGLE, size: 1, color: '93C5FD', space: 4 },
        },
        children: [
          new TextRun({ text: 'VAT Notice: ', bold: true, size: 20, color: '0369A1', font: 'Calibri' }),
          new TextRun({ text: vatText, size: 20, color: '0369A1', font: 'Calibri' }),
        ],
      }),
    );
  }

  // --- Payment Information ---
  const bankItems: string[] = [];
  if (profile.ein) bankItems.push(`EIN: ${profile.ein}`);
  if (profile.bankName) bankItems.push(`Bank: ${profile.bankName}`);
  if (profile.accountName) bankItems.push(`Account Name: ${profile.accountName}`);
  if (profile.routingNumber) bankItems.push(`Routing #: ${profile.routingNumber}`);
  if (profile.accountNumber) bankItems.push(`Account #: ${profile.accountNumber}`);
  if (profile.swiftCode) bankItems.push(`SWIFT: ${profile.swiftCode}`);

  const bankSection: InstanceType<typeof Paragraph>[] = [];
  if (bankItems.length > 0) {
    bankSection.push(
      new Paragraph({
        spacing: { before: 400 },
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD', space: 8 } },
        children: [new TextRun({ text: 'Payment Information', bold: true, size: 20, color: '555555', font: 'Calibri' })],
      }),
      new Paragraph({
        spacing: { before: 100 },
        children: [new TextRun({ text: bankItems.join('    |    '), size: 20, color: '555555', font: 'Calibri' })],
      }),
    );
  }

  // --- Build document ---
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 900, right: 900 },
        },
      },
      children: [
        headerTable,
        new Paragraph({ spacing: { after: 300 } }),
        partiesTable,
        new Paragraph({ spacing: { after: 300 } }),
        lineItemsTable,
        ...notesSection,
        ...vatSection,
        ...bankSection,
      ],
    }],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const safeName = companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Invoice-${invoice.invoiceNumber || 'draft'}-${safeName}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
