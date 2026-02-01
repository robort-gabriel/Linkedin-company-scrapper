#!/usr/bin/env node

/**
 * Package Extension for Chrome Web Store Upload
 * 
 * This script creates a properly structured zip file for Chrome Web Store upload.
 * The manifest.json must be at the root of the zip file.
 * 
 * Usage: node package-extension.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = __dirname;
const OUTPUT_FILE = path.join(EXTENSION_DIR, 'linkedin-data-extractor.zip');

// Files and directories to include
const INCLUDE_PATTERNS = [
  'manifest.json',
  'background/**/*',
  'content/**/*',
  'sidepanel/**/*',
  'utils/**/*',
  'icons/**/*'
];

// Files and directories to exclude
const EXCLUDE_PATTERNS = [
  '**/*.md',
  '**/.git/**',
  '**/node_modules/**',
  '**/.DS_Store',
  '**/Thumbs.db',
  '**/*.zip',
  '**/*.log',
  '**/package*.json',
  '**/package-extension.js',
  '**/Archive.zip',
  '**/api-logger-manifest.json',
  '**/create-icons.html',
  '**/generate-icons.js',
  '**/ICON_GENERATION_GUIDE.md',
  '**/icon-instructions.txt',
  '**/README.md'
];

console.log('📦 Packaging LinkedIn Data Extractor for Chrome Web Store...\n');

// Check if required files exist
const requiredFiles = [
  'manifest.json',
  'background/service-worker.js',
  'content/content-script.js',
  'content/extractors.js',
  'sidepanel/sidepanel.html',
  'sidepanel/sidepanel.js',
  'sidepanel/sidepanel.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

console.log('✅ Checking required files...');
let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(EXTENSION_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing: ${file}`);
    allFilesExist = false;
  } else {
    console.log(`   ✓ ${file}`);
  }
}

if (!allFilesExist) {
  console.error('\n❌ Some required files are missing. Please ensure all files exist before packaging.');
  process.exit(1);
}

// Check if zip command is available
let zipCommand;
try {
  execSync('which zip', { stdio: 'ignore' });
  zipCommand = 'zip';
} catch (e) {
  try {
    execSync('where zip', { stdio: 'ignore' });
    zipCommand = 'zip';
  } catch (e2) {
    console.error('❌ zip command not found. Please install zip utility.');
    console.log('\nAlternative: Manually create zip file with manifest.json at root:');
    console.log('1. Select all files EXCEPT .md files, .git, node_modules, etc.');
    console.log('2. Create zip file');
    console.log('3. Ensure manifest.json is at the root (not in a subfolder)');
    process.exit(1);
  }
}

// Remove old zip file if exists
if (fs.existsSync(OUTPUT_FILE)) {
  fs.unlinkSync(OUTPUT_FILE);
  console.log('🗑️  Removed old zip file\n');
}

  // Create zip file
  console.log('📦 Creating zip file...\n');

  try {
    // Change to extension directory
    process.chdir(EXTENSION_DIR);
    
    // Build zip command with proper quoting for paths with spaces
    const outputFileQuoted = `"${OUTPUT_FILE}"`;
    let zipArgs = ['-r', outputFileQuoted];
    
    // Add files to include
    zipArgs.push('manifest.json');
    zipArgs.push('background');
    zipArgs.push('content');
    zipArgs.push('sidepanel');
    zipArgs.push('utils');
    zipArgs.push('icons');
    
    // Exclude patterns
    for (const pattern of EXCLUDE_PATTERNS) {
      zipArgs.push('-x');
      zipArgs.push(pattern);
    }
    
    // Execute zip command
    const command = [zipCommand, ...zipArgs].join(' ');
    console.log(`Executing: ${command}\n`);
    
    execSync(command, { stdio: 'inherit', shell: true });
  
  // Verify zip file was created
  if (fs.existsSync(OUTPUT_FILE)) {
    const stats = fs.statSync(OUTPUT_FILE);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n✅ Extension packaged successfully!');
    console.log(`📁 Output: ${OUTPUT_FILE}`);
    console.log(`📊 Size: ${sizeInMB} MB\n`);
    
    // Verify manifest.json is at root
    console.log('🔍 Verifying package structure...');
    try {
      const { execSync: execSync2 } = require('child_process');
      const listOutput = execSync2(`unzip -l "${OUTPUT_FILE}" | grep manifest.json`, { encoding: 'utf-8' });
      
      if (listOutput.includes('manifest.json') && !listOutput.includes('/linkedin-data-extractor/manifest.json')) {
        console.log('✅ manifest.json is at root level ✓');
      } else {
        console.log('⚠️  Warning: Check that manifest.json is at root level');
      }
    } catch (e) {
      console.log('⚠️  Could not verify structure (unzip not available)');
    }
    
    console.log('\n📤 Ready for Chrome Web Store upload!');
    console.log('   Upload: linkedin-data-extractor.zip\n');
    
  } else {
    console.error('❌ Zip file was not created');
    process.exit(1);
  }
  
} catch (error) {
  console.error('\n❌ Error creating zip file:');
  console.error(error.message);
  console.log('\n💡 Manual packaging instructions:');
  console.log('1. Navigate to the linkedin-data-extractor folder');
  console.log('2. Select these folders/files:');
  console.log('   - manifest.json (MUST be at root)');
  console.log('   - background/');
  console.log('   - content/');
  console.log('   - sidepanel/');
  console.log('   - utils/');
  console.log('   - icons/');
  console.log('3. Create a zip file');
  console.log('4. Ensure manifest.json is directly in the zip (not in a subfolder)');
  process.exit(1);
}
