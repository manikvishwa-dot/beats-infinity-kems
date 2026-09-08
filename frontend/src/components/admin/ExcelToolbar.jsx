import { useRef, useState } from "react";

import { exportToExcel, parseExcelFile } from "../../utils/excel";

import "./ExcelToolbar.css";

// columns: [{ key, header, width? }]
// rows: current page data, already shaped for export
// onImportRows(parsedRows): async, applies the rows and
//   returns { message, error? } to display as a result banner
function ExcelToolbar({ columns, rows, filename, onImportRows, hint }) {

    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    const handleDownloadTemplate = () => {

        // Same shape as export, just with no data rows - a clean
        // starting point for filling in new entries from scratch.
        exportToExcel(columns, [], `${filename}-template`);

    };

    const handleExport = () => {

        exportToExcel(columns, rows, filename);

    };

    const handleImportClick = () => {

        fileInputRef.current?.click();

    };

    const handleFileChange = async event => {

        const file = event.target.files?.[0];

        if (!file) {

            return;

        }

        setImporting(true);
        setResult(null);

        try {

            const parsedRows = await parseExcelFile(file, columns);

            if (parsedRows.length === 0) {

                setResult({ error: true, message: "No data rows found in that file." });

            }
            else {

                const summary = await onImportRows(parsedRows);
                setResult(summary || { message: "Import complete." });

            }

        }
        catch (importError) {

            console.error("Excel import error:", importError);
            setResult({ error: true, message: importError.message || "Unable to import that file." });

        }
        finally {

            setImporting(false);
            event.target.value = "";

        }

    };

    return (
        <div className="excel-toolbar">
            <div className="excel-toolbar-buttons">
                <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={handleDownloadTemplate}>
                    ⬇ Download Template
                </button>

                <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleExport}>
                    ⬇ Export Excel
                </button>

                <button
                    type="button"
                    className="admin-btn admin-btn-primary admin-btn-sm"
                    onClick={handleImportClick}
                    disabled={importing}
                >
                    {importing ? "Importing..." : "⬆ Import Excel"}
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    hidden
                    onChange={handleFileChange}
                />
            </div>

            {hint && <p className="excel-toolbar-hint">{hint}</p>}

            {result && (
                <div className={result.error ? "excel-toolbar-result error" : "excel-toolbar-result"}>
                    {result.error ? "⚠️ " : "✅ "}{result.message}
                </div>
            )}
        </div>
    );

}

export default ExcelToolbar;
