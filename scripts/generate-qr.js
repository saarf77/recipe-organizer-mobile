#!/usr/bin/env node
/**
 * Generates a QR code PNG for the Expo dev server.
 *
 * Usage:
 *   node scripts/generate-qr.js
 *   node scripts/generate-qr.js --url exp://192.168.1.100:8081
 *
 * Output: qr-code.png in project root
 */

const QRCode = require('qrcode');
const path = require('path');
const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function main() {
  const args = process.argv.slice(2);
  let url;

  const urlArg = args.findIndex((a) => a === '--url');
  if (urlArg !== -1 && args[urlArg + 1]) {
    url = args[urlArg + 1];
  } else {
    const ip = getLocalIp();
    url = `exp://${ip}:8081`;
  }

  const outputPath = path.join(__dirname, '..', 'qr-code.png');

  await QRCode.toFile(outputPath, url, {
    type: 'png',
    width: 400,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  console.log(`✅ QR code generated: ${outputPath}`);
  console.log(`   URL: ${url}`);
  console.log(`   Scan with Expo Go app to open on device`);
}

main().catch((err) => {
  console.error('Failed to generate QR code:', err.message);
  process.exit(1);
});
