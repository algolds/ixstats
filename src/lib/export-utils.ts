import Papa from "papaparse";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Export data to CSV file
 * @param data - Array of objects to export
 * @param filename - Name of the file (without .csv extension)
 * @param columns - Optional array of column names/keys to include. If not provided, uses all keys from first object
 */
export function exportDataToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: (keyof T)[]
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Filter data to only include specified columns if provided
  let processedData = data;
  if (columns && columns.length > 0) {
    processedData = data.map((row) => {
      const filteredRow: Partial<T> = {};
      columns.forEach((col) => {
        filteredRow[col] = row[col];
      });
      return filteredRow as T;
    });
  }

  // Convert to CSV
  const csv = Papa.unparse(processedData);

  // Create blob and download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export a chart/element to PDF
 * @param elementId - DOM element ID or element reference to capture
 * @param filename - Name of the PDF file (without .pdf extension)
 * @param options - Optional configuration for the PDF export
 */
export async function exportChartToPDF(
  elementId: string | HTMLElement,
  filename: string,
  options: {
    title?: string;
    orientation?: "portrait" | "landscape";
    quality?: number;
  } = {}
): Promise<void> {
  try {
    const { title, orientation = "landscape", quality = 0.95 } = options;

    // Get the element
    const element = typeof elementId === "string" ? document.getElementById(elementId) : elementId;

    if (!element) {
      console.error(`Element ${elementId} not found`);
      return;
    }

    // Capture the element as canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    // Calculate dimensions
    const imgWidth = orientation === "portrait" ? 210 : 297; // A4 size in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
    });

    // Add title if provided
    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, imgWidth / 2, 15, { align: "center" });
    }

    // Add image to PDF
    const imgData = canvas.toDataURL("image/png", quality);
    pdf.addImage(imgData, "PNG", 10, title ? 25 : 10, imgWidth - 20, imgHeight);

    // Save PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw error;
  }
}

/**
 * Export multiple charts/elements to a single PDF report
 * @param elements - Array of element configurations to export
 * @param filename - Name of the PDF file (without .pdf extension)
 * @param options - Optional configuration for the PDF report
 */
export async function exportDashboardReport(
  elements: Array<{
    id: string | HTMLElement;
    title?: string;
    description?: string;
  }>,
  filename: string,
  options: {
    reportTitle?: string;
    orientation?: "portrait" | "landscape";
    quality?: number;
  } = {}
): Promise<void> {
  try {
    const { reportTitle, orientation = "landscape", quality = 0.95 } = options;

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
    });

    const pageWidth = orientation === "portrait" ? 210 : 297;
    const pageHeight = orientation === "portrait" ? 297 : 210;
    let isFirstPage = true;

    // Add cover page if report title provided
    if (reportTitle) {
      pdf.setFontSize(24);
      pdf.text(reportTitle, pageWidth / 2, 50, { align: "center" });

      pdf.setFontSize(12);
      pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, 60, {
        align: "center",
      });

      isFirstPage = false;
    }

    // Process each element
    for (let i = 0; i < elements.length; i++) {
      const { id, title, description } = elements[i];

      // Add new page for each chart (except first if no cover)
      if (!isFirstPage || i > 0) {
        pdf.addPage();
      }
      isFirstPage = false;

      // Get the element
      const element = typeof id === "string" ? document.getElementById(id) : id;
      if (!element) {
        console.warn(`Element ${id} not found, skipping...`);
        continue;
      }

      // Capture element as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });

      let yOffset = 15;

      // Add title if provided
      if (title) {
        pdf.setFontSize(16);
        pdf.text(title, pageWidth / 2, yOffset, { align: "center" });
        yOffset += 8;
      }

      // Add description if provided
      if (description) {
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text(description, pageWidth / 2, yOffset, { align: "center" });
        pdf.setTextColor(0);
        yOffset += 8;
      }

      // Calculate image dimensions
      const maxWidth = pageWidth - 20;
      const maxHeight = pageHeight - yOffset - 10;

      let imgWidth = maxWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Scale down if too tall
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }

      // Center the image horizontally
      const xOffset = (pageWidth - imgWidth) / 2;

      // Add image to PDF
      const imgData = canvas.toDataURL("image/png", quality);
      pdf.addImage(imgData, "PNG", xOffset, yOffset, imgWidth, imgHeight);

      // Add page number
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Page ${pdf.getNumberOfPages() - (reportTitle ? 1 : 0)} of ${elements.length}`,
        pageWidth - 15,
        pageHeight - 5,
        { align: "right" }
      );
      pdf.setTextColor(0);
    }

    // Save PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error exporting dashboard report:", error);
    throw error;
  }
}

/**
 * Export data table to CSV with formatted headers
 * @param data - Array of data objects
 * @param filename - Name of the file
 * @param headerMap - Optional mapping of data keys to human-readable headers
 */
export function exportTableToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  headerMap?: Record<keyof T, string>
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Transform headers if mapping provided
  let processedData = data;
  if (headerMap) {
    processedData = data.map((row) => {
      const transformedRow: Record<string, any> = {};
      Object.keys(row).forEach((key) => {
        const newKey = headerMap[key as keyof T] || key;
        transformedRow[newKey] = row[key];
      });
      return transformedRow as T;
    });
  }

  exportDataToCSV(processedData, filename);
}
