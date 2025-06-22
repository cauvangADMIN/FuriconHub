const fs = require('fs');
const path = require('path');

// Configuration
const imageDir = path.resolve(__dirname, '..', 'assets/images');
const manifestPath = path.join(imageDir, 'manifest.json');
const imagePrefix = 'assets/images/';
const imagePattern = /^ecchi-\d+\.webp$/i;

// Ensure the directory exists
if (!fs.existsSync(imageDir)) {
    console.error(`Directory does not exist: ${imageDir}`);
    process.exit(1);
}

// Get all image files from the directory
console.log(`Scanning directory: ${imageDir}`);
const files = fs.readdirSync(imageDir);

// Filter for image files matching our pattern
const imageFiles = files.filter(file => {
    return imagePattern.test(file);
});

console.log(`Found ${imageFiles.length} image files`);

// Sort the files by number (descending)
imageFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0]);
    const numB = parseInt(b.match(/\d+/)[0]);
    return numB - numA; // Descending order
});

// Create the manifest object
const manifest = {
    totalCount: imageFiles.length,
    images: imageFiles.map(file => `${imagePrefix}${file}`)
};

// Write the manifest file
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Manifest file updated: ${manifestPath}`);
console.log(`Total images: ${manifest.totalCount}`);