// ==========================================================
// BEATS INFINITY - EXCEL EXPORT / IMPORT HELPERS
// ==========================================================
//
// Shared by every admin tab's "Export Excel" / "Import Excel"
// buttons. Export builds a .xlsx client-side and triggers a
// browser download; import parses an uploaded .xlsx entirely
// in the browser (no file upload to the backend) and hands
// back plain row objects keyed by each column's `key`.
//
// exceljs is loaded via a dynamic import so it lands in its
// own chunk, fetched only when an admin actually exports or
// imports - not bundled into the app's main entry that every
// public visitor downloads.
// ==========================================================

// columns: [{ key, header, width? }]
const exportToExcel = async (columns, rows, filename) => {

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.columns = columns.map(column => ({
        header: column.header,
        key: column.key,
        width: column.width || 22
    }));

    sheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1DB954" } };
    });

    (rows || []).forEach(row => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

};

// columns: [{ key, header }] - matched against the sheet's
// header row (case-insensitive, trimmed) so column order in
// the uploaded file doesn't matter.
const parseExcelFile = async (file, columns) => {

    const { default: ExcelJS } = await import("exceljs");
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];

    if (!sheet) {

        return [];

    }

    const headerToKey = new Map(
        columns.map(column => [String(column.header).trim().toLowerCase(), column.key])
    );

    const colIndexToKey = {};

    sheet.getRow(1).eachCell((cell, colNumber) => {

        const key = headerToKey.get(String(cell.value || "").trim().toLowerCase());

        if (key) {

            colIndexToKey[colNumber] = key;

        }

    });

    const rows = [];

    sheet.eachRow((row, rowNumber) => {

        if (rowNumber === 1) {

            return;

        }

        const parsedRow = {};
        let hasValue = false;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {

            const key = colIndexToKey[colNumber];

            if (!key) {

                return;

            }

            let value = cell.value;

            if (value && typeof value === "object" && value.richText) {

                value = value.richText.map(part => part.text).join("");

            }

            if (value instanceof Date) {

                value = value.toISOString().slice(0, 10);

            }

            const stringValue = value === null || value === undefined ? "" : String(value).trim();

            if (stringValue !== "") {

                hasValue = true;

            }

            parsedRow[key] = stringValue;

        });

        if (hasValue) {

            rows.push(parsedRow);

        }

    });

    return rows;

};

export { exportToExcel, parseExcelFile };
