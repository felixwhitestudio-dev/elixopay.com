/**
 * Extracts data from an HTML table and triggers a CSV download
 * @param {string} tableId - The ID of the <table> element 
 * @param {string} filename - The desired output filename without extension (e.g., 'users_report')
 */
function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID ${tableId} not found.`);
        return;
    }

    let csvContent = "";

    // Parse headers
    const headers = [];
    const thead = table.querySelector('thead tr');
    if (thead) {
        thead.querySelectorAll('th').forEach(th => {
            // Ignore Action columns if present
            if (th.innerText.toLowerCase() !== 'action' && th.innerText.toLowerCase() !== 'actions') {
                headers.push(`"${th.innerText.replace(/"/g, '""')}"`);
            } else {
                headers.push(null); // Placeholder to match column indexing later
            }
        });
        csvContent += headers.filter(h => h !== null).join(',') + "\r\n";
    }

    // Parse rows
    const tbody = table.querySelector('tbody');
    if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(tr => {
            // Skip rows that are just "Loading..." or "No data"
            if (tr.cells.length === 1 && tr.cells[0].colSpan > 1) return;

            let rowData = [];
            Array.from(tr.cells).forEach((td, index) => {
                if (headers[index] !== null) {
                    // Clean up cell content (remove extra spaces and inner HTML tags if we just need text)
                    let text = td.innerText.replace(/(\r\n|\n|\r)/gm, ' ').trim();
                    text = text.replace(/"/g, '""'); // Escape double quotes
                    rowData.push(`"${text}"`);
                }
            });
            csvContent += rowData.join(',') + "\r\n";
        });
    }

    // Trigger download
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
