/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const backupDir = path.join(__dirname, "../backups");
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `backup-${timestamp}.gz`);

const dbUrl = process.env.MONGODB_URI;
const command = `mongodump --uri="${dbUrl}" --archive="${backupFile}" --gzip`;

console.log("Starting database backup...");
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error("Backup failed:", error);
    process.exit(1);
  }
  console.log(`Backup completed successfully: ${backupFile}`);
  process.exit(0);
});
