import type { Invoice, Currency } from '../types';
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

export async function generateInvoiceDocx(
  invoice: Invoice,
  companyName: string,
  groups: ProjectGroup[],
  totalHoursStr: string,
  totalAmountStr: string,
  rateStr: string,
  currency: Currency,
  profile: BusinessProfile,
  isRetainer: boolean,
  retainerLine?: { description: string; amount: string },
  notes?: string,
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
  } else {
    // Header row
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

  // --- Payment Information ---
  const bankItems: string[] = [];
  if (profile.ein) bankItems.push(`EIN: ${profile.ein}`);
  if (profile.routingNumber) bankItems.push(`Routing #: ${profile.routingNumber}`);
  if (profile.swiftCode) bankItems.push(`SWIFT: ${profile.swiftCode}`);
  if (profile.accountNumber) bankItems.push(`Account #: ${profile.accountNumber}`);

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
