const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const User = require("../models/User");
const Inventory = require("../models/Inventory");
const RFQ = require("../models/RFQ");
const Deal = require("../models/Deal");
const SupplierProfile = require("../models/SupplierProfile");
const BuyerProfile = require("../models/BuyerProfile");

/**
 * Generate Inventory Report
 */
exports.inventoryReport = async (req, res) => {
  try {
    const { format = "json", startDate, endDate, supplierId } = req.query;

    const query = { isActive: true };
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
    if (supplierId) query.supplier = supplierId;

    const inventory = await Inventory.find(query)
      .populate("supplier", "fullName email")
      .sort("-createdAt");

    const summary = {
      totalItems: inventory.length,
      totalWeight: inventory.reduce((sum, i) => sum + i.weightKg, 0),
      totalValue: inventory.reduce((sum, i) => sum + i.weightKg * i.askingPrice, 0),
      availableItems: inventory.filter((i) => i.status === "available").length,
      soldItems: inventory.filter((i) => i.status === "sold").length,
    };

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Inventory Report");

      worksheet.columns = [
        { header: "Inventory #", key: "inventoryNumber", width: 15 },
        { header: "Supplier", key: "supplier", width: 20 },
        { header: "Weight (kg)", key: "weightKg", width: 12 },
        { header: "Purity (%)", key: "purity", width: 12 },
        { header: "Location", key: "location", width: 15 },
        { header: "Price/kg", key: "askingPrice", width: 15 },
        { header: "Status", key: "status", width: 12 },
        { header: "Created", key: "createdAt", width: 20 },
      ];

      inventory.forEach((item) => {
        worksheet.addRow({
          inventoryNumber: item.inventoryNumber,
          supplier: item.supplier?.fullName || "N/A",
          weightKg: item.weightKg,
          purity: item.purity,
          location: item.location,
          askingPrice: item.askingPrice,
          status: item.status,
          createdAt: item.createdAt.toLocaleDateString(),
        });
      });

      // Add summary sheet
      const summarySheet = workbook.addWorksheet("Summary");
      summarySheet.addRow(["Metric", "Value"]);
      summarySheet.addRow(["Total Items", summary.totalItems]);
      summarySheet.addRow(["Total Weight (kg)", summary.totalWeight]);
      summarySheet.addRow(["Total Value (USD)", summary.totalValue]);
      summarySheet.addRow(["Available Items", summary.availableItems]);
      summarySheet.addRow(["Sold Items", summary.soldItems]);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=inventory-report-${Date.now()}.xlsx`
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === "pdf") {
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=inventory-report-${Date.now()}.pdf`
      );

      doc.pipe(res);

      doc.fontSize(20).text("Inventory Report", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      doc.fontSize(14).text("Summary", { underline: true });
      doc.fontSize(10).text(`Total Items: ${summary.totalItems}`);
      doc.text(`Total Weight: ${summary.totalWeight} kg`);
      doc.text(`Total Value: $${summary.totalValue.toLocaleString()}`);
      doc.text(`Available Items: ${summary.availableItems}`);
      doc.text(`Sold Items: ${summary.soldItems}`);
      doc.moveDown();

      doc.fontSize(14).text("Inventory Details", { underline: true });
      inventory.slice(0, 20).forEach((item) => {
        doc
          .fontSize(10)
          .text(
            `${item.inventoryNumber} - ${item.weightKg}kg @ $${item.askingPrice}/kg - ${item.status}`
          );
      });

      doc.end();
      return;
    }

    res.status(200).json({
      success: true,
      summary,
      inventory,
    });
  } catch (error) {
    console.error("Inventory report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate inventory report",
    });
  }
};

/**
 * Generate Deals Report
 */
exports.dealsReport = async (req, res) => {
  try {
    const { format = "json", startDate, endDate, status } = req.query;

    const query = { isActive: true };
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
    if (status) query.status = status;

    const deals = await Deal.find(query)
      .populate("supplier", "fullName email")
      .populate("buyer", "fullName email")
      .sort("-createdAt");

    const summary = {
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, d) => sum + d.totalAmount, 0),
      totalWeight: deals.reduce((sum, d) => sum + d.quantityKg, 0),
      completedDeals: deals.filter((d) => d.status === "completed").length,
      averageDealSize:
        deals.length > 0 ? deals.reduce((sum, d) => sum + d.totalAmount, 0) / deals.length : 0,
    };

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Deals Report");

      worksheet.columns = [
        { header: "Deal #", key: "dealNumber", width: 15 },
        { header: "Supplier", key: "supplier", width: 20 },
        { header: "Buyer", key: "buyer", width: 20 },
        { header: "Quantity (kg)", key: "quantityKg", width: 12 },
        { header: "Price/kg", key: "agreedPricePerKg", width: 15 },
        { header: "Total Amount", key: "totalAmount", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Created", key: "createdAt", width: 20 },
      ];

      deals.forEach((deal) => {
        worksheet.addRow({
          dealNumber: deal.dealNumber,
          supplier: deal.supplier?.fullName || "N/A",
          buyer: deal.buyer?.fullName || "N/A",
          quantityKg: deal.quantityKg,
          agreedPricePerKg: deal.agreedPricePerKg,
          totalAmount: deal.totalAmount,
          status: deal.status,
          createdAt: deal.createdAt.toLocaleDateString(),
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=deals-report-${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      return res.end();
    }

    res.status(200).json({
      success: true,
      summary,
      deals,
    });
  } catch (error) {
    console.error("Deals report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate deals report",
    });
  }
};

/**
 * Generate RFQ Report
 */
exports.rfqReport = async (req, res) => {
  try {
    const { format = "json", startDate, endDate, status } = req.query;

    const query = { isActive: true };
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
    if (status) query.status = status;

    const rfqs = await RFQ.find(query)
      .populate("buyer", "fullName email")
      .populate("supplier", "fullName email")
      .sort("-createdAt");

    const summary = {
      totalRFQs: rfqs.length,
      pendingRFQs: rfqs.filter((r) => r.status === "pending").length,
      acceptedRFQs: rfqs.filter((r) => r.status === "accepted").length,
      rejectedRFQs: rfqs.filter((r) => r.status === "rejected").length,
      totalValue: rfqs.reduce((sum, r) => sum + (r.offeredTotalPrice || 0), 0),
      acceptanceRate:
        rfqs.length > 0
          ? (rfqs.filter((r) => r.status === "accepted").length / rfqs.length) * 100
          : 0,
    };

    res.status(200).json({
      success: true,
      summary,
      rfqs,
    });
  } catch (error) {
    console.error("RFQ report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate RFQ report",
    });
  }
};

/**
 * Generate Suppliers Report
 */
exports.suppliersReport = async (req, res) => {
  try {
    const suppliers = await SupplierProfile.find()
      .populate("user", "fullName email phone createdAt")
      .sort("-createdAt");

    const summary = {
      totalSuppliers: suppliers.length,
      approvedKYC: suppliers.filter((s) => s.kycStatus === "approved").length,
      pendingKYC: suppliers.filter((s) => s.kycStatus === "pending").length,
      activeSuppliers: suppliers.filter((s) => s.isActive).length,
    };

    res.status(200).json({
      success: true,
      summary,
      suppliers,
    });
  } catch (error) {
    console.error("Suppliers report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate suppliers report",
    });
  }
};

/**
 * Export any data to CSV
 */
exports.exportToCSV = async (req, res) => {
  try {
    const { data, filename, headers } = req.body;

    let csvContent = headers.join(",") + "\n";

    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || "";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvContent += values.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}-${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error("Export to CSV error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export data",
    });
  }
};
